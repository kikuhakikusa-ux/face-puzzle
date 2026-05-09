// アプリ全体の状態を一か所に集める
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
}

// 各画面のボタンにイベントを登録する
function init() {
  const photoLabel = document.getElementById('photo-label');
  const photoInput = document.getElementById('photo-input');

  // MediaPipe を裏でロードし始める(ページを開いた瞬間から準備開始)
  initFaceDetector()
    .then(() => {
      photoLabel.textContent = '📷 写真を選ぶ';
      photoLabel.classList.remove('btn-loading');
      photoInput.disabled = false;
    })
    .catch((err) => {
      console.error('MediaPipe の初期化に失敗:', err);
      photoLabel.textContent = '⚠️ AI 読み込み失敗';
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
      document.getElementById('ai-status').textContent = '🔍 パーツを見つけています…';
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

    const names = parts.map(p => p.name).join('・');
    statusEl.textContent = `✅ 見つかりました: ${names}`;
    setTimeout(() => showScreen('screen-mode'), 1000);
  } catch (err) {
    console.error('顔検出エラー:', err);
    statusEl.textContent = '❌ 顔を検出できませんでした。別の写真を試してください。';
  }
}

// モードを確定してゲーム画面へ
function selectMode(mode) {
  state.mode = mode;
  // 目隠しモードでは完成ボタンを非表示にする(全パーツ配置で自動完成するため)
  document.getElementById('btn-done').style.display = mode === 'look' ? '' : 'none';
  showScreen('screen-game');
  initCanvas(state);
}

document.addEventListener('DOMContentLoaded', init);
