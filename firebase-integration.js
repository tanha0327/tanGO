// ==========================================
// Firebase設定
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBjuoIbzbxe4jZVw7tUXcXECnP3824vREo", // ⚠️必ず書き換えてください！
  authDomain: "tango-c36c0.firebaseapp.com",
  projectId: "tango-c36c0",
  storageBucket: "tango-c36c0.firebasestorage.app",
  messagingSenderId: "585521402157",
  appId: "1:585521402157:web:c35c6d8dae4bea057c03a4",
  measurementId: "G-1FY7HZ1JLE"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
console.log("✅ Firebase 準備完了 (記号クリーニング＆完全復習システム)");

// グローバル変数
let isGuest = false;
let testDate = null;
let countdownTimer = null;
let currentNickname = "";
let ALL_WORDS = [];

// 🌟 新しい周回用ユーザーデータ状態
let activeRange = "final"; 
let uCurrentRound = 1;      // 現在何周目か
let uRoundAnswers = [];     // 現在の周回で既に解いた単語IDのリスト
let uTotalAnswers = 0;      // 通算解答数（正解率用）
let uTotalCorrect = 0;      // 通算正解数（正解率用）
let uWordHistory = {};      // 各単語の{solved, wrong, reviewed}回数記録マッブ

// 🚨 エラーを直す魔法の1行（クイズの進行状態）
const state = { queue: [], current: 0, results: [] };

let isRandomMode = false; // ランダムN問用フラグ
let isReviewMode = false; // 復習モード用フラグ

// ☁️ データベース（Firestore）から単語を取得＆記号クリーニング
async function initDictionary() {
  try {
    const midDoc = await db.collection('vocabulary').doc('midterm').get();
    const finDoc = await db.collection('vocabulary').doc('final').get();

    if (midDoc.exists && finDoc.exists) {
      ALL_WORDS = [...midDoc.data().words, ...finDoc.data().words];
      console.log("☁️ Firestoreから単語データを読み込みました！");
    } else {
      ALL_WORDS = RAW.trim().split('\n').map(line => {
        const p = line.split('\t');
        return { id: parseInt(p[0], 10), en: p[1].trim(), jp: p[2].trim() };
      });
      await db.collection('vocabulary').doc('midterm').set({ title: "中間 (1401〜1541)", words: ALL_WORDS.slice(0, 141) });
      await db.collection('vocabulary').doc('final').set({ title: "期末 (1542〜1683)", words: ALL_WORDS.slice(141) });
    }

    // 🌟 ここで全単語の英語を「入力しやすい形」に一斉クリーニング！
    // 🌟 ここで全単語の英語を「入力しやすい形」に一斉クリーニング！
    ALL_WORDS.forEach(w => {
      w.en = w.en
        .replace(/\[.*?\]/g, '') // [give]などを削除
        .replace(/\(.*?\)/g, '') // (with ...)などを削除
        .replace(/〈.*?〉/g, 'someone ') // 〈人〉を someone に変換
        .replace(/[…～~・\.]/g, '') // 👈 ピリオド「.」も追加して完全抹殺！
        .replace(/\s+/g, ' ') // 連続するスペースを1つに
        .trim();
    });

  } catch(e) { console.error("単語DB初期化エラー:", e); }
}

// 🚀 画面ロード時の処理
window.onload = () => {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-container').style.display = 'block';
      
      await initDictionary();
      
      try {
        const targetDoc = await db.collection('vocabulary').doc('active_test').get();
        if (targetDoc.exists) {
          const config = targetDoc.data();
          if (config.testDate) testDate = new Date(config.testDate);
          if (config.activeRange) activeRange = config.activeRange;
        }
      } catch(e) {}
      
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          if (data.nickname) currentNickname = data.nickname;
          if (data.currentRound !== undefined) uCurrentRound = data.currentRound;
          if (data.roundAnswers !== undefined) uRoundAnswers = data.roundAnswers;
          if (data.totalAnswers !== undefined) uTotalAnswers = data.totalAnswers;
          if (data.totalCorrect !== undefined) uTotalCorrect = data.totalCorrect;
          if (data.wordHistory !== undefined) uWordHistory = data.wordHistory;
        }
      } catch(e) {}

      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.textContent = `👤 ${currentNickname || user.displayName || user.email}`;
      if (!isGuest) document.getElementById('btn-edit-nickname').style.display = 'block';

      startCountdown();
      refreshUI();
    } else if (!isGuest) {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app-container').style.display = 'none';
    }
  });
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  document.getElementById(id).classList.add('visible');
}

