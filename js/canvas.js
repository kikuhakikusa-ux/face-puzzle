// Canvas エンジン (C-03)
// 見ながらモード: のっぺらぼう背景 + ドラッグ配置
// 目隠しモード: フェーズ管理 + タップ配置 → 自動完成遷移

let ctx           = null;
let gameCanvas    = null;
let gameState     = null;
let animFrameId   = null;
let canvasInited  = false;

// のっぺらぼう背景の拡縮情報: 元画像→スクリーンの座標変換に使う
// { sx, sy: 元画像で切り取る起点(ピクセル), scale: 倍率 }
let nopperaboTransform = null;

// --- 見ながらモード用 ---
let gameParts     = [];
let draggingIndex = -1;
let dragOffset    = { x: 0, y: 0 };

// --- 目隠しモード用 ---
let blindPhase       = 'outline';
let currentPartIndex = 0;
let placedPositions  = [];   // [{xNorm, yNorm}, ...] タップ座標を 0〜1 の正規化で保存
let blindTimers      = [];

// ===== 初期化 =====

function initCanvas(state) {
  gameCanvas        = document.getElementById('game-canvas');
  gameCanvas.width  = window.innerWidth;
  gameCanvas.height = window.innerHeight;
  ctx               = gameCanvas.getContext('2d');
  gameState         = state;

  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  blindTimers.forEach(clearTimeout);
  blindTimers      = [];
  draggingIndex    = -1;

  // のっぺらぼう背景の拡縮情報を先に計算する(layoutParts が使うため)
  nopperaboTransform = computeNopperaboTransform();

  if (state.mode === 'look') {
    gameParts = layoutParts(state.parts, gameCanvas.width, gameCanvas.height);
  } else {
    blindPhase       = 'outline';
    currentPartIndex = 0;
    placedPositions  = [];

    // 2秒後に破線を消し、さらに 0.5秒後に最初の指示を表示
    blindTimers.push(setTimeout(() => {
      blindPhase = 'blank';
      blindTimers.push(setTimeout(() => { blindPhase = 'instruction'; }, 500));
    }, 2000));
  }

  if (!canvasInited) {
    gameCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    gameCanvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    gameCanvas.addEventListener('touchend',   onTouchEnd);
    gameCanvas.addEventListener('mousedown',  onMouseDown);
    gameCanvas.addEventListener('mousemove',  onMouseMove);
    gameCanvas.addEventListener('mouseup',    onMouseUp);
    canvasInited = true;
  }

  drawLoop();
}

// ===== のっぺらぼう背景の座標変換計算 =====

// 元画像をスクリーンに cover スタイルで描画したときの拡縮情報を返す
function computeNopperaboTransform() {
  const nc = gameState?.nopperaboCanvas;
  if (!nc) return { sx: 0, sy: 0, scale: 1 };

  const W = gameCanvas.width;
  const H = gameCanvas.height;
  const ncAspect     = nc.width / nc.height;
  const screenAspect = W / H;

  let sx, sy, sw, sh;
  if (screenAspect > ncAspect) {
    // スクリーンが横長 → 元画像の上下をクロップ
    sw = nc.width;
    sh = nc.width / screenAspect;
    sx = 0;
    sy = (nc.height - sh) / 2;
  } else {
    // スクリーンが縦長 → 元画像の左右をクロップ
    sh = nc.height;
    sw = nc.height * screenAspect;
    sx = (nc.width - sw) / 2;
    sy = 0;
  }

  return { sx, sy, scale: W / sw };
}

// ===== パーツ初期配置 =====

function layoutParts(parts, W, H) {
  const s     = nopperaboTransform?.scale ?? 1;
  const count = parts.length;
  return parts.map((part, i) => {
    const spacing = W / (count + 1);
    const dw = part.canvas.width  * s;
    const dh = part.canvas.height * s;
    return {
      ...part,
      x: spacing * (i + 1) - dw / 2,
      y: H * 0.72              - dh / 2,
    };
  });
}

// ===== 描画ループ =====

function drawLoop() {
  draw();
  animFrameId = requestAnimationFrame(drawLoop);
}

function draw() {
  if (gameState.mode === 'look') drawLookMode();
  else                           drawBlindMode();
}

// ===== 見ながらモードの描画 =====

function drawLookMode() {
  const W = gameCanvas.width;
  const H = gameCanvas.height;
  ctx.clearRect(0, 0, W, H);

  if (gameState.nopperaboCanvas) {
    drawNopperaboBgOnCtx(ctx, W, H, gameState.nopperaboCanvas);
  } else {
    ctx.fillStyle = '#f5e6d3';
    ctx.fillRect(0, 0, W, H);
  }

  // パーツをのっぺらぼう背景と同じ倍率で描画する
  const s = nopperaboTransform?.scale ?? 1;
  gameParts.forEach(part => {
    ctx.drawImage(
      part.canvas,
      Math.round(part.x), Math.round(part.y),
      Math.round(part.canvas.width  * s),
      Math.round(part.canvas.height * s)
    );
  });
}

// ===== 目隠しモードの描画 =====

function drawBlindMode() {
  const W = gameCanvas.width;
  const H = gameCanvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fffaf5';
  ctx.fillRect(0, 0, W, H);

  if      (blindPhase === 'outline')     drawFaceOutline(W, H);
  else if (blindPhase === 'instruction') drawInstruction(W, H);
  // 'blank' フェーズは白背景のみ
}

