// ==========================================
// firebase-integration.js
// プレイヤー管理 & ランキング管理 データベース通信用
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
let currentUser = null;

// Firebaseの初期化
async function initializeFirebase() {
  if (!window.firebase) {
    console.error("Firebase SDKが読み込まれていません");
    return false;
  }
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  auth = firebase.auth();
  db = firebase.firestore();
  console.log("✅ Firebase & Firestore 初期化完了");
  return true;
}

// 認証状態の監視
function onAuthStateChangedListener(callback) {
  if (!auth) return;
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      // ログイン時に「プレイヤーDB（users）」に基本情報を保存・更新
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

// Googleログイン
async function loginWithGoogle() {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error("Firebase初期化失敗");
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("❌ ログインエラー:", error);
    alert("ログインに失敗しました: " + error.message);
  }
}

// ログアウト
async function logout() {
  if (auth) await auth.signOut();
}

// 👑 ランキング管理用DB（leaderboard）へスコアを送信
async function saveScoreToLeaderboard(stats) {
  if (!db || !currentUser) return;
  try {
    const ref = db.collection('leaderboard').doc(currentUser.uid);
    await ref.set({
      uid: currentUser.uid,
      displayName: currentUser.displayName || '名無しユーザー',
      email: currentUser.email,
      learned: stats.learned || 0,
      totalAnswers: stats.totalAnswers || 0,
      accuracy: stats.accuracy || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('✅ ランキングをクラウドに送信しました');
  } catch (error) {
    console.error('❌ ランキング送信失敗:', error);
  }
}

// 👑 ランキング管理用DB（leaderboard）からトップ層を取得
async function getGlobalLeaderboardFromCloud(limitCount = 10) {
  if (!db) return [];
  try {
    const snapshot = await db.collection('leaderboard')
      .orderBy('learned', 'desc')
      .limit(limitCount)
      .get();

    const globalBoard = [];
    snapshot.forEach(doc => {
      globalBoard.push(doc.data());
    });
    return globalBoard;
  } catch (error) {
    console.error('❌ ランキング取得エラー:', error);
    return [];
  }
}

// グローバルスコープにエクスポート
window.initializeFirebase = initializeFirebase;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.onAuthStateChangedListener = onAuthStateChangedListener;
window.saveScoreToLeaderboard = saveScoreToLeaderboard;
window.getGlobalLeaderboardFromCloud = getGlobalLeaderboardFromCloud;