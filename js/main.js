// ====================================================================
// face-puzzle — メイン制御
// アプリ全体の状態管理 + 画面遷移 + UI 装飾の同期
// ====================================================================

const state = {
  mode: null,              // 'look'(見ながら) または 'blind'(目隠し)
  sourceImage: null,       // 選んだ写真の HTMLImageElement
  parts: [],               // 切り出した顔パーツの配列 [{name, blindLabel, canvas}, ...]
  nopperaboCanvas: null,   // パーツ領域をぼかし塗りした「のっぺらぼう」canvas
  detection: null,         // MediaPipe の生検出結果(bounding box・landmarks)
};

// 指定した画面だけ表示する
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // 完成画面に入ったら紙吹雪を 生成
  if (id === 'screen-result') {
    spawnConfetti();
  }
}

// ====================================================================
// 紙吹雪 (P-05 完成画面)
// ====================================================================
function spawnConfetti() {
  const layer = document.getElementById('confetti-layer');
  layer.innerHTML = '';
  const colors  = ['#F8F000', '#F04800', '#F2A8C4', '#2090E8', '#fff'];
  const shapes  = ['square', 'circle', 'rect'];
  const count   = 60;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = `confetti-piece shape-${shapes[i % shapes.length]}`;
    piece.style.background = colors[i % colors.length];
    piece.style.left       = `${Math.random() * 100}%`;
    piece.style.animationDuration = `${2.4 + Math.random() * 2.4}s`;
    piece.style.animationDelay    = `${Math.random() * 1.2}s`;
    piece.style.transform  = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
}

// ====================================================================
// HUD 同期 (P-04 ゲーム画面のヘッダーとアクションバー)
// ====================================================================
function updateGameHud() {
  const screen = document.getElementById('screen-game');
  screen.dataset.mode = state.mode || '';

  // モードバッジ
  document.getElementById('hud-mode-icon').textContent = state.mode === 'blind' ? '🙈' : '👀';
  document.getElementById('hud-mode-name').textContent = state.mode === 'blind' ? 'めかくし モード' : 'みながら モード';
  document.getElementById('hud-mode-sub').textContent  =
    state.mode === 'blind'
      ? '指示の パーツを タップ'
      : 'パーツを ゆびで うごかしてね';

  // 進捗ドット
  const dotsWrap = document.getElementById('hud-dots');
  const progress = document.getElementById('hud-progress');
  const total    = state.parts.length || 6;

  if (state.mode === 'look') {
    // 見ながらモードでは進捗 UI は出さない (全パーツ最初から見えるため)
    progress.style.display = 'none';
  } else {
    progress.style.display = '';
    dotsWrap.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'hud-dot';
      dotsWrap.appendChild(dot);
    }
  }
}

// 目隠しモードで配置が進んだときに canvas.js から呼ばれる
function notifyBlindPlaced(placedCount) {
  const dots = document.querySelectorAll('#hud-dots .hud-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('placed', i < placedCount);
  });
}
// canvas.js から参照できるようグローバルに公開
window.notifyBlindPlaced = notifyBlindPlaced;

// ====================================================================
// 保存ボタン (P-05)
// ====================================================================
function saveResult() {
  const canvas = document.getElementById('result-canvas');
  const link   = document.createElement('a');
  const ts     = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.download = `fukuwarai_${ts}.png`;
  link.href     = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ====================================================================
// 初期化
// ====================================================================
function init() {
  const photoLabel = document.getElementById('photo-label');
  const photoInput = document.getElementById('photo-input');
  const labelText  = photoLabel.querySelector('.btn-label');
  const labelSub   = photoLabel.querySelector('.btn-sub');
  const labelIcon  = photoLabel.querySelector('.btn-icon');

  // MediaPipe を裏でロードし始める(ページを開いた瞬間から準備開始)
  initFaceDetector()
    .then(() => {
      labelIcon.textContent = '📷';
      labelText.textContent = 'しゃしんを えらぶ';
      labelSub.textContent  = 'カメラ または アルバム';
      photoLabel.classList.remove('btn-loading');
      photoInput.disabled = false;
    })
    .catch((err) => {
      console.error('MediaPipe の初期化に失敗:', err);
      labelIcon.textContent = '⚠️';
      labelText.textContent = 'AI 読み込み失敗';
      labelSub.textContent  = 'リロードして やりなおして';
    });

  // P-01: 写真を選んだとき
  photoInput.addEventListener('change', onPhotoSelected);

  // P-02: 撮り直すボタン
  document.getElementById('btn-retake').addEventListener('click', () => {
    photoInput.value = '';
    showScreen('screen-home');
  });

  // P-03: モード選択
  document.getElementById('btn-mode-look').addEventListener('click',  () => selectMode('look'));
  document.getElementById('btn-mode-blind').addEventListener('click', () => selectMode('blind'));

  // P-04: 完成ボタン(見ながらモード専用 — 目隠しモードは全パーツ配置後に自動遷移)
  document.getElementById('btn-done').addEventListener('click', () => {
    captureToResult();
    showScreen('screen-result');
  });

  // P-04: モード変更ボタン
  document.getElementById('btn-change-mode').addEventListener('click', () => showScreen('screen-mode'));

  // P-05: ほぞん
  document.getElementById('btn-save').addEventListener('click', saveResult);

  // P-05: もう一度
  document.getElementById('btn-replay').addEventListener('click', () => {
    state.mode = null;
    state.sourceImage = null;
    state.parts = [];
    state.nopperaboCanvas = null;
    state.detection = null;
    photoInput.value = '';
    showScreen('screen-home');
  });
}

// 写真が選ばれたとき: プレビュー表示 → AI 検出を起動
function onPhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      document.getElementById('preview-img').src = ev.target.result;
      const statusEl = document.getElementById('ai-status');
      statusEl.innerHTML = 'さがしてるよ〜<span class="dot-pulse"><i></i><i></i><i></i></span>';
      showScreen('screen-confirm');
      runDetection(img);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// AI 検出を実行し、パーツ切り出し + のっぺらぼう生成を行う
async function runDetection(img) {
  const statusEl = document.getElementById('ai-status');
  try {
    const { parts, detection } = await detectParts(img);
    state.parts     = parts;
    state.detection = detection;
    state.nopperaboCanvas = createNopperaboCanvas(img, detection);

    statusEl.innerHTML = `みつけた！<span style="font-size:18px">✨</span>`;
    setTimeout(() => showScreen('screen-mode'), 900);
  } catch (err) {
    console.error('顔検出エラー:', err);
    statusEl.textContent = 'みつからなかった…べつの しゃしんで';
  }
}

// モードを確定してゲーム画面へ
function selectMode(mode) {
  state.mode = mode;
  showScreen('screen-game');
  updateGameHud();
  initCanvas(state);
}

document.addEventListener('DOMContentLoaded', init);
