// ═══════════════════════════════════════════════════════════════
// Firebase Integration Script
// 【1】Firebase初期設定 【2】Google認証 【3】Firestore操作
// ═══════════════════════════════════════════════════════════════

// 診断ログ
console.log('✅ firebase-integration.js 読み込み開始');
console.log('Firebase オブジェクト存在:', typeof window.firebase !== 'undefined');
console.log('firebase.apps:', typeof window.firebase !== 'undefined' ? window.firebase.apps.length : 'N/A');

// 追加の診断
setTimeout(() => {
  console.log('=== 5秒後の診断 ===');
  console.log('firebase:', typeof window.firebase);
  console.log('firebase.apps.length:', typeof window.firebase !== 'undefined' ? window.firebase.apps.length : 'N/A');
}, 5000);

const firebaseConfig = {
  apiKey: "AIzaSyBjuoIbzbxe4jZVw7tUXcXECnP3824vREo",
  authDomain: "tango-c36c0.firebaseapp.com",
  projectId: "tango-c36c0",
  storageBucket: "tango-c36c0.firebasestorage.app",
  messagingSenderId: "585521402157",
  appId: "1:585521402157:web:c35c6d8dae4bea057c03a4",
  measurementId: "G-1FY7HZ1JLE"
};

let auth = null;
let db = null;
let currentUser = null;

/**
 * Firebase を初期化（遅延実行・1回のみ）
 */
async function initializeFirebase() {
  // 既に初期化済みならスキップ
  if (auth !== null && db !== null) {
    console.log('✅ Firebase 既に初期化済み（スキップ）');
    return true;
  }

  // Firebase SDK が読み込まれるまで待機（最大 3秒 - 短縮）
  console.log('⏳ Firebase SDK の読み込みを待機中...');
  let attempts = 0;
  const maxAttempts = 30; // 3秒（100ms × 30）
  while (typeof firebase === 'undefined' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (typeof firebase === 'undefined') {
    console.warn('⚠️  Firebase SDK が利用できません（ゲストモードで続行）');
    return false;
  }

  console.log(`✅ Firebase SDK 検出！（${attempts * 100}ms後）`);
  
  try {
    if (firebase.apps.length === 0) {
      console.log('🚀 firebase.initializeApp() 実行中...');
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('✅ Firebase 初期化完了');
    return true;
  } catch (error) {
    console.error('❌ Firebase 初期化失敗:', error.message);
    return false;
  }
}

/**
 * Google でログイン
 */
async function loginWithGoogle() {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) {
      const msg = '❌ Firebase が利用できません。ゲストモードでご利用ください。\n（実ブラウザで確認してください）';
      console.error(msg);
      alert(msg);
      throw new Error('Firebase 初期化失敗');
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    currentUser = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email,
      photoURL: user.photoURL
    };

    console.log('✅ Google ログイン成功');
    return currentUser;
  } catch (error) {
    console.error('❌ Google ログイン失敗:', error.message);
    throw error;
  }
}

/**
 * ログアウト
 */
async function logout() {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');
    
    await auth.signOut();
    currentUser = null;
    console.log('✅ ログアウト成功');
  } catch (error) {
    console.error('❌ ログアウト失敗:', error.message);
    throw error;
  }
}

/**
 * ログイン状態を監視
 */
function onAuthStateChangedListener(callback) {
  (async () => {
    const initialized = await initializeFirebase();
    if (!initialized) {
      console.error('❌ Firebase 初期化失敗');
      callback(null);
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email,
          photoURL: user.photoURL
        };
        console.log('✅ ユーザーがログイン中');
        callback(currentUser);
      } else {
        currentUser = null;
        console.log('⚠️ ユーザーはログアウト状態');
        callback(null);
      }
    });
  })();
}

/**
 * 単語をクラウドに保存
 */
async function saveWordToCloud(uid, wordData) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');

    await db.collection('users').doc(uid).collection('words').doc(String(wordData.id)).set(wordData, { merge: true });
    console.log(`✅ 単語 ID:${wordData.id} をクラウドに保存`);
  } catch (error) {
    console.error('❌ 単語保存失敗:', error.message);
    throw error;
  }
}

/**
 * 複数の単語をバッチ保存
 */
async function saveWordsToCloudBatch(uid, wordsData) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');

    const batch = db.batch();
    wordsData.forEach(wordData => {
      if (wordData && wordData.id) {
        const wordRef = db.collection('users').doc(uid).collection('words').doc(String(wordData.id));
        batch.set(wordRef, wordData, { merge: true });
      }
    });
    await batch.commit();
    console.log(`✅ ${wordsData.length}個の単語をバッチ保存`);
  } catch (error) {
    console.error('❌ バッチ保存失敗:', error.message);
    throw error;
  }
}

/**
 * クラウドから単語を取得（リアルタイム監視）
 */