// 📊 画面表示の更新
function refreshUI() {
  const rangeTotal = (activeRange === 'midterm') ? 141 : 142;
  const progressPercent = Math.floor((uRoundAnswers.length / rangeTotal) * 100);
  const accuracyPercent = uTotalAnswers > 0 ? Math.round((uTotalCorrect / uTotalAnswers) * 100) : 0;
  
  document.getElementById('home-progress-text').textContent = `${uCurrentRound}周目 ${progressPercent}%`;
  document.getElementById('home-progress-count').textContent = `(${uRoundAnswers.length} / ${rangeTotal}語)`;
  document.getElementById('home-progress-bar').style.width = `${progressPercent}%`;
  document.getElementById('stat-round-count').textContent = `${uCurrentRound}周目`;
  document.getElementById('stat-accuracy').textContent = `${accuracyPercent}%`;
  document.getElementById('stat-total-solved').textContent = `${uTotalAnswers}回`;
  
  const mainBtn = document.getElementById('btn-main-study');
  if (uRoundAnswers.length === 0) {
    mainBtn.textContent = `🚀 ${uCurrentRound}周目をスタート`;
  } else {
    const remain = rangeTotal - uRoundAnswers.length;
    mainBtn.textContent = `✏️ ${uCurrentRound}周目の続きから再開 (残り${remain}問)`;
  }
  
  updateLeaderboardDisplay();

  // 要復習のカウントと色変え（wrong > reviewed のみカウント）
  if (ALL_WORDS && ALL_WORDS.length > 0) {
    const lo = (activeRange === 'midterm') ? 0 : 141;
    const hi = (activeRange === 'midterm') ? 140 : 282;
    const rangeWords = ALL_WORDS.slice(lo, hi + 1);
    
    const wrongCount = rangeWords.filter(w => {
      const h = uWordHistory[w.id];
      return h && (h.wrong || 0) > (h.reviewed || 0);
    }).length;

    const reviewNumEl = document.getElementById('stat-review-count');
    const reviewCardEl = document.getElementById('card-review');
    reviewNumEl.textContent = wrongCount;
    
    if (wrongCount > 0) {
      reviewNumEl.style.color = '#c62828';
      reviewCardEl.style.background = '#fff5f5';
      reviewCardEl.style.borderColor = '#ef9a9a';
    } else {
      reviewNumEl.style.color = '#1a1a1a';
      reviewCardEl.style.background = 'white';
      reviewCardEl.style.borderColor = '#e5e5e0';
    }
  }
}

function openRandomModal() {
  const rangeTotal = (activeRange === 'midterm') ? 141 : 142;
  const slider = document.getElementById('random-n-slider');
  slider.max = rangeTotal;
  if(parseInt(slider.value) > rangeTotal) slider.value = rangeTotal;
  document.getElementById('random-n-val').textContent = slider.value;
  document.getElementById('random-modal').classList.add('open');
}

// 🚀 1周目をスタート
function startRoundStudy() {
  if (!ALL_WORDS || ALL_WORDS.length === 0) {
    alert("⏳ 単語データを読み込み中です！\n（APIキーが正しいか確認してください）"); return;
  }
  isRandomMode = false;
  isReviewMode = false;

  const lo = (activeRange === 'midterm') ? 0 : 141;
  const hi = (activeRange === 'midterm') ? 140 : 282;
  const rangeWords = ALL_WORDS.slice(lo, hi + 1);
  const unsubmittedWords = rangeWords.filter(w => !uRoundAnswers.includes(w.id));
  
  if (unsubmittedWords.length === 0) {
    alert("🎉 この周回の単語はすべて解き終わっています！\n自動的に次の周回に進みます！");
    uCurrentRound++;
    uRoundAnswers = [];
    if (!isGuest && auth.currentUser) {
      db.collection('users').doc(auth.currentUser.uid).set({ currentRound: uCurrentRound, roundAnswers: uRoundAnswers }, { merge: true });
    }
    refreshUI();
    return;
  }
  
  state.queue = unsubmittedWords.map(w => ({ word: w, dir: 'jp-en' }));
  state.current = 0; state.results = [];
  playTangoEffect(() => { showScreen('screen-quiz'); renderQuestion(); });
}

