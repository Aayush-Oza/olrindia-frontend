/* ============================================================
   OLR INDIA - CHAT ENGINE (Firestore real-time)
   Shared by p.html (start chat), user dashboard (Chat tab),
   and vendor dashboard (Messages tab).
   Requires: firebase-config.js loaded first (window.db, fsX fns,
   window.signInFirebaseWithCustomToken), api.js (apiRequest).
   ============================================================ */

let chatRole = null;        // 'user' | 'vendor'
let chatMyId = null;        // numeric id
let chatMyUid = null;       // 'user_123' / 'vendor_45'
let chatUnsubMessages = null;
let chatUnsubConvo = null;
let typingTimeout = null;
let lastTypingWriteAt = 0;
let activeConvId = null;

// ── Wait for firebase-config.js to finish its async IIFE ────────
function waitForFirebaseReady() {
  return new Promise(resolve => {
    if (window.firebaseReady) return resolve(true);
    const iv = setInterval(() => {
      if (window.firebaseReady) { clearInterval(iv); resolve(true); }
    }, 100);
    setTimeout(() => { clearInterval(iv); resolve(!!window.firebaseReady); }, 8000);
  });
}

// ── Sign into Firebase using our backend-minted custom token ────
let chatAuthPromise = null;

async function initChatAuth(role) {
  // Already authenticated as this exact role - no work needed
  if (chatRole === role && chatMyUid) return true;

  // An auth attempt is already in-flight - wait for that one instead of
  // starting a second, racing sign-in (this was causing permission errors)
  if (chatAuthPromise) return chatAuthPromise;

  chatAuthPromise = (async () => {
    await waitForFirebaseReady();
    if (!window.firebaseReady) {
      toastError('Chat failed to load. Please refresh.');
      return false;
    }
    chatRole = role;

    const res = await apiRequest(`/auth/${role}/firebase-token`, 'POST');
    if (!res.success) {
      if (res.httpStatus === 401) {
        toastError('Your session has expired. Please log in again.');
        clearSessionAccount(role);
        sessionStorage.setItem('olr_return_after_login', window.location.href);
        setTimeout(() => {
          window.location.href = role === 'vendor' ? '/vendor/login' : '/user/login';
        }, 1200);
      } else {
        toastError(res.message || 'Could not connect to chat.');
      }
      return false;
    }
    chatMyUid = res.uid;
    chatMyId = parseInt(res.uid.split('_')[1]);

    const ok = await window.signInFirebaseWithCustomToken(res.firebase_token);
    if (!ok) {
      toastError('Could not connect to chat. Please refresh.');
      return false;
    }
    for (let i = 0; i < 20; i++) {
      if (window.getFirebaseCurrentUser()?.uid === res.uid) break;
      await new Promise(r => setTimeout(r, 50));
    }

    return true;
  })();

  const result = await chatAuthPromise;
  chatAuthPromise = null;
  return result;
}
let chatUnsubListLive = null;

function listenToMyConversations(onUpdate) {
  if (chatUnsubListLive) chatUnsubListLive();

  const field = chatRole === 'user' ? 'user_uid' : 'vendor_uid';
  const convRef = window.fsCollection(window.db, 'conversations');
  const q = window.fsQuery(convRef, window.fsWhere(field, '==', chatMyUid), window.fsOrderBy('last_message_at', 'desc'));

  chatUnsubListLive = window.fsOnSnapshot(q, snap => {
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    onUpdate(list);
  }, error => {
    console.warn('Chat list listener error:', error.message);
  });
}
// ── Conversation ID (deterministic - same thread on reopen) ─────
function buildConvId(userId, vendorId) {
  return `u${userId}_v${vendorId}`;
}