function loadWordsFromCloudRealtime(uid, callback) {
  (async () => {
    try {
      const initialized = await initializeFirebase();
      if (!initialized) throw new Error('Firebase 初期化失敗');

      const unsubscribe = db
        .collection('users')
        .doc(uid)
        .collection('words')
        .orderBy('id', 'asc')
        .onSnapshot((snapshot) => {
          const words = [];
          snapshot.forEach((doc) => {
            words.push(doc.data());
          });
          callback(words);
        }, (error) => {
          console.error('❌ リアルタイム監視エラー:', error.message);
        });

      return unsubscribe;
    } catch (error) {
      console.error('❌ リアルタイム監視開始失敗:', error.message);
    }
  })();
}

/**
 * クラウドから単語を取得（一括取得）
 */
async function loadWordsFromCloud(uid) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');

    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('words')
      .orderBy('id', 'asc')
      .get();

    const words = [];
    snapshot.forEach((doc) => {
      words.push(doc.data());
    });

    console.log(`✅ クラウドから ${words.length} 個の単語を取得`);
    return words;
  } catch (error) {
    console.error('❌ 単語読み込み失敗:', error.message);
    throw error;
  }
}

/**
 * クラウドから単語を削除
 */
async function deleteWordFromCloud(uid, wordId) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');

    await db.collection('users').doc(uid).collection('words').doc(String(wordId)).delete();
    console.log(`✅ 単語 ID:${wordId} を削除`);
  } catch (error) {
    console.error('❌ 単語削除失敗:', error.message);
    throw error;
  }
}

/**
 * 全単語データをクラウドに同期
 */
async function syncAllWordsToCloud(uid, localWordStats) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) throw new Error('Firebase 初期化失敗');

    const batch = db.batch();
    const wordsRef = db.collection('users').doc(uid).collection('words');

    Object.entries(localWordStats).forEach(([key, stats]) => {
      const [wordId, direction] = key.split('_');
      const docRef = wordsRef.doc(wordId);
      batch.set(docRef, {
        id: parseInt(wordId),
        direction,
        attempts: stats.attempts || 0,
        misses: stats.misses || 0,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    });

    await batch.commit();
    console.log('✅ 全単語をクラウドに同期');
  } catch (error) {
    console.error('❌ 同期失敗:', error.message);
    throw error;
  }
}

/**
 * 👑 ランキングに自分のスコアを送信する
 */
async function saveScoreToLeaderboard(stats) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized || !currentUser) return; // ログインしていない場合はスキップ

    const ref = db.collection('leaderboard').doc(currentUser.uid);
    await ref.set({
      uid: currentUser.uid,
      displayName: currentUser.displayName || '名無しユーザー',
      email: currentUser.email, // ご要望のメアドを保存
      learned: stats.learned || 0,
      totalAnswers: stats.totalAnswers || 0,
      accuracy: stats.accuracy || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp() // サーバーの正確な時間
    }, { merge: true });

    console.log('✅ ランキングデータをクラウドに送信しました');
  } catch (error) {
    console.error('❌ ランキング送信失敗:', error);
  }
}

/**
 * 👑 全体のトップランキングを取得する
 */
async function getGlobalLeaderboardFromCloud(limitCount = 10) {
  try {
    const initialized = await initializeFirebase();
    if (!initialized) return [];

    // ⚠️ 複合インデックスエラーを避けるため、「learned（覚えた数）」のみでソートします
    const snapshot = await db.collection('leaderboard')
      .orderBy('learned', 'desc')
      .limit(limitCount)
      .get();

    const globalBoard = [];
    snapshot.forEach(doc => {
      globalBoard.push(doc.data());
    });

    console.log(`✅ クラウドからトップ ${globalBoard.length} 名のランキングを取得しました`);
    return globalBoard;
  } catch (error) {
    console.error('❌ ランキング取得失敗:', error);
    return [];
  }
}

// 追加した関数をグローバルにエクスポート（ファイルの最後に追加）
window.saveScoreToLeaderboard = saveScoreToLeaderboard;
window.getGlobalLeaderboardFromCloud = getGlobalLeaderboardFromCloud;

// グローバルスコープにエクスポート
window.initializeFirebase = initializeFirebase;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.onAuthStateChangedListener = onAuthStateChangedListener;
window.saveWordToCloud = saveWordToCloud;
window.saveWordsToCloudBatch = saveWordsToCloudBatch;
window.loadWordsFromCloud = loadWordsFromCloud;
window.loadWordsFromCloudRealtime = loadWordsFromCloudRealtime;
window.deleteWordFromCloud = deleteWordFromCloud;
window.syncAllWordsToCloud = syncAllWordsToCloud;

Object.defineProperty(window, 'currentUser', {
  get: () => currentUser,
  set: (value) => { currentUser = value; }
});

console.log('✅ firebase-integration.js 読み込み完了');
console.log('  - initializeFirebase: ', typeof window.initializeFirebase);
console.log('  - loginWithGoogle: ', typeof window.loginWithGoogle);
console.log('  - onAuthStateChangedListener: ', typeof window.onAuthStateChangedListener);

