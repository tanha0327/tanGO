// ==========================================
// firebase-integration.js (v10: 確実に待つ仕様)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBjuoIbzbxe4jZVw7tUXcXECnP3824vREo",
  authDomain: "tango-c36c0.firebaseapp.com",
  projectId: "tango-c36c0",
  storageBucket: "tango-c36c0.firebasestorage.app",
  messagingSenderId: "585521402157",
  appId: "1:585521402157:web:c35c6d8dae4bea057c03a4",
  measurementId: "G-1FY7HZ1JLE"
};

let app, auth, db;
let initPromise = null;

// Firebase初期化を一度だけ実行し、結果を保持する
async function initializeFirebase() {
  if (initPromise) return initPromise; // すでに初期化中なら待つ

  initPromise = (async () => {
    if (!window.firebase) throw new Error("Firebase SDK 未読み込み");
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    auth = firebase.auth();
    db = firebase.firestore();
    
    // リダイレクト結果の処理
    try { await auth.getRedirectResult(); } catch(e) {}
    
    console.log("✅ Firebase & Firestore 準備完了");
    return true;
  })();
  
  return initPromise;
}

// 読み込みを待ってから認証状態を監視
async function onAuthStateChangedListener(callback) {
  await initializeFirebase();
  auth.onAuthStateChanged((user) => {
    if (user && db) {
      db.collection('users').doc(user.uid).set({
        uid: user.uid,
        displayName: user.displayName || '名無し',
        email: user.email,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    callback(user);
  });
}

// 読み込みを待ってからログイン
async function loginWithGoogle() {
  await initializeFirebase();
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithRedirect(provider);
}

function logout() {
  if (auth) auth.signOut().then(() => window.location.reload());
}

// 👑 ランキング (読み込みを待ってから)
async function saveScoreToLeaderboard(stats) {
  await initializeFirebase();
  if (!db || !auth.currentUser) return;
  await db.collection('leaderboard').doc(auth.currentUser.uid).set({
    uid: auth.currentUser.uid,
    displayName: auth.currentUser.displayName || '名無しユーザー',
    email: auth.currentUser.email,
    learned: stats.learned || 0,
    totalAnswers: stats.totalAnswers || 0,
    accuracy: stats.accuracy || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function getGlobalLeaderboardFromCloud(limitCount = 3) {
  await initializeFirebase();
  if (!db) return [];
  const snapshot = await db.collection('leaderboard').orderBy('learned', 'desc').limit(limitCount).get();
  return snapshot.docs.map(doc => doc.data());
}

window.initializeFirebase = initializeFirebase;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.onAuthStateChangedListener = onAuthStateChangedListener;
window.saveScoreToLeaderboard = saveScoreToLeaderboard;
window.getGlobalLeaderboardFromCloud = getGlobalLeaderboardFromCloud;