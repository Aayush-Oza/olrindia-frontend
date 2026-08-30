/* ============================================================
   OLR INDIA - CHAT UI
   Renders the chat overlay (list + thread), built on top of
   chat.js's Firestore engine. Include AFTER firebase-config.js,
   api.js, helpers.js, and chat.js.
   ============================================================ */

let chatUnsubList = null;

let chatContext = 'dashboard'; // 'dashboard' (default) or 'product' - set by p.js

function openChatOverlay() {
  stopChatListeners();
  document.getElementById('chatOverlay').classList.add('open');
  document.getElementById('chatThreadView').classList.remove('active');
}

function closeChatOverlay() {
  document.getElementById('chatOverlay').classList.remove('open');
  stopChatListeners();
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function backToChatList() {
  document.querySelector('.dash-nav').style.display = '';
  document.getElementById('panel-chat')?.classList.remove('thread-open');
  document.getElementById('panel-chats')?.classList.remove('thread-open');
  document.getElementById('chatThreadView').classList.remove('active');
  stopChatListeners();

  if (chatContext === 'product') {
    // No inbox makes sense on a single product page - just return to it
    closeChatOverlay();
    return;
  }

  const tabName = chatRole === 'vendor' ? 'chats' : 'chat';
  history.replaceState(null, '', '#' + tabName);
  renderChatList();
}

// ── Render conversation list ─────────────────────────────────
function renderChatList() {
  const body = document.getElementById('chatListBody');

  listenToMyConversations(convos => {
    renderChatListItems(convos, body);
  });
}

function renderChatListItems(convos, body) {
  if (!convos.length) {
    body.innerHTML = `
      <div class="chat-empty-state">
        <div class="icon">💬</div>
        <h3>No conversations yet</h3>
        <p>${chatRole === 'user' ? 'Chat with a vendor from any product page.' : 'Conversations from interested users will show up here.'}</p>
      </div>`;
    return;
  }

  body.innerHTML = convos.map(c => {
    const isUserSide = chatRole === 'user';
    const otherName = isUserSide ? (c.vendor_name || 'Vendor') : (c.user_name || 'User');
    const otherPhoto = isUserSide ? c.vendor_photo : c.user_photo;
    const unread = isUserSide ? (c.unread_count_user || 0) : (c.unread_count_vendor || 0);
    const initials = getInitials(otherName);
    const avatarHTML = otherPhoto
      ? `<img src="${otherPhoto}" alt="${otherName}">`
      : `<span>${initials}</span>`;
    const timeStr = formatChatTime(c.last_message_at);

    return `
      <div class="chat-list-item" onclick="openThread('${c.id}')">
        <div class="chat-list-avatar">${avatarHTML}</div>
        <div class="chat-list-info">
          <div class="chat-list-name-row">
            <span class="chat-list-name">${otherName}</span>
            <span class="chat-list-time">${timeStr}</span>
          </div>
          <div class="chat-list-last-row">
            <div class="chat-list-last-col">
              <div class="chat-list-last-msg">${c.last_message || 'Say hi 👋'}</div>
              ${c.current_product_name ? `<div class="chat-list-product">📦 ${c.current_product_name}</div>` : ''}
            </div>
            ${unread > 0 ? `<span class="chat-list-unread-badge">${unread}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function formatChatTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

// ── Open a DM thread ─────────────────────────────────────────
let currentThreadConvo = null;

async function openThread(convId) {
  if (window.innerWidth < 768) {
    const dashNav = document.querySelector('.dash-nav');
    if (dashNav) dashNav.style.display = 'none';
  }
  document.getElementById('panel-chat')?.classList.add('thread-open');
  document.getElementById('panel-chats')?.classList.add('thread-open');
  activeConvId = convId;
  const tabName = chatRole === 'vendor' ? 'chats' : 'chat';
  history.replaceState(null, '', '#' + tabName + '=' + convId);
  document.getElementById('chatThreadView').classList.add('active');
  document.getElementById('chatThreadBody').innerHTML = '';

  listenToConversation(convId, (convo) => {
    currentThreadConvo = convo;
    renderThreadHeader(convo);
  });

  listenToMessages(convId, (messages) => {
    renderThreadMessages(messages);
    markMessagesSeen(convId, messages);
  });
}

function renderThreadHeader(convo) {
  const isUserSide = chatRole === 'user';
  const otherName = isUserSide ? (convo.vendor_name || 'Vendor') : (convo.user_name || 'User');
  const otherPhoto = isUserSide ? convo.vendor_photo : convo.user_photo;
  const otherTyping = isUserSide ? convo.vendor_typing : convo.user_typing;

  document.getElementById('chatThreadAvatar').innerHTML = otherPhoto
    ? `<img src="${otherPhoto}" alt="${otherName}">`
    : `<span>${getInitials(otherName)}</span>`;
  document.getElementById('chatThreadName').textContent = otherName;

  const statusEl = document.getElementById('chatThreadStatus');
  if (otherTyping) {
    statusEl.textContent = 'typing…';
    statusEl.classList.add('typing');
  } else {
    statusEl.textContent = '';
    statusEl.classList.remove('typing');
  }
}

function renderThreadMessages(messages) {
  const body = document.getElementById('chatThreadBody');
  const wasNearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;

  let lastDate = null;
  let lastProductId = null;
  let html = '';

  messages.forEach(m => {
    const date = m.created_at?.toDate ? m.created_at.toDate() : (m.created_at ? new Date(m.created_at) : new Date());
    const dateStr = date.toDateString();
    if (dateStr !== lastDate) {
      html += `<div class="chat-date-divider">${formatChatDateDivider(date)}</div>`;
      lastDate = dateStr;
    }

    if (m.product_id && m.product_id !== lastProductId) {
      html += `<div class="chat-date-divider">📦 About: ${escapeHtml(m.product_name || 'a product')}</div>`;
      lastProductId = m.product_id;
    }

    const mine = m.sender_role === chatRole;
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tick = mine ? renderTick(m.status) : '';

    html += `
      <div class="chat-bubble-row ${mine ? 'mine' : 'theirs'}">
        <div class="chat-bubble">
          ${escapeHtml(m.text)}
          <div class="chat-bubble-meta">
            <span>${timeStr}</span>
            ${tick}
          </div>
        </div>
      </div>`;
  });

  body.innerHTML = html;
  if (wasNearBottom || true) {
    body.scrollTop = body.scrollHeight;
  }
}

function renderTick(status) {
  const seenClass = status === 'seen' ? 'seen' : '';
  return `<span class="chat-tick ${seenClass}">
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M1 5.5 4.5 9 11 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${status === 'seen' ? '<path d="M5 5.5 8.5 9 15 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
    </svg>
  </span>`;
}

function formatChatDateDivider(date) {
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Input bar: send + typing ─────────────────────────────────
const chatInputEl = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

chatInputEl?.addEventListener('input', () => {
  // Text/numbers only - strip anything else as they type (no attachments, no weird chars)
  if (activeConvId) notifyTyping(activeConvId);
});

chatInputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendFromInput();
  }
});

chatSendBtn?.addEventListener('click', sendFromInput);

async function sendFromInput() {
  const text = chatInputEl.value.trim();
  if (!text || !activeConvId) return;
  chatInputEl.value = '';
  await sendChatMessage(activeConvId, text);
}
// ── Safety cleanup on page unload ──────────────────────────────
window.addEventListener('beforeunload', () => {
  stopChatListeners();
  if (chatUnsubList) chatUnsubList();
});