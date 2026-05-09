// 顔検出モジュール (C-04)
// MediaPipe FaceDetection を使って顔写真から目・鼻・口を切り出す

let faceDetection = null;
let detectorReady = false;

async function initFaceDetector() {
  faceDetection = new FaceDetection({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });
  faceDetection.setOptions({
    model: 'short',
    minDetectionConfidence: 0.5,
  });
  await faceDetection.initialize();
  detectorReady = true;
}

// 画像からパーツを切り出す
// 戻り値: Promise<{ parts: Array<{name, blindLabel, canvas}>, detection: object }>
async function detectParts(imgEl) {
  if (!detectorReady) throw new Error('detector not ready');

  return new Promise((resolve, reject) => {
    faceDetection.onResults((results) => {
      if (!results.detections || results.detections.length === 0) {
        reject(new Error('顔が検出できませんでした'));
        return;
      }
      try {
        const detection = results.detections[0];
        const parts = cutParts(imgEl, detection);
        resolve({ parts, detection });
      } catch (err) {
        reject(err);
      }
    });
    faceDetection.send({ image: imgEl }).catch(reject);
  });
}

function cutParts(imgEl, detection) {
  const W = imgEl.naturalWidth;
  const H = imgEl.naturalHeight;
  const bb = detection.boundingBox;
  const faceW = bb.width  * W;
  const faceH = bb.height * H;

  // ランドマーク: 0=被写体の右目(画面では左側) 1=被写体の左目(画面では右側) 2=鼻 3=口
  // yOff: ランドマーク座標から faceH の何割ずらすか(負=上方向)。眉は目から推定する
  // name: 完成メッセージ用の短縮名
  // blindLabel: 目隠しモードの指示テキスト(ユーザ視点で迷わない表現)
  const partDefs = [
    { name: '左眉', blindLabel: '向かって左の眉', kpIndex: 0, wRatio: 0.35, hRatio: 0.12, yOff: -0.13 },
    { name: '右眉', blindLabel: '向かって右の眉', kpIndex: 1, wRatio: 0.35, hRatio: 0.12, yOff: -0.13 },
    { name: '左目', blindLabel: '向かって左の目', kpIndex: 0, wRatio: 0.32, hRatio: 0.20 },
    { name: '右目', blindLabel: '向かって右の目', kpIndex: 1, wRatio: 0.32, hRatio: 0.20 },
    { name: '鼻',   blindLabel: '鼻',             kpIndex: 2, wRatio: 0.38, hRatio: 0.30 },
    { name: '口',   blindLabel: '口',             kpIndex: 3, wRatio: 0.48, hRatio: 0.24 },
  ];

  return partDefs.map(({ name, blindLabel, kpIndex, wRatio, hRatio, yOff = 0 }) => {
    const lm = detection.landmarks[kpIndex];
    const cx = lm.x * W;
    const cy = lm.y * H + faceH * yOff;
    const pw = faceW * wRatio;
    const ph = faceH * hRatio;

    const partCanvas = document.createElement('canvas');
    partCanvas.width  = Math.round(pw);
    partCanvas.height = Math.round(ph);
    const partCtx = partCanvas.getContext('2d');
    partCtx.drawImage(imgEl, cx - pw / 2, cy - ph / 2, pw, ph, 0, 0, pw, ph);
    applyEllipticalMask(partCtx, Math.round(pw), Math.round(ph));

    return { name, blindLabel, canvas: partCanvas };
  });
}