// 🎲 ランダムN問
function startRandomN() {
  if (!ALL_WORDS || ALL_WORDS.length === 0) return;
  isRandomMode = true;
  isReviewMode = false;
  
  const n = parseInt(document.getElementById('random-n-slider').value);
  const lo = (activeRange === 'midterm') ? 0 : 141;
  const hi = (activeRange === 'midterm') ? 140 : 282;
  const rangeWords = ALL_WORDS.slice(lo, hi + 1);
  
  state.queue = rangeWords.map(w => ({word: w, dir: 'jp-en'})).sort(() => Math.random() - 0.5).slice(0, n);
  state.current = 0; state.results = [];
  document.getElementById('random-modal').classList.remove('open');
  playTangoEffect(() => { showScreen('screen-quiz'); renderQuestion(); });
}

// 🔥 復習モード
function startReviewMode() {
  if (!ALL_WORDS || ALL_WORDS.length === 0) { alert("⏳ 読み込み中です！"); return; }
  const lo = (activeRange === 'midterm') ? 0 : 141;
  const hi = (activeRange === 'midterm') ? 140 : 282;
  const rangeWords = ALL_WORDS.slice(lo, hi + 1);

  const wrongWords = rangeWords.filter(w => {
    const h = uWordHistory[w.id];
    return h && (h.wrong || 0) > (h.reviewed || 0);
  });

  if (wrongWords.length === 0) {
    alert("✨ 現在、要復習の単語は1つもありません！完璧です！"); return;
  }

  isRandomMode = true; 
  isReviewMode = true; 
  state.queue = wrongWords.map(w => ({ word: w, dir: 'jp-en' })).sort(() => Math.random() - 0.5);
  state.current = 0; state.results = [];
  playTangoEffect(() => { showScreen('screen-quiz'); renderQuestion(); });
}

function renderQuestion() {
  const w = state.queue[state.current].word;
  document.getElementById('quiz-counter').textContent = `${state.current+1} / ${state.queue.length}`;
  document.getElementById('quiz-progress').style.width = ((state.current / state.queue.length) * 100) + '%';
  document.getElementById('quiz-word').textContent = w.jp;
  document.getElementById('quiz-hint').textContent = `No.${w.id} — 英語で答えてください`;
  document.getElementById('quiz-answer').value = '';
  document.getElementById('quiz-answer').disabled = false;
  document.getElementById('quiz-result').style.display = 'none';
  document.getElementById('btn-submit').style.display = 'block';
  document.getElementById('btn-next').style.display = 'none';
  setTimeout(()=>document.getElementById('quiz-answer').focus(), 50);
}

