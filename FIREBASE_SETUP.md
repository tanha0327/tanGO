# Firebase 統合ガイド

このドキュメントでは、単語復習アプリに Firebase を統合するための手順を説明します。

---

## 📋 準備

1. **Firebase プロジェクト作成**
   - [Firebase コンソール](https://console.firebase.google.com/) にアクセス
   - 新規プロジェクトを作成
   - Google 認証を有効化
   - Cloud Firestore を有効化

2. **firebaseConfig 取得**
   - Firebase コンソール → プロジェクト設定 → アプリを追加 → Web
   - 表示される config 情報をコピー

---

## 🔧 【ステップ1】Firebase SDK の有効化

`単語復習アプリ設計.html` の `<head>` セクションで、以下のコメント行を **コメント解除**：

```html
<!-- Firebase SDK - 【コメントを外して使用】 -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js"></script>

<!-- Firebase Integration Script - 【コメントを外して使用】 -->
<script src="firebase-integration.js"></script>
```

---

## 🔑 【ステップ2】firebaseConfig を設定

`firebase-integration.js` を開いて、以下を自分の config 情報に置き換え：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBjuoIbzbxe4jZVw7tUXcXECnP3824vREo",
  authDomain: "tango-c36c0.firebaseapp.com",
  projectId: "tango-c36c0",
  storageBucket: "tango-c36c0.firebasestorage.app",
  messagingSenderId: "585521402157",
  appId: "1:585521402157:web:c35c6d8dae4bea057c03a4",
  measurementId: "G-1FY7HZ1JLE"
};

```

---

## 📚 使用可能な関数一覧

### 【1】認証関連

#### `loginWithGoogle()`
Google ポップアップログイン
```javascript
const user = await loginWithGoogle();
// user: { uid, displayName, email, photoURL }
```

#### `logout()`
ログアウト
```javascript
await logout();
```

#### `onAuthStateChangedListener(callback)`
ログイン状態を監視（初期化時に呼び出す）
```javascript
onAuthStateChangedListener((user) => {
  if (user) {
    console.log('ログイン中:', user.displayName);
  } else {
    console.log('ログアウト中');
  }
});
```

#### `currentUser`
現在のユーザー情報（グローバル変数）
```javascript
if (currentUser) {
  console.log('UID:', currentUser.uid);
  console.log('名前:', currentUser.displayName);
}
```

---

### 【2】Firestore 操作（単語データ）

#### `saveWordToCloud(uid, wordData)`
単語1つを保存・更新
```javascript
await saveWordToCloud(currentUser.uid, {
  id: 1,
  en: "apple",
  jp: "りんご",
  attempts: 5,
  misses: 1
});
```

#### `saveWordsToCloudBatch(uid, wordsData)`
複数の単語をバッチ保存（高速）
```javascript
await saveWordsToCloudBatch(currentUser.uid, [
  { id: 1, en: "apple", jp: "りんご" },
  { id: 2, en: "banana", jp: "バナナ" }
]);
```

#### `loadWordsFromCloud(uid)`
ユーザーの全単語をクラウドから取得（一括）
```javascript
const words = await loadWordsFromCloud(currentUser.uid);
console.log('取得した単語数:', words.length);
```

#### `loadWordsFromCloudRealtime(uid, callback)`
ユーザーの全単語をリアルタイム監視
```javascript
const unsubscribe = loadWordsFromCloudRealtime(currentUser.uid, (words) => {
  console.log('データ更新:', words);
  // UI を更新
});

// リスナーを削除したい場合
unsubscribe();
```

#### `deleteWordFromCloud(uid, wordId)`
特定の単語を削除
```javascript
await deleteWordFromCloud(currentUser.uid, 1);
```

#### `syncAllWordsToCloud(uid, localWordStats)`
ローカルの wordStats 全体をクラウドに同期
```javascript
await syncAllWordsToCloud(currentUser.uid, wordStats);
```

---

## 🔐 Cloud Firestore セキュリティルール設定

以下のセキュリティルールを Firebase コンソール → Firestore → ルール に設定：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみアクセス可能
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      
      match /words/{document=**} {
        allow read, write: if request.auth.uid == uid;
      }
    }
  }
}
```

---

## 💾 データ構造

```
Firestore Collection:
users/
  {ユーザーUID}/
    words/
      1/  { id: 1, en: "apple", jp: "りんご", attempts: 5, misses: 1, ... }
      2/  { id: 2, en: "banana", jp: "バナナ", ... }
      ...
```

---

## 📱 統合例

アプリの initApp() 関数内で以下のように統合：

```javascript
async function initApp() {
  // 既存の init()
  await init();
  
  // Firebase ログイン状態の監視
  onAuthStateChangedListener(async (user) => {
    if (user && !isGuest) {
      // ログイン中：クラウドから単語を読み込み
      try {
        const cloudWords = await loadWordsFromCloud(user.uid);
        // ローカルデータとマージ
        mergeCloudWordsWithLocal(cloudWords);
      } catch (error) {
        console.error('クラウドから単語読み込み失敗:', error);
      }
    }
  });
  
  updateStats();
  updateLeaderboardAccess();
  updateRangeSliders();
  // ...
}
```

---

## ⚠️ トラブルシューティング

### エラー: "Firebase is not defined"
- Firebase SDK がコメント解除されているか確認
- `<script>` タグの順番が正しいか確認（SDK の後に firebase-integration.js）

### エラー: "Firebase config is invalid"
- firebaseConfig の値が正しいか確認
- Firebase コンソールから最新の値をコピーしたか確認

### Google ログインがポップアップされない
- Google OAuth 認証が Firebase コンソールで有効化されているか確認
- localhost でテストする場合、「認可済みドメイン」に `localhost` を追加

### Firestore に データが保存されない
- ユーザーが認証済みか確認（currentUser が null でないか）
- Firestore のセキュリティルールが正しいか確認

---

## 📖 関連リンク

- [Firebase ドキュメント](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Firebase セキュリティ](https://firebase.google.com/docs/firestore/security/start)
