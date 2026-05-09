---
adr_id: ADR-001
title: フロントエンドフレームワークを使用せず Vanilla JavaScript を採用する
status: accepted
date: 2026-05-02
deciders:
  - architect-coach
related_documents:
  - SAD-face-puzzle-001 (docs/02-architecture.md)
  - SRS-face-puzzle-001 (docs/01-requirements.md)
---

# ADR-001: フロントエンドフレームワークを使用せず Vanilla JavaScript を採用する

## Context

face-puzzle は画面数が 5 枚・機能が単一セッション完結型の小規模 Web アプリケーションである。
SRS C-002 により開発コストは無償範囲内に収める制約がある。
また本プロジェクトは SW エンジニアリング学習を兼ねており、フレームワーク固有の学習コストを最小化することが求められる。

## Options

| 選択肢 | メリット | デメリット |
|---|---|---|
| Vanilla JavaScript (ES2020) | 追加依存なし。ビルドツール不要。学習コストが低い | 大規模化時の保守コストが増加する |
| React + Vite | コンポーネント再利用性が高い | ビルド環境の構築が必要。JSX/仮想 DOM の学習コストが発生する |
| Vue.js | 学習コストが React より低い | CDN 利用でも一定の概念理解が必要。本システムの規模に対してオーバースペック |

## Decision

**Vanilla JavaScript (ES2020) を採用する。**

## Rationale

- 本システムの画面数(5 枚)および機能量はフレームワーク導入の恩恵を受けるほど複雑ではない
- ビルドツールが不要なため、GitHub Pages へのデプロイが HTML/CSS/JS ファイルのプッシュのみで完結する
- SRS C-002(無償範囲内)および C-003(既存ライブラリ利用)に完全準拠する
- 学習者がフレームワーク固有の概念ではなく、Web 標準の API(Canvas, Touch Events, File API)を直接学べる

## Consequences

- 肯定的影響:ビルド環境の構築が不要。ファイルをそのままブラウザで開いてデバッグできる
- 否定的影響:機能追加が増えた場合、状態管理コードが複雑化する可能性がある。その際はフレームワーク移行を再検討する
- 中立:ES2020 の機能(async/await, optional chaining 等)は iOS 14 以降・Android Chrome 80 以降でサポートされており、対象端末の現行機では問題ない