// パーツ canvas にフェザー付き楕円マスクをかける
// パーツの縦横比がそのまま楕円形状になり、輪郭が自然にぼける
function applyEllipticalMask(ctx, w, h) {
  const feather = Math.min(w, h) * 0.18;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width  = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.filter = `blur(${Math.round(feather)}px)`;
  maskCtx.fillStyle = '#fff';
  maskCtx.beginPath();
  maskCtx.ellipse(w / 2, h / 2, w / 2 - feather, h / 2 - feather, 0, 0, Math.PI * 2);
  maskCtx.fill();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

// 「のっぺらぼう」canvas を生成する
// 肌色ピクセル検出 + ランドマーク周辺強制マスク + ぼかし合成 の3段階で
// 顔の表面特徴(眉毛・眼鏡・目・鼻・口)を除去する
function createNopperaboCanvas(imgEl, detection) {
  const W = imgEl.naturalWidth;
  const H = imgEl.naturalHeight;
  const bb = detection.boundingBox;

  const faceCX = bb.xCenter * W;
  const faceCY = bb.yCenter * H;
  const faceW  = bb.width  * W;
  const faceH  = bb.height * H;

  // 処理対象の顔領域(バウンディングボックスを 10% 拡張して眉・顎まで含める)
  const faceLeft   = Math.max(0, Math.round(faceCX - faceW * 0.6));
  const faceRight  = Math.min(W, Math.round(faceCX + faceW * 0.6));
  const faceTop    = Math.max(0, Math.round(faceCY - faceH * 0.6));
  const faceBottom = Math.min(H, Math.round(faceCY + faceH * 0.6));

  // ① 元画像のピクセルデータを取得
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width  = W;
  srcCanvas.height = H;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(imgEl, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, W, H).data;

  // ② 顔領域の肌色ピクセルの中央値を基準肌色として測定
  //    額固定サンプリングより明暗ムラの影響を受けにくく、代表色が安定する
  //    条件: 暖色系(r > g かつ r > b)かつ輝度が極端でない(50〜240)
  const rArr = [], gArr = [], bArr = [];
  for (let y = faceTop; y < faceBottom; y++) {
    for (let x = faceLeft; x < faceRight; x++) {
      const i = (y * W + x) * 4;
      const r = srcData[i], g = srcData[i + 1], b = srcData[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (r > g && r > b && lum > 50 && lum < 240) {
        rArr.push(r); gArr.push(g); bArr.push(b);
      }
    }
  }
  const median = arr => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const refR = median(rArr) ?? 200;
  const refG = median(gArr) ?? 160;
  const refB = median(bArr) ?? 130;

  // ③ マスク canvas を生成
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width  = W;
  maskCanvas.height = H;
  const maskCtx   = maskCanvas.getContext('2d');
  const maskImg   = maskCtx.createImageData(W, H);
  const md        = maskImg.data;

  // 顔領域内で基準肌色に近いピクセルをマスクに追加
  const TOLERANCE = 65;
  for (let y = faceTop; y < faceBottom; y++) {
    for (let x = faceLeft; x < faceRight; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(srcData[i]     - refR) < TOLERANCE &&
          Math.abs(srcData[i + 1] - refG) < TOLERANCE &&
          Math.abs(srcData[i + 2] - refB) < TOLERANCE) {
        md[i] = md[i + 1] = md[i + 2] = md[i + 3] = 255;
      }
    }
  }

  // ④ ランドマーク + 推定眉毛位置を円形で強制マスク追加
  const addCircle = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const mx = cx + dx, my = cy + dy;
        if (mx >= 0 && mx < W && my >= 0 && my < H) {
          const mi = (my * W + mx) * 4;
          md[mi] = md[mi + 1] = md[mi + 2] = md[mi + 3] = 255;
        }
      }
    }
  };
  const landR    = Math.round(faceW * 0.13);
  const browR    = Math.round(faceW * 0.16); // 眉毛は目より広めの円で確実にカバー
  const browYOff = Math.round(faceH * 0.13);
  [0, 1, 2, 3].forEach(kpIdx => {
    const lm = detection.landmarks[kpIdx];
    addCircle(Math.round(lm.x * W), Math.round(lm.y * H), landR);
  });
  [0, 1].forEach(kpIdx => {
    const lm = detection.landmarks[kpIdx];
    addCircle(Math.round(lm.x * W), Math.round(lm.y * H) - browYOff, browR);
  });

  maskCtx.putImageData(maskImg, 0, 0);
  const hardMaskData = maskCtx.getImageData(0, 0, W, H).data;

  // ⑤ ソフトマスク: ハードマスクをぼかして境界を滑らかに拡張する
  const softMaskCanvas = document.createElement('canvas');
  softMaskCanvas.width  = W;
  softMaskCanvas.height = H;
  const softMaskCtx = softMaskCanvas.getContext('2d');
  softMaskCtx.filter = `blur(${Math.round(Math.min(faceW, faceH) * 0.10)}px)`;
  softMaskCtx.drawImage(maskCanvas, 0, 0);
  const softMaskData = softMaskCtx.getImageData(0, 0, W, H).data;

  // ⑥ ピクセル単位の適応ブレンド
  //    effectiveMask = max(ハードマスク, ソフトマスクα)
  //      → ハードマスク内は確実に 1.0、外縁はソフトマスクで滑らかに減衰
  //    colorWeight = sqrt(colorDist / COLOR_RANGE) で応答を急峻にする
  //      → 肌色に近い: BASE_BLEND で軽くブレンド
  //      → 眼鏡・眉毛など色が遠い: 1.0 でほぼ完全に肌色置換
  const nc = document.createElement('canvas');
  nc.width  = W;
  nc.height = H;
  const ncCtx = nc.getContext('2d');
  ncCtx.drawImage(imgEl, 0, 0);
  const outImg = ncCtx.getImageData(0, 0, W, H);
  const od = outImg.data;

  const BASE_BLEND  = 0.75; // 肌色類似ピクセルの最小ブレンド率(強め)
  const COLOR_RANGE = 50;   // この色距離で colorWeight = 1.0 に達する

  for (let idx = 0; idx < W * H; idx++) {
    const i = idx * 4;
    const hardAlpha = hardMaskData[i + 3] / 255;
    const softAlpha = softMaskData[i + 3] / 255;
    const effectiveMask = Math.max(hardAlpha, softAlpha);
    if (effectiveMask < 0.01) continue;

    const r = od[i], g = od[i + 1], b = od[i + 2];
    const dr = r - refR, dg = g - refG, db = b - refB;
    const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
    // sqrt カーブ: 小さい色距離でも急峻にブレンドが上がる
    const colorWeight = Math.min(1, Math.sqrt(colorDist / COLOR_RANGE));

    const blend = effectiveMask * (BASE_BLEND + (1 - BASE_BLEND) * colorWeight);
    od[i]     = Math.round(r * (1 - blend) + refR * blend);
    od[i + 1] = Math.round(g * (1 - blend) + refG * blend);
    od[i + 2] = Math.round(b * (1 - blend) + refB * blend);
  }

  ncCtx.putImageData(outImg, 0, 0);
  return nc;
}
