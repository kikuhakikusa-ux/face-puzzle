# ふくわらい — face-puzzle

家族の顔写真を素材にした、デジタル福笑いゲームです。
スマートフォンのカメラで撮った顔写真を AI が自動解析し、眉・目・鼻・口の 6 パーツを切り出します。
切り出したパーツをドラッグまたはタップで配置して遊びます。

**🌐 プレイする:** https://kikuhakikusa-ux.github.io/face-puzzle/

---

## ゲームの概要

| | |
|---|---|
| 対象 | 保護者 + 4 歳以上の幼児（同一端末で共同プレイ） |
| 人数 | 1〜2 名 |
| 所要時間 | 1 回あたり数分程度 |
| 動作環境 | スマートフォン（iOS Safari / Android Chrome）、Wi-Fi 推奨 |

---

## 遊び方

### 基本フロー

```
ホーム
  └─ 写真を選ぶ / 撮る
        └─ AI が 6 パーツを自動切り出し（10 秒程度）
              └─ モードを選ぶ
                    ├─ 👀 みながら おく（かんたん）
                    │     └─ パーツをドラッグして顔に配置 → ✅ かんせい！
                    └─ 🙈 めかくし（ドキドキ）
                          └─ 2 秒だけ顔の輪郭を表示 → 指示に従ってタップ配置 → 自動で完成！
```

### 2 つのモード

| モード | 操作 | 特徴 |
|---|---|---|
| **みながら おく** | ドラッグ | のっぺらぼう画像を見ながら自由に配置できる。幼い子どもでも楽しめる |
| **めかくし** | タップ | 顔の輪郭を 2 秒だけ見て、あとは記憶を頼りに 1 パーツずつタップ配置。完成まで結果がわからないドキドキ感が楽しい |

---

## 機能

- **AI 顔パーツ自動切り出し** — MediaPipe FaceDetection でブラウザ内処理（サーバー送信なし）
- **のっぺらぼう画像生成** — 顔表面の特徴（目・鼻・口・眉・眼鏡）を除去した背景画像を自動生成
- **みながらモード** — タッチ/マウスによるドラッグ配置、再配置対応
- **めかくしモード** — フェーズ管理（輪郭表示 2 秒 → 白背景 → 順次タップ配置 → 完成自動遷移）
- **完成画面** — 紙吹雪アニメーション付きで結果を大画面表示、PNG 保存機能
- **プライバシー保護** — 顔写真はブラウザ内のみで処理。外部サーバーへの送信なし

---

## 技術スタック

| 層 | 技術 | 選定理由 |
|---|---|---|
| マークアップ | HTML5 | 標準仕様。追加ツール不要 |
| スタイル | CSS3（CSS カスタムプロパティ） | 標準仕様。ブランドトークンをカスタムプロパティで一元管理 |
| ロジック | Vanilla JavaScript (ES2020) | フレームワーク不要の小規模アプリ。学習コスト最小化 ([ADR-001](docs/adr/ADR-001-vanilla-js.md)) |
| AI 顔検出 | MediaPipe FaceDetection v0.1.x（CDN） | ブラウザ内完結・無償・Google 公式 ([ADR-002](docs/adr/ADR-002-mediapipe.md)) |
| ホスティング | GitHub Pages | 無償・ビルド不要の静的ファイル配信 ([ADR-003](docs/adr/ADR-003-github-pages.md)) |
| フォント | Google Fonts（Yusei Magic / Zen Maru Gothic / Noto Sans JP） | 子ども向けポップなブランドデザインに準拠 |

---

## ファイル構造

```
face-puzzle/
├── index.html              # エントリポイント・全画面の HTML 構造（5 画面）
├── style.css               # グローバルスタイル・ブランドトークン（CSS カスタムプロパティ）
├── js/
│   ├── main.js             # 画面遷移・モード状態管理・紙吹雪・保存機能
│   ├── canvas.js           # Canvas 描画・タッチイベント・目隠しフェーズ制御
│   └── faceDetect.js       # MediaPipe 呼び出し・パーツ切り出し・のっぺらぼう生成
├── assets/
│   ├── Icon.svg            # ブランドアイコン
│   ├── sachin-cut.png      # キャラクター画像（さーちん）
│   └── payachin-cut.png    # キャラクター画像（ぱやちん）
└── docs/
    ├── 01-requirements.md  # 要件定義書 (SRS v0.4.0)
    ├── 02-architecture.md  # アーキテクチャ設計書 (SAD v0.4.0)
    ├── _phase.md           # 開発フェーズ管理
    └── adr/
        ├── ADR-001-vanilla-js.md
        ├── ADR-002-mediapipe.md
        └── ADR-003-github-pages.md
```

---

## セットアップ・実行

サーバーレス SPA のため、ビルド作業は不要です。

### ローカルで試す

```bash
# リポジトリをクローン
git clone https://github.com/kikuhakikusa-ux/face-puzzle.git
cd face-puzzle

# 簡易 HTTP サーバーを起動（カメラ API は HTTPS / localhost が必要）
python -m http.server 8080
# または
npx serve .
```

ブラウザで `http://localhost:8080` を開いてください。

> **注意:** `file://` プロトコルでは MediaPipe のモデルロードおよびカメラ API が動作しません。必ず HTTP サーバー経由でアクセスしてください。

### GitHub Pages へのデプロイ

`main` ブランチへプッシュすると GitHub Pages が自動でデプロイします（ビルド不要）。

---

## ドキュメント

| 文書 | パス | 概要 |
|---|---|---|
| 要件定義書 (SRS) | [docs/01-requirements.md](docs/01-requirements.md) | 機能要件・非機能要件・成功判定基準 |
| アーキテクチャ設計書 (SAD) | [docs/02-architecture.md](docs/02-architecture.md) | C4 図・コンポーネント構成・データフロー |
| ADR-001 | [docs/adr/ADR-001-vanilla-js.md](docs/adr/ADR-001-vanilla-js.md) | Vanilla JS 採用の決定根拠 |
| ADR-002 | [docs/adr/ADR-002-mediapipe.md](docs/adr/ADR-002-mediapipe.md) | MediaPipe 採用の決定根拠 |
| ADR-003 | [docs/adr/ADR-003-github-pages.md](docs/adr/ADR-003-github-pages.md) | GitHub Pages 採用の決定根拠 |

---

## プライバシーについて

- 撮影した顔写真はブラウザ内の JavaScript メモリ上にのみ保持されます
- MediaPipe の AI 処理はすべてデバイス内で完結し、顔写真データを外部サーバーに送信しません
- ページをリロードまたはセッションを終了すると、すべてのデータが自動的に削除されます

---

## ライセンス

このリポジトリには個人向けキャラクター素材が含まれます（`assets/sachin-cut.png`, `assets/payachin-cut.png`）。
これらの素材の再配布・二次利用はご遠慮ください。
その他のソースコードは個人プロジェクトのサンプルとして自由に参照できます。