// 🌟 解答処理（復讐一発クリア対応）
async function submitAnswer() {
  const ans = document.getElementById('quiz-answer').value.trim().toLowerCase();
  const currentItem = state.queue[state.current];
  const correct = currentItem.word.en;
  const wordId = currentItem.word.id;
  
  let grade = 'wrong';
  if (ans === correct) grade = 'correct';
  else if (ans !== '' && (correct.includes(ans) || ans.includes(correct)) && ans.length > 2) grade = 'partial';

  state.results.push({ grade });
  uTotalAnswers++;
  if(grade === 'correct') uTotalCorrect++;
  
  if (!uWordHistory[wordId]) uWordHistory[wordId] = { solved: 0, wrong: 0, reviewed: 0 };
  uWordHistory[wordId].solved++;
  if (grade === 'wrong') uWordHistory[wordId].wrong++;
  
  // 🌟 復習モードで見事正解したら、過去の間違い回数とチャラにして「一発クリア」！
  if (isReviewMode && grade === 'correct') {
    uWordHistory[wordId].reviewed = uWordHistory[wordId].wrong;
  }

  if (!isRandomMode && !uRoundAnswers.includes(wordId)) uRoundAnswers.push(wordId);
  
  const cls = grade==='correct'?'result-correct':grade==='partial'?'result-partial':'result-wrong';
  const lbl = grade==='correct'?'✓ 正解！':grade==='partial'?'△ 部分正解':'✗ 不正解';
  const resEl = document.getElementById('quiz-result');
  resEl.innerHTML = `<div class="result-box ${cls}"><strong>${lbl}</strong><br>模範解答: <strong>${correct}</strong></div>`;
  resEl.style.display = 'block';
  
  document.getElementById('quiz-answer').disabled = true;
  document.getElementById('btn-submit').style.display = 'none';
  document.getElementById('btn-next').style.display = 'block';

  if (!isGuest && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({
      currentRound: uCurrentRound, roundAnswers: uRoundAnswers,
      totalAnswers: uTotalAnswers, totalCorrect: uTotalCorrect,
      wordHistory: uWordHistory, lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    const rangeTotal = (activeRange === 'midterm') ? 141 : 142;
    const accumulatedProgress = ((uCurrentRound - 1) * 100) + ((uRoundAnswers.length / rangeTotal) * 100);
    const totalAccuracy = uTotalAnswers > 0 ? Math.round((uTotalCorrect / uTotalAnswers) * 100) : 0;
    const nameToSave = currentNickname || auth.currentUser.displayName || '名無し';

    db.collection('leaderboard').doc(auth.currentUser.uid).set({
      uid: auth.currentUser.uid, displayName: nameToSave, email: auth.currentUser.email,
      progressPercent: accumulatedProgress, currentRound: uCurrentRound,
      roundProgress: Math.floor((uRoundAnswers.length / rangeTotal) * 100),
      accuracy: totalAccuracy, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

function nextQuestion() {
  state.current++;
  if (state.current >= state.queue.length) finishQuizSession();
  else renderQuestion();
}

function finishQuizSession() {
  if (isRandomMode) {
    document.getElementById('result-title').textContent = "演習完了！";
    const correctCount = state.results.filter(r => r.grade === 'correct').length;
    document.getElementById('result-sub').textContent = `${state.results.length}問中 ${correctCount}問正解！`;
    showScreen('screen-result');
  } else {
    const rangeTotal = (activeRange === 'midterm') ? 141 : 142;
    if (uRoundAnswers.length >= rangeTotal) {
      document.getElementById('result-title').textContent = `${uCurrentRound}周目 100% 達成！！🎉`;
      document.getElementById('result-sub').textContent = `テスト範囲の全${rangeTotal}語を一回ずつ解破しました！`;
      uCurrentRound++; uRoundAnswers = [];
      if (!isGuest && auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).set({ currentRound: uCurrentRound, roundAnswers: uRoundAnswers }, { merge: true });
      }
      showScreen('screen-result');
    } else {
      showScreen('screen-home'); refreshUI();
    }
  }
}

function exitQuizDirect() { document.getElementById('exit-modal').classList.remove('open'); showScreen('screen-home'); refreshUI(); }

function updateLeaderboardDisplay() {
  const homeLeaderboard = document.getElementById('home-leaderboard');
  if (isGuest) { homeLeaderboard.innerHTML = "<span style='color:#888;'>ランキングを見るにはログインが必要です</span>"; return; }
  
  db.collection('leaderboard').orderBy('progressPercent', 'desc').limit(3).get().then(snapshot => {
    if (snapshot.empty) { homeLeaderboard.innerHTML = "まだデータがありません。"; return; }
    let i = 0;
    homeLeaderboard.innerHTML = snapshot.docs.map(doc => {
      const e = doc.data(); const rankEmoji = i===0?'👑':i===1?'🥈':'🥉'; i++;
      return `<div style="padding:6px; background:${i===1?'#fff9c4':'#f5f5f5'}; border-radius:6px; margin-bottom:4px; display:flex; justify-content:space-between;">
        <span>${rankEmoji} ${i}. <b>${e.displayName}</b></span>
        <span><b style="color:#1976d2;">${e.currentRound}周目 ${e.roundProgress || 0}%</b> <span style="font-size:11px;color:#666;">(正解率:${e.accuracy || 0}%)</span></span>
      </div>`;
    }).join('');
  });
}

function openLeaderboardModal() {
  document.getElementById('leaderboard-modal').classList.add('open');
  const boardEl = document.getElementById('leaderboard-content-full');
  boardEl.innerHTML = "<div style='text-align:center;color:#888;padding:20px;'>☁️ 取得中...</div>";
  db.collection('leaderboard').orderBy('progressPercent', 'desc').limit(10).get().then(snapshot => {
    if(snapshot.empty) { boardEl.innerHTML = "<div style='text-align:center;padding:20px;'>データがありません</div>"; return; }
    let i = 0;
    boardEl.innerHTML = snapshot.docs.map(doc => {
      const e = doc.data(); i++;
      return `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
        <div><div style="font-weight:bold;">${i}. ${e.displayName}</div><div style="font-size:11px; color:#888;">正解率: ${e.accuracy || 0}%</div></div>
        <div style="text-align:right;"><div style="color:#1976d2; font-weight:bold; font-size:16px;">${e.currentRound}周目 ${e.roundProgress || 0}%</div></div>
      </div>`;
    }).join('');
  });
}

function openNicknameModal() { document.getElementById('nickname-input').value = currentNickname || (auth.currentUser ? auth.currentUser.displayName : ""); document.getElementById('nickname-modal').classList.add('open'); }
async function saveNickname() {
  const newName = document.getElementById('nickname-input').value.trim();
  if (!newName) { alert("ニックネームを入力してください"); return; }
  if (!isGuest && auth.currentUser) {
    try {
      await db.collection('users').doc(auth.currentUser.uid).set({ nickname: newName }, { merge: true });
      currentNickname = newName; document.getElementById('user-info').textContent = `👤 ${newName}`;
      document.getElementById('nickname-modal').classList.remove('open');
      db.collection('leaderboard').doc(auth.currentUser.uid).set({ displayName: newName }, { merge: true });
      refreshUI();
    } catch(e) {}
  }
}

function openTestDateModal() { document.getElementById('testdate-modal').classList.add('open'); }
async function setAndSaveSharedTest(testName, isoDateString, rangeType) {
  const targetDate = new Date(isoDateString);
  if (!isGuest && auth.currentUser) {
    try {
      await db.collection('vocabulary').doc('active_test').set({ testDate: targetDate.toISOString(), activeRange: rangeType }, { merge: true });
      testDate = targetDate; activeRange = rangeType;
      alert(`🎯 全員の目標を「${testName}」に強制変更・同期しました！ページをリロードします。`);
      window.location.reload();
    } catch(e) {}
  }
}

function startCountdown() { if (countdownTimer) clearInterval(countdownTimer); tickCountdown(); countdownTimer = setInterval(tickCountdown, 1000); }
function tickCountdown() {
  const labelEl = document.getElementById('countdown-label');
  const daysEl = document.getElementById('countdown-days');
  const hmsEl = document.getElementById('countdown-hms');
  const normaEl = document.getElementById('norma-area');
  if (!testDate) return;

  const now = new Date(); const diff = testDate - now;
  const rangeName = (activeRange === 'midterm') ? "中間範囲" : "期末範囲";

  if (diff <= 0) {
    labelEl.textContent = `${rangeName} 当日！`; daysEl.textContent = '0'; hmsEl.textContent = '00:00:00';
    normaEl.innerHTML = '<div class="norma-badge">🎯 本番開始！全力で行こう！</div>'; return;
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400); const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60); const secs = totalSec % 60;
  const pad = n => String(n).padStart(2,'0');
  
  labelEl.textContent = `${rangeName}テストまで（7/${testDate.getDate()} ${pad(testDate.getHours())}:${pad(testDate.getMinutes())}）`;
  daysEl.textContent = days; hmsEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

  const rangeTotal = (activeRange === 'midterm') ? 141 : 142; 
  const remaining = Math.max(0, rangeTotal - uRoundAnswers.length); 
  const norma = Math.ceil(remaining / (days + 1));
  normaEl.innerHTML = `<div class="norma-badge">📚 今日の残りノルマ: ${norma}語 / 日 (範囲内未回答: ${remaining}語)</div>`;
}

function playTangoEffect(callback) {
  const screen = document.getElementById('transition-screen'); const logo = document.getElementById('tango-logo');
  screen.classList.remove('transition-fade-out'); screen.classList.add('active');
  logo.innerHTML = '<span class="tango-tan">tan</span><span class="tango-go">GO!!</span>';
  setTimeout(() => {
    screen.classList.add('transition-fade-out'); callback();
    setTimeout(() => { screen.classList.remove('active'); }, 300);
  }, 1000);
}

function logout() { auth.signOut().then(() => window.location.reload()); }
function loginAsGuest() {
  isGuest = true; document.getElementById('user-info').textContent = "👤 ゲストユーザー";
  document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-container').style.display = 'block';
  testDate = new Date("2026-07-03T09:10:00"); activeRange = "final";
  startCountdown(); refreshUI();
}