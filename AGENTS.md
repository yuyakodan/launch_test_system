# AGENTS.md

サブエージェント向けの共有コンテキスト

## プロジェクト概要

広告配信実験管理システム。Run単位で実験サイクルを完結させる。

## 主要ドメイン

1. **tenant**: テナント/ユーザー/権限管理
2. **lp**: LP生成・編集・版管理・承認
3. **creative**: クリエイティブ生成・管理
4. **meta-api**: Meta Marketing API連携
5. **measurement**: 計測・UTM・イベント・集計
6. **approval**: 承認フロー
7. **auto-stop**: 自動停止ロジック
8. **learning**: 勝ち判定・学習・次Run生成

## Agent責務

### CoordinatorAgent
- タスク分解・優先度付け
- 依存関係管理
- 並列実行制御

### CodeGenAgent
- コード生成
- TDD遵守
- Conventional Commits

### ReviewAgent
- コードレビュー
- セキュリティチェック
- 品質スコアリング

### IssueAgent
- Issue分析
- ラベル付与
- 優先度判定

### PRAgent
- PR作成
- 変更サマリ生成
- テスト確認

### DeploymentAgent
- デプロイ実行
- ヘルスチェック
- ロールバック判断

### TestAgent
- テスト実行
- カバレッジ測定
- レポート生成

## 共通ルール

1. **監査**: 全操作をログに記録
2. **安全側**: 判断に迷ったら安全側に倒す
3. **型安全**: TypeScript strict mode必須
4. **TDD**: テスト先行
5. **Conventional Commits**: コミットメッセージ規約遵守

## 技術スタック

- Cloudflare Workers/D1/R2/KV/Pages
- TypeScript
- Meta Marketing API
- Vitest
