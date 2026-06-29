// ==========================================
// firebase-integration.js (リダイレクト方式・確定版)
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

let app, auth, db, currentUser;

async function initializeFirebase() {
  if (!window.firebase) return false;
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  auth = firebase.auth();
  db = firebase.firestore();
  
  // ログインの結果を確実に受け取る
  try {
    const result = await auth.getRedirectResult();
    if (result.user) {
      console.log("✅ リダイレクトからのログイン成功");
    }
  } catch (e) {
    console.error("Redirect Error:", e);
  }

  console.log("✅ Firebase & Firestore 初期化完了");
  return true;
}

function onAuthStateChangedListener(callback) {
  // ログイン状態が変わったら即座に反映
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      // ユーザー登録処理
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

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithRedirect(provider);
}

async function logout() {
  await auth.signOut();
  window.location.href = window.location.href; // ページを更新
}

// 👑 ランキング
async function saveScoreToLeaderboard(stats) {
  if (!db || !currentUser) return;
  await db.collection('leaderboard').doc(currentUser.uid).set({
    uid: currentUser.uid,
    displayName: currentUser.displayName || '名無しユーザー',
    email: currentUser.email,
    learned: stats.learned || 0,
    totalAnswers: stats.totalAnswers || 0,
    accuracy: stats.accuracy || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function getGlobalLeaderboardFromCloud(limitCount = 3) {
  if (!db) return [];
  const snapshot = await db.collection('leaderboard')
    .orderBy('learned', 'desc')
    .limit(limitCount)
    .get();
  return snapshot.docs.map(doc => doc.data());
}

window.initializeFirebase = initializeFirebase;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.onAuthStateChangedListener = onAuthStateChangedListener;
window.saveScoreToLeaderboard = saveScoreToLeaderboard;
window.getGlobalLeaderboardFromCloud = getGlobalLeaderboardFromCloud;