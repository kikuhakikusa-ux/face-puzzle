# 現フェーズ: 実装中(仕様変更反映済み)

更新日: 2026-05-03

## 完了フェーズ
- [x] 要件定義(2026-05-02 完了)
- [x] アーキテクチャ設計(2026-05-02 完了)

## 実装進捗
- [x] 骨格作成: `index.html` / `style.css` / `js/main.js` / `js/canvas.js` / `js/faceDetect.js`
- [x] 顔検出モジュール: MediaPipe 呼び出し・パーツ切り出し(`js/faceDetect.js`)
- [x] Canvas エンジン: パーツ描画・タッチ/ドラッグ処理(`js/canvas.js`)
- [x] 完成画面: `result-canvas` に配置結果を描画
- [x] 仕様変更反映: のっぺらぼう背景・見ながらモード改修・目隠しモード完全リデザイン

## 成果物
- docs/01-requirements.md — 要件定義書 v0.2.0 (SRS-face-puzzle-001)
- docs/02-architecture.md — アーキテクチャ設計書 v0.2.0 (SAD-face-puzzle-001)
- docs/adr/ADR-001-vanilla-js.md — Vanilla JS 採用の根拠
- docs/adr/ADR-002-mediapipe.md — MediaPipe 採用の根拠
- docs/adr/ADR-003-github-pages.md — GitHub Pages 採用の根拠

## 成果物バージョン
- docs/01-requirements.md — v0.4.0 (2026-05-10 更新済み)
- docs/02-architecture.md — v0.4.0 (2026-05-10 更新済み)

## 次のステップ
- [ ] 動作確認(ローカル or GitHub Pages)
