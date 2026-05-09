---
adr_id: ADR-003
title: ホスティング先として GitHub Pages を採用する
status: accepted
date: 2026-05-02
deciders:
  - architect-coach
related_documents:
  - SAD-face-puzzle-001 (docs/02-architecture.md)
  - SRS-face-puzzle-001 (docs/01-requirements.md)
---

# ADR-003: ホスティング先として GitHub Pages を採用する

## Context

本システムはサーバーレス SPA であり、静的ファイル(HTML/CSS/JS)の配信のみで動作する。
SRS C-002 はインフラコストを無償範囲内に収めることを要求している。
開発者はすでに GitHub をバージョン管理基盤として使用する前提で設計を進めている。

## Options

| 選択肢 | 無償 | 静的ファイル配信 | デプロイ手順 | HTTPS |
|---|---|---|---|---|
| GitHub Pages | はい(パブリックリポジトリ) | はい | git push のみ | 自動付与 |
| Vercel | はい(無償枠) | はい | CLI または GitHub 連携 | 自動付与 |
| Cloudflare Pages | はい(無償枠) | はい | CLI または GitHub 連携 | 自動付与 |

## Decision

**GitHub Pages を採用する。**

## Rationale

- バージョン管理(GitHub)とホスティングが同一サービスで完結するため、デプロイ作業が `git push` のみになる
- 追加アカウント作成・追加ツールのインストールが不要であり、学習コストが最小
- HTTPS が自動付与されるため、MediaPipe が要求するセキュアコンテキスト(Secure Context)の要件を満たす
- SRS C-002 を完全に満たす

## Consequences

- 肯定的影響:デプロイ手順が単純なため、初心者でも繰り返し実施しやすい
- 否定的影響:プライベートリポジトリの GitHub Pages は GitHub Pro が必要。本システムはパブリックリポジトリとして公開することを前提とする
- 中立:ビルドプロセスが不要な Vanilla JS 構成のため、GitHub Actions による CI/CD は当初は不要。必要になった場合に追加できる