// ── Get or create conversation ───────────────────────────────────
async function getOrCreateConversation({ userId, vendorId, productId, userName, userPhoto, vendorName, vendorPhoto, productName }) {
  const convId = buildConvId(userId, vendorId);
  const ref = window.fsDoc(window.db, 'conversations', convId);
  const snap = await window.fsGetDoc(ref).catch(() => null);

  if (snap && snap.exists()) {
    // Conversation already exists - refresh names/photos + current product context
    const updates = { current_product_id: productId, current_product_name: productName || '' };
    if (chatRole === 'user') {
      updates.user_name = userName || '';
      updates.user_photo = userPhoto || null;
    } else {
      updates.vendor_name = vendorName || '';
      updates.vendor_photo = vendorPhoto || null;
    }
    await window.fsUpdateDoc(ref, updates);
    return convId;
  }

  await window.fsSetDoc(ref, {
    user_id: userId,
    vendor_id: vendorId,
    user_uid: `user_${userId}`,
    vendor_uid: `vendor_${vendorId}`,
    user_name: userName || '',
    user_photo: userPhoto || null,
    vendor_name: vendorName || '',
    vendor_photo: vendorPhoto || null,
    current_product_id: productId,
    current_product_name: productName || '',
    last_message: '',
    last_message_at: window.fsServerTimestamp(),
    last_sender_role: null,
    unread_count_user: 0,
    unread_count_vendor: 0,
    user_typing: false,
    vendor_typing: false,
  });

  return convId;
}

async function refreshMyIdentityInConversations(name, photo) {
  const convos = await getMyConversations();
  const field = chatRole === 'user'
    ? { user_name: name || '', user_photo: photo || null }
    : { vendor_name: name || '', vendor_photo: photo || null };
  await Promise.all(convos.map(c => {
    const ref = window.fsDoc(window.db, 'conversations', c.id);
    return window.fsUpdateDoc(ref, field);
  }));
}
// Ensures Firestore auth is ready, then pushes updated name/photo to all
// conversations this person is part of. Safe to call even if chat was
// never opened this session - it silently authenticates first.
async function pushIdentityUpdate(role, name, photo) {
  try {
    if (!chatRole || !chatMyUid) {
      const ok = await initChatAuth(role);
      if (!ok) {
        await new Promise(r => setTimeout(r, 1000));
        const retryOk = await initChatAuth(role);
        if (!retryOk) {
          console.error('pushIdentityUpdate: chat auth failed after retry, aborting.');
          return false;
        }
      }
    }
    await refreshMyIdentityInConversations(name, photo);
    return true;
  } catch (e) {
    console.error('Identity push failed:', e);
    return false;
  }
}
// ── Send a message ───────────────────────────────────────────────
async function sendChatMessage(convId, text) {
  text = (text || '').trim();
  if (!text) return;

  const convRef = window.fsDoc(window.db, 'conversations', convId);
  const convSnap = await window.fsGetDoc(convRef);
  const convData = convSnap.exists() ? convSnap.data() : {};

  const messagesRef = window.fsCollection(window.db, 'conversations', convId, 'messages');
  await window.fsAddDoc(messagesRef, {
    sender_role: chatRole,
    sender_uid: chatMyUid,
    text,
    created_at: window.fsServerTimestamp(),
    status: 'sent',
    product_id: convData.current_product_id || null,
    product_name: convData.current_product_name || '',
  });

  const otherUnreadField = chatRole === 'user' ? 'unread_count_vendor' : 'unread_count_user';
  const currentUnread = convData[otherUnreadField] || 0;

    await window.fsUpdateDoc(convRef, {
    last_message: text,
    last_message_at: window.fsServerTimestamp(),
    last_sender_role: chatRole,
    [otherUnreadField]: currentUnread + 1,
    [`${chatRole}_typing`]: false,
  });

  // ── Push notification to recipient ──────────────────────────
  try {
    await apiRequest(`/auth/${chatRole}/chat/notify`, 'POST', {
      conv_id: convId,
      text: text,
      sender_role: chatRole,
    });
  } catch (_) {}
  // ───────────────────────────────────────────────────────────
}

// ── Listen to messages in a conversation (real-time) ─────────────
function listenToMessages(convId, onUpdate) {
  if (chatUnsubMessages) chatUnsubMessages();

  const messagesRef = window.fsCollection(window.db, 'conversations', convId, 'messages');
  const q = window.fsQuery(messagesRef, window.fsOrderBy('created_at', 'asc'));

  chatUnsubMessages = window.fsOnSnapshot(q, snapshot => {
    const messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    onUpdate(messages);
  }, error => {
    console.warn('Chat listener error (likely auth transition):', error.message);
  });
}