// 顔ガイドの破線: のっぺらぼう画像での顔の位置と整合させる
function drawFaceOutline(W, H) {
  ctx.save();
  ctx.strokeStyle = '#8b6040';
  ctx.lineWidth   = 3;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();

  const bb = gameState.detection?.boundingBox;
  const nc = gameState.nopperaboCanvas;
  const t  = nopperaboTransform;

  if (bb && nc && t) {
    // 元画像でのバウンディングボックス → スクリーン座標に変換
    const cx = (bb.xCenter * nc.width  - t.sx) * t.scale;
    const cy = (bb.yCenter * nc.height - t.sy) * t.scale;
    const rx = (bb.width   * nc.width)  / 2 * t.scale;
    const ry = (bb.height  * nc.height) / 2 * t.scale;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else {
    // detection がない場合は画面中央に固定値でフォールバック
    ctx.ellipse(W / 2, H * 0.38, W * 0.28, H * 0.32, 0, 0, Math.PI * 2);
  }

  ctx.stroke();
  ctx.restore();
}

// 目隠しモードの指示テキスト
function drawInstruction(W, H) {
  const part      = gameState.parts[currentPartIndex];
  const partLabel = part?.blindLabel ?? part?.name ?? '';

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#5c3a1e';
  ctx.font      = `bold ${Math.round(W * 0.065)}px sans-serif`;
  ctx.fillText(`${partLabel}はどこですか？`, W / 2, H / 2);

  ctx.fillStyle = '#aaa';
  ctx.font      = `${Math.round(W * 0.04)}px sans-serif`;
  ctx.fillText('タップして置く', W / 2, H / 2 + Math.round(W * 0.12));

  ctx.fillStyle = '#ccc';
  ctx.font      = `${Math.round(W * 0.035)}px sans-serif`;
  ctx.fillText(`${currentPartIndex + 1} / ${gameState.parts.length}`, W / 2, H * 0.12);

  ctx.restore();
}

// ===== のっぺらぼう背景の描画ヘルパー(cover スタイル) =====

// targetCtx に nc を cover スタイルで描画し、使った倍率を返す
function drawNopperaboBgOnCtx(targetCtx, W, H, nc) {
  const ncAspect     = nc.width / nc.height;
  const screenAspect = W / H;
  let sx, sy, sw, sh;
  if (screenAspect > ncAspect) {
    sw = nc.width;  sh = nc.width / screenAspect;
    sx = 0;         sy = (nc.height - sh) / 2;
  } else {
    sh = nc.height; sw = nc.height * screenAspect;
    sx = (nc.width - sw) / 2; sy = 0;
  }
  targetCtx.drawImage(nc, sx, sy, sw, sh, 0, 0, W, H);
  return W / sw; // この倍率でパーツも描くとスケールが一致する
}

// ===== タッチ / マウスイベント =====

function onTouchStart(e) {
  e.preventDefault();
  startAction(getEventPos(e.changedTouches[0]));
}
function onTouchMove(e) {
  e.preventDefault();
  if (gameState.mode === 'look') moveDrag(getEventPos(e.changedTouches[0]));
}
function onTouchEnd() { endDrag(); }

function onMouseDown(e) { startAction(getEventPos(e)); }
function onMouseMove(e) {
  if (gameState?.mode === 'look') moveDrag(getEventPos(e));
}
function onMouseUp() { endDrag(); }

function startAction({ x, y }) {
  if (gameState.mode === 'blind') onBlindTap(x, y);
  else                            startDrag(x, y);
}

// ===== 見ながらモード: ドラッグ =====

function startDrag(x, y) {
  const s = nopperaboTransform?.scale ?? 1;
  for (let i = gameParts.length - 1; i >= 0; i--) {
    const part = gameParts[i];
    const dw   = part.canvas.width  * s;
    const dh   = part.canvas.height * s;
    if (x >= part.x && x <= part.x + dw &&
        y >= part.y && y <= part.y + dh) {
      const [picked] = gameParts.splice(i, 1);
      gameParts.push(picked);
      draggingIndex = gameParts.length - 1;
      dragOffset    = { x: x - picked.x, y: y - picked.y };
      break;
    }
  }
}

function moveDrag({ x, y }) {
  if (draggingIndex < 0) return;
  gameParts[draggingIndex].x = x - dragOffset.x;
  gameParts[draggingIndex].y = y - dragOffset.y;
}

function endDrag() { draggingIndex = -1; }

// ===== 目隠しモード: タップで配置 =====

function onBlindTap(x, y) {
  if (blindPhase !== 'instruction') return;

  placedPositions[currentPartIndex] = {
    xNorm: x / gameCanvas.width,
    yNorm: y / gameCanvas.height,
  };

  currentPartIndex++;

  if (currentPartIndex >= gameState.parts.length) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
    captureToResult();
    showScreen('screen-result');
  }
}

// ===== 完成画面への転写 =====

function captureToResult() {
  const resultCanvas = document.getElementById('result-canvas');
  resultCanvas.width  = gameCanvas.width;
  resultCanvas.height = gameCanvas.height;
  const rCtx = resultCanvas.getContext('2d');

  if (gameState.mode === 'look') {
    rCtx.drawImage(gameCanvas, 0, 0);
  } else {
    const nc = gameState.nopperaboCanvas;
    const partScale = nc
      ? drawNopperaboBgOnCtx(rCtx, resultCanvas.width, resultCanvas.height, nc)
      : 1;

    placedPositions.forEach((pos, i) => {
      const partCanvas = gameState.parts[i]?.canvas;
      if (!pos || !partCanvas) return;
      const dw = partCanvas.width  * partScale;
      const dh = partCanvas.height * partScale;
      rCtx.drawImage(
        partCanvas,
        pos.xNorm * resultCanvas.width  - dw / 2,
        pos.yNorm * resultCanvas.height - dh / 2,
        dw, dh
      );
    });
  }
}

// ===== ユーティリティ =====

function getEventPos(e) {
  const rect = gameCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (gameCanvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (gameCanvas.height / rect.height),
  };
}
