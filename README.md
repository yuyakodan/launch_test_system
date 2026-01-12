# Launch Test System

広告配信を"実験"として標準化し、短期間で勝ち筋（訴求 × LP × クリエイティブ × 配信条件）を確定するシステム。

## 概要

Run 単位で「設計 → 生成 → 承認 → 公開 → 配信 → 自動停止 → 判定 → 学習 → 次 Run 生成」を完結させ、再現性と監査性を担保します。

## 技術スタック

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Queue**: Cloudflare Queues
- **Frontend**: Cloudflare Pages
- **Ad Platform**: Meta Marketing API

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集して必要な値を設定

# 開発サーバー起動
npm run dev
```

## 環境変数

```bash
# GitHub Personal Access Token
GITHUB_TOKEN=ghp_xxx

# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-xxx

# Meta Marketing API
META_ACCESS_TOKEN=xxx
META_AD_ACCOUNT_ID=act_xxx

# Cloudflare
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
```

## 主要機能

1. **テナント/プロジェクト管理**: RBAC、多テナント対応
2. **ヒアリング & 検証設計**: 訴求軸案、実験計画、停止条件
3. **LP バリアント管理**: 生成、編集、版管理、承認
4. **クリエイティブ管理**: 複数サイズ、文字レイヤー、差し替え
5. **承認フロー**: チェックリスト、承認ゲート
6. **公開**: Run/Variant URL、スナップショット保存
7. **Meta 広告連携**: Campaign/Adset/Ad 作成、Insights 同期
8. **計測**: UTM 統一、イベント定義、集計
9. **自動停止**: 予算上限、CPA 上限、CV ゼロ継続
10. **勝ち判定・学習**: 自動確定、レポート生成、次 Run 生成

## ディレクトリ構造

```
launch_test_system/
├── .github/
│   ├── workflows/           # GitHub Actions
│   └── ISSUE_TEMPLATE/      # Issue テンプレート
├── .ai/
│   ├── logs/                # 実行ログ
│   ├── parallel-reports/    # 並列実行レポート
│   └── knowledge-base/      # ナレッジベース
├── .claude/
│   ├── agents/              # Agent 定義
│   ├── commands/            # カスタムコマンド
│   └── mcp-servers/         # MCP Server 設定
├── src/                     # ソースコード
├── tests/                   # テスト
└── docs/                    # ドキュメント
```

## Miyabi Agents

このプロジェクトは Miyabi フレームワークによる自律型開発をサポートしています。

- `/miyabi-status`: プロジェクト状態確認
- `/miyabi-auto`: 全自動モード起動
- `/miyabi-test`: テスト実行
- `/miyabi-deploy`: デプロイ実行

## ライセンス

All rights reserved.