// ── Listen to the conversation doc (typing indicator, unread) ────
function listenToConversation(convId, onUpdate) {
  if (chatUnsubConvo) chatUnsubConvo();

  const convRef = window.fsDoc(window.db, 'conversations', convId);
  chatUnsubConvo = window.fsOnSnapshot(convRef, snap => {
    if (snap.exists()) onUpdate(snap.data());
  }, error => {
    console.warn('Chat listener error (likely auth transition):', error.message);
  });
}

// ── Mark messages from the other party as seen ────────────────────
async function markMessagesSeen(convId, messages) {
  const otherRole = chatRole === 'user' ? 'vendor' : 'user';
  const unseen = messages.filter(m => m.sender_role === otherRole && m.status !== 'seen');
  if (!unseen.length) return;

  await Promise.all(unseen.map(m => {
    const msgRef = window.fsDoc(window.db, 'conversations', convId, 'messages', m.id);
    return window.fsUpdateDoc(msgRef, { status: 'seen' });
  }));

  const convRef = window.fsDoc(window.db, 'conversations', convId);
  const myUnreadField = chatRole === 'user' ? 'unread_count_user' : 'unread_count_vendor';
  await window.fsUpdateDoc(convRef, { [myUnreadField]: 0 });
}

// ── Typing indicator (throttled - write at most once per 3s) ─────
function notifyTyping(convId) {
  const now = Date.now();
  if (now - lastTypingWriteAt > 3000) {
    lastTypingWriteAt = now;
    const convRef = window.fsDoc(window.db, 'conversations', convId);
    window.fsUpdateDoc(convRef, { [`${chatRole}_typing`]: true }).catch(() => { });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    const convRef = window.fsDoc(window.db, 'conversations', convId);
    window.fsUpdateDoc(convRef, { [`${chatRole}_typing`]: false }).catch(() => { });
  }, 3000);
}

// ── Get all conversations for the current user/vendor ─────────────
async function getMyConversations() {
  const field = chatRole === 'user' ? 'user_uid' : 'vendor_uid';
  const convRef = window.fsCollection(window.db, 'conversations');
  const q = window.fsQuery(convRef, window.fsWhere(field, '==', chatMyUid), window.fsOrderBy('last_message_at', 'desc'));
  const snap = await window.fsGetDocs(q);
  const list = [];
  snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
  return list;
}

// ── Cleanup listeners when leaving chat screen ─────────────────────
function stopChatListeners() {
  if (chatUnsubMessages) { chatUnsubMessages(); chatUnsubMessages = null; }
  if (chatUnsubConvo) { chatUnsubConvo(); chatUnsubConvo = null; }
  if (chatUnsubUnread) { chatUnsubUnread(); chatUnsubUnread = null; }
  if (chatUnsubListLive) { chatUnsubListLive(); chatUnsubListLive = null; }
  if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
  activeConvId = null;
}
// ── Live unread badge (nav tab) ─────────────────────────────────
let chatUnsubUnread = null;

function listenToConversation(convId, onUpdate) {
  if (chatUnsubConvo) chatUnsubConvo();

  const convRef = window.fsDoc(window.db, 'conversations', convId);
  chatUnsubConvo = window.fsOnSnapshot(convRef, snap => {
    if (snap.exists()) onUpdate(snap.data());
  }, error => {
    console.warn('Chat listener error (likely auth transition):', error.message);
  });
}

function listenToUnreadBadge() {
  const field = chatRole === 'user' ? 'user_uid' : 'vendor_uid';
  const unreadField = chatRole === 'user' ? 'unread_count_user' : 'unread_count_vendor';
  const convRef = window.fsCollection(window.db, 'conversations');
  const q = window.fsQuery(convRef, window.fsWhere(field, '==', chatMyUid));

  if (chatUnsubUnread) chatUnsubUnread();
    chatUnsubUnread = window.fsOnSnapshot(q, snap => {
    let total = 0;
    snap.forEach(doc => { if ((doc.data()[unreadField] || 0) > 0) total += 1; });
    updateChatBadge(total);
  }, error => {
    console.warn('Chat listener error (likely auth transition):', error.message);
  });
}

function updateChatBadge(count) {
  ['chatUnreadCount', 'chatUnreadCountMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = count > 0 ? 'inline' : 'none';
    el.textContent = count;
  });
}