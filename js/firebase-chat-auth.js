// Signs the current user/vendor into Firebase (needed for Firestore chat).
// Uses modular SDK functions exposed by firebase-config.js
let firebaseChatReady = false;

async function ensureFirebaseChatAuth(role) {
  // Wait for firebase-config.js to finish loading
  for (let i = 0; i < 20; i++) {
    if (window.firebaseReady) break;
    await new Promise(r => setTimeout(r, 150));
  }
  if (!window.firebaseReady) {
    toastError('Could not connect to chat. Please refresh.');
    return false;
  }

  if (firebaseChatReady && window.getFirebaseCurrentUser()) return true;

  const res = await apiRequest(`/auth/${role}/firebase-token`, 'POST');
  if (!res.success) {
    toastError('Could not connect to chat. Please refresh.');
    return false;
  }

  try {
    const ok = await window.signInFirebaseWithCustomToken(res.firebase_token);
    if (!ok) throw new Error('signInWithCustomToken returned false');
    firebaseChatReady = true;
    return true;
  } catch (err) {
    console.error('Firebase chat auth failed:', err);
    toastError('Could not connect to chat. Please refresh.');
    return false;
  }
}