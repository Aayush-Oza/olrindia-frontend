/* ============================================================
   OLR INDIA - FIREBASE CONFIGURATION
   Loads Firebase via CDN. Exposes auth (Google sign-in + chat
   custom-token sign-in) and Firestore functions on window so
   plain JS files (chat.js, user-auth.js, etc.) can use them.
   ============================================================ */

(async function () {
  const { initializeApp } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const {
    getAuth, signInWithPopup, GoogleAuthProvider,
    signInWithCustomToken, onAuthStateChanged
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
    updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyBHYNKVuTDHExhW7ONj3KIIkw2moQf-LxE",
    authDomain: "olrindia-42b50.firebaseapp.com",
    projectId: "olrindia-42b50",
    storageBucket: "olrindia-42b50.firebasestorage.app",
    messagingSenderId: "815260429613",
    appId: "1:815260429613:web:2829728d7166cfeadab7a4",
    measurementId: "G-WLV26ZHL9X"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  // ── Google Sign-In (unchanged) ────────────────────────────────
  window.signInWithGoogle = async function () {
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return idToken;
    } catch (err) {
      if (
        err.code === "auth/popup-closed-by-user" ||
        err.code === "auth/cancelled-popup-request"
      ) {
        return null;
      }
      console.error("[Firebase] Google sign-in error:", err.message);
      return null;
    }
  };

  // ── Chat: sign into Firebase using our backend-minted custom token ──
  window.signInFirebaseWithCustomToken = async function (customToken) {
    try {
      await signInWithCustomToken(auth, customToken);
      return true;
    } catch (err) {
      console.error("[Firebase] Custom token sign-in error:", err.message);
      return false;
    }
  };

  window.getFirebaseCurrentUser = function () {
    return auth.currentUser;
  };
  window.getFirebaseAuthInstance = function () { return auth; };

  // ── Expose Firestore + fn's for chat.js ─────────────────────────
  window.db = db;
  window.fsCollection = collection;
  window.fsDoc = doc;
  window.fsGetDoc = getDoc;
  window.fsGetDocs = getDocs;
  window.fsSetDoc = setDoc;
  window.fsAddDoc = addDoc;
  window.fsUpdateDoc = updateDoc;
  window.fsQuery = query;
  window.fsWhere = where;
  window.fsOrderBy = orderBy;
  window.fsOnSnapshot = onSnapshot;
  window.fsServerTimestamp = serverTimestamp;
  window.fsLimit = limit;

  window.firebaseReady = true;
  console.log("[Firebase] Ready (auth + firestore)");
})();