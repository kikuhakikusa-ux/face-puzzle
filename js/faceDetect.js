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
  // name: 完成メッセージ用の短縮名
  // blindLabel: 目隠しモードの指示テキスト(ユーザ視点で迷わない表現)
  const partDefs = [
    { name: '左目', blindLabel: '向かって左の目', kpIndex: 0, wRatio: 0.32, hRatio: 0.20 },
    { name: '右目', blindLabel: '向かって右の目', kpIndex: 1, wRatio: 0.32, hRatio: 0.20 },
    { name: '鼻',   blindLabel: '鼻',             kpIndex: 2, wRatio: 0.38, hRatio: 0.30 },
    { name: '口',   blindLabel: '口',             kpIndex: 3, wRatio: 0.48, hRatio: 0.24 },
  ];

  return partDefs.map(({ name, blindLabel, kpIndex, wRatio, hRatio }) => {
    const lm = detection.landmarks[kpIndex];
    const cx = lm.x * W;
    const cy = lm.y * H;
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

  // ② 額中央のピクセルをサンプリングして肌色の基準値を測定
  const sampleCX = Math.round(faceCX);
  const sampleCY = Math.round(faceCY - faceH * 0.3); // 顔中心より 30% 上(額付近)
  const SAMPLE_R = 15;
  let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
  for (let sy = sampleCY - SAMPLE_R; sy <= sampleCY + SAMPLE_R; sy++) {
    for (let sx = sampleCX - SAMPLE_R; sx <= sampleCX + SAMPLE_R; sx++) {
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
        const i = (sy * W + sx) * 4;
        rSum += srcData[i]; gSum += srcData[i + 1]; bSum += srcData[i + 2];
        cnt++;
      }
    }
  }
  const refR = cnt ? rSum / cnt : 200;
  const refG = cnt ? gSum / cnt : 160;
  const refB = cnt ? bSum / cnt : 130;

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

  // ④ ランドマーク(目・鼻・口)周辺を円形で強制マスク追加
  //    眉毛・まつ毛・唇など肌色でない部位も確実に含める
  const landR = Math.round(faceW * 0.12);
  [0, 1, 2, 3].forEach(kpIdx => {
    const lm = detection.landmarks[kpIdx];
    const lx = Math.round(lm.x * W);
    const ly = Math.round(lm.y * H);
    for (let dy = -landR; dy <= landR; dy++) {
      for (let dx = -landR; dx <= landR; dx++) {
        if (dx * dx + dy * dy > landR * landR) continue; // 円形に限定
        const mx = lx + dx, my = ly + dy;
        if (mx >= 0 && mx < W && my >= 0 && my < H) {
          const mi = (my * W + mx) * 4;
          md[mi] = md[mi + 1] = md[mi + 2] = md[mi + 3] = 255;
        }
      }
    }
  });

  maskCtx.putImageData(maskImg, 0, 0);

  // ⑤ ソフトマスク: ハードマスクをぼかして境界を滑らかに拡張する
  const softMaskCanvas = document.createElement('canvas');
  softMaskCanvas.width  = W;
  softMaskCanvas.height = H;
  const softMaskCtx = softMaskCanvas.getContext('2d');
  softMaskCtx.filter = `blur(${Math.round(Math.min(faceW, faceH) * 0.10)}px)`;
  softMaskCtx.drawImage(maskCanvas, 0, 0);

  // ⑥ 肌色べた塗りキャンバスを作成し、ソフトマスクで切り抜く
  //    元画像は一切使わないため、眼鏡・眉毛など色によらず肌色で完全に上書きできる
  const skinCanvas = document.createElement('canvas');
  skinCanvas.width  = W;
  skinCanvas.height = H;
  const skinCtx = skinCanvas.getContext('2d');
  skinCtx.fillStyle = `rgb(${Math.round(refR)},${Math.round(refG)},${Math.round(refB)})`;
  skinCtx.fillRect(0, 0, W, H);
  skinCtx.globalCompositeOperation = 'destination-in';
  skinCtx.drawImage(softMaskCanvas, 0, 0);

  // ⑦ 元画像の上に肌色レイヤーを重ねる
  //    → マスク領域だけ肌色に置換、輪郭・背景・髪・服は原画像を保持
  const nc = document.createElement('canvas');
  nc.width  = W;
  nc.height = H;
  const ctx = nc.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);
  ctx.drawImage(skinCanvas, 0, 0);

  return nc;
}
