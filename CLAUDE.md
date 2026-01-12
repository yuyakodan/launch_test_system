# CLAUDE.md

## プロジェクト概要

広告配信実験管理システム - Run単位で設計→生成→承認→公開→配信→自動停止→判定→学習を完結

## 技術スタック

- Cloudflare Workers (Runtime)
- Cloudflare D1 (Database)
- Cloudflare R2 (Storage)
- Cloudflare KV (Cache)
- Cloudflare Pages (Frontend)
- Meta Marketing API (Ad Platform)
- TypeScript

## 重要な制約

### Cloudflare制約
- Pages: Free月500ビルド、20分タイムアウト → LPはデータ駆動で更新
- D1: 最大10GB → テナントDB分割 or 時系列アーカイブ必須
- Workers Paid: 最低$5/月 (prod/stg各)

### Meta API制約
- バージョン期限監視必須（v22.0は2026-01-13まで等）
- 期限60/30/7日前に通知、期限前に段階的切替

### セキュリティ
- 承認なし配信禁止
- 予算上限未設定の配信禁止
- UTM欠落禁止
- 全操作は監査ログ必須

## ドメインモデル

### Run状態遷移
```
Draft → Designing → Generating → ReadyForReview → Approved → Publishing → Live → Running → Paused/Completed → Archived
```

### 主要エンティティ
- Tenant: テナント（顧客）
- Project: プロジェクト（商材単位）
- Run: 実験単位
- Variant (LP/Creative): バリアント
- MetaEntity: Campaign/Adset/Ad

## コーディング規約

- Conventional Commits準拠
- TDD: テスト作成 → 失敗確認 → 実装 → パス
- 型安全: TypeScript strict mode
- エラーハンドリング: 安全側に倒す（停止判定が曖昧なら一時停止＋通知）

## よく使うコマンド

```bash
# 開発
npm run dev          # 開発サーバー
npm run build        # ビルド
npm run test         # テスト
npm run lint         # Lint

# Cloudflare
wrangler dev         # ローカル開発
wrangler deploy      # デプロイ
wrangler d1 execute  # D1操作

# Miyabi
/miyabi-status       # 状態確認
/miyabi-auto         # 全自動モード
/miyabi-test         # テスト実行
```

## ファイル構成

```
src/
├── api/           # API エンドポイント
├── domain/        # ドメインモデル
├── services/      # ビジネスロジック
├── workers/       # Cloudflare Workers
└── pages/         # Cloudflare Pages
```

## 禁止事項

- 承認前の配信開始
- 予算上限未設定での配信
- 監査ログなしの操作
- UTM欠落でのURL発行
