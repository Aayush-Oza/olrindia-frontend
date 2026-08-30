// Signs the current user/vendor into Firebase (needed for Firestore chat).
// Call this once per session before opening any chat UI.
let firebaseChatReady = false;

async function ensureFirebaseChatAuth(role) {
  if (firebaseChatReady && firebase.auth().currentUser) return true;

  const res = await apiRequest(`/auth/${role}/firebase-token`, 'POST');
  if (!res.success) {
    toastError('Could not connect to chat. Please refresh.');
    return false;
  }

  try {
    await firebase.auth().signInWithCustomToken(res.firebase_token);
    firebaseChatReady = true;
    return true;
  } catch (err) {
    console.error('Firebase chat auth failed:', err);
    toastError('Could not connect to chat. Please refresh.');
    return false;
  }
}