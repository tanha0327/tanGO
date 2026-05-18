// ═══════════════════════════════════════════════════════════════
// 【1】Firebase初期設定コード
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBjuoIbzbxe4jZVw7tUXcXECnP3824vREo",
  authDomain: "tango-c36c0.firebaseapp.com",
  projectId: "tango-c36c0",
  storageBucket: "tango-c36c0.firebasestorage.app",
  messagingSenderId: "585521402157",
  appId: "1:585521402157:web:c35c6d8dae4bea057c03a4",
  measurementId: "G-1FY7HZ1JLE"
};

// Firebase を初期化
firebase.initializeApp(firebaseConfig);

// Firebase サービスの参照
const auth = firebase.auth();
const db = firebase.firestore();

// ═══════════════════════════════════════════════════════════════
// 【2】Firebase Authentication - Google ログイン
// ═══════════════════════════════════════════════════════════════

let currentUser = null;

/**
 * Google ポップアップログイン
 * @returns {Promise<Object>} ユーザー情報 {uid, displayName, email, photoURL}
 */
async function loginWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    currentUser = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email,
      photoURL: user.photoURL
    };
    
    console.log('✅ Google ログイン成功:', currentUser);
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
    await auth.signOut();
    currentUser = null;
    console.log('✅ ログアウト成功');
  } catch (error) {
    console.error('❌ ログアウト失敗:', error.message);
    throw error;
  }
}

/**
 * ログイン状態を監視（初期化時に1回実行）
 * @param {Function} callback - ログイン状態が変わった時に呼ばれる関数
 */
function onAuthStateChangedListener(callback) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = {
        uid: user.uid,
        displayName: user.displayName || 'User',
        email: user.email,
        photoURL: user.photoURL
      };
      console.log('✅ ユーザーがログイン中:', currentUser);
      callback(currentUser);
    } else {
      currentUser = null;
      console.log('⚠️ ユーザーはログアウト状態');
      callback(null);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 【3】Cloud Firestore - 単語データの保存と取得
// ═══════════════════════════════════════════════════════════════

/**
 * クラウドに単語を追加・更新
 * @param {string} uid - ユーザーUID
 * @param {Object} wordData - 単語データ
 *   例: { id: 1, en: "apple", jp: "りんご", attempts: 5, misses: 1 }
 * @returns {Promise<void>}
 */
async function saveWordToCloud(uid, wordData) {
  try {
    if (!uid) throw new Error('ユーザーUID が指定されていません');
    if (!wordData || !wordData.id) throw new Error('単語データが不正です');
    
    const wordRef = db.collection('users').doc(uid).collection('words').doc(String(wordData.id));
    await wordRef.set(wordData, { merge: true });
    
    console.log(`✅ 単語 ID:${wordData.id} をクラウドに保存しました`);
  } catch (error) {
    console.error('❌ 単語保存失敗:', error.message);
    throw error;
  }
}

/**
 * 複数の単語をバッチで保存
 * @param {string} uid - ユーザーUID
 * @param {Array<Object>} wordsData - 単語データの配列
 * @returns {Promise<void>}
 */
async function saveWordsToCloudBatch(uid, wordsData) {
  try {
    if (!uid) throw new Error('ユーザーUID が指定されていません');
    if (!Array.isArray(wordsData)) throw new Error('単語配列が指定されていません');
    
    const batch = db.batch();
    
    wordsData.forEach(wordData => {
      if (wordData && wordData.id) {
        const wordRef = db.collection('users').doc(uid).collection('words').doc(String(wordData.id));
        batch.set(wordRef, wordData, { merge: true });
      }
    });
    
    await batch.commit();
    console.log(`✅ ${wordsData.length}個の単語をバッチ保存しました`);
  } catch (error) {
    console.error('❌ バッチ保存失敗:', error.message);
    throw error;
  }
}

/**
 * クラウドからユーザーの単語一覧を取得（リアルタイム監視）
 * @param {string} uid - ユーザーUID
 * @param {Function} callback - データが更新された時に呼ばれる関数(words配列を受け取る)
 * @returns {Function} リスナー削除用の関数
 */
function loadWordsFromCloudRealtime(uid, callback) {
  try {
    if (!uid) throw new Error('ユーザーUID が指定されていません');
    
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
        console.log(`✅ クラウドから ${words.length} 個の単語を読み込みました`);
        callback(words);
      }, (error) => {
        console.error('❌ リアルタイム監視エラー:', error.message);
      });
    
    return unsubscribe; // リスナーを削除したい時は unsubscribe() を呼ぶ
  } catch (error) {
    console.error('❌ リアルタイム監視開始失敗:', error.message);
    throw error;
  }
}

/**
 * クラウドからユーザーの単語一覧を取得（一括取得）
 * @param {string} uid - ユーザーUID
 * @returns {Promise<Array>} 単語データの配列
 */
async function loadWordsFromCloud(uid) {
  try {
    if (!uid) throw new Error('ユーザーUID が指定されていません');
    
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
    
    console.log(`✅ クラウドから ${words.length} 個の単語を読み込みました`);
    return words;
  } catch (error) {
    console.error('❌ 単語読み込み失敗:', error.message);
    throw error;
  }
}

/**
 * クラウドから特定の単語を削除
 * @param {string} uid - ユーザーUID
 * @param {number} wordId - 単語ID
 * @returns {Promise<void>}
 */
async function deleteWordFromCloud(uid, wordId) {
  try {
    if (!uid || !wordId) throw new Error('ユーザーUID と単語ID が必要です');
    
    await db.collection('users').doc(uid).collection('words').doc(String(wordId)).delete();
    console.log(`✅ 単語 ID:${wordId} をクラウドから削除しました`);
  } catch (error) {
    console.error('❌ 単語削除失敗:', error.message);
    throw error;
  }
}

/**
 * ユーザーの全単語データをクラウドにシンク
 * @param {string} uid - ユーザーUID
 * @param {Object} localWordStats - ローカルの単語統計データ（wordStats）
 * @returns {Promise<void>}
 */
async function syncAllWordsToCloud(uid, localWordStats) {
  try {
    if (!uid) throw new Error('ユーザーUID が指定されていません');
    
    const batch = db.batch();
    const wordsRef = db.collection('users').doc(uid).collection('words');
    
    // ローカルデータをクラウドに同期
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
    console.log('✅ すべての単語をクラウドに同期しました');
  } catch (error) {
    console.error('❌ 同期失敗:', error.message);
    throw error;
  }
}

// HTMLのボタン(onclick)から直接呼び出せるように、窓口を完全に開放します
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.onAuthStateChangedListener = onAuthStateChangedListener;

// ═══════════════════════════════════════════════════════════════
// エクスポート（必要に応じて）
// ═══════════════════════════════════════════════════════════════

// 使用例：
// await loginWithGoogle();
// const unsubscribe = loadWordsFromCloudRealtime(currentUser.uid, (words) => {
//   console.log('単語データ更新:', words);
// });
// await saveWordToCloud(currentUser.uid, { id: 1, en: 'apple', jp: 'りんご' });
// const words = await loadWordsFromCloud(currentUser.uid);
