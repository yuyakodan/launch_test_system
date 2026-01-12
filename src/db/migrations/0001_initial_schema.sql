-- Migration: 0001_initial_schema
-- Description: Initial database schema for Launch Test System
-- Created: 2026-01-13

-- ============================================
-- テナント・ユーザー・権限管理
-- ============================================

-- テナント（顧客）
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'lite', -- lite, standard, pro, growth
  settings TEXT, -- JSON: 通知設定、ドメイン設定等
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ロール定義
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- tenant_owner, operator, reviewer, viewer
  permissions TEXT NOT NULL, -- JSON: 権限リスト
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- テナント-ユーザー紐付け（メンバーシップ）
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id),
  invited_by TEXT REFERENCES users(id),
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);

-- ============================================
-- プロジェクト（商材単位）
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cv_definition TEXT NOT NULL, -- JSON: イベント名、完了条件
  ng_expressions TEXT, -- JSON: NG表現リスト
  brand_settings TEXT, -- JSON: ブランド設定
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);

-- ============================================
-- Run（実験単位）
-- ============================================

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft', -- draft, designing, generating, ready_for_review, approved, publishing, live, running, paused, completed, archived

  -- ヒアリング入力
  product_info TEXT, -- JSON: 商材/価格/提供範囲
  evidence TEXT, -- JSON: 実績/根拠
  faqs TEXT, -- JSON: FAQ
  target_hypothesis TEXT, -- JSON: ターゲット仮説
  offer TEXT, -- JSON: オファー

  -- 検証設計
  appeal_axes TEXT, -- JSON: 訴求軸案（3本以上）
  experiment_plan TEXT, -- JSON: 探索軸、最低サンプル、勝ち判定ルール

  -- 停止条件
  stop_conditions TEXT NOT NULL, -- JSON: 停止条件設定
  budget_total INTEGER, -- 総額上限（円）
  budget_daily INTEGER, -- 日額上限（円）

  -- 結果
  winner_variant_id TEXT,
  learning_report TEXT, -- JSON: 学習レポート

  created_by TEXT NOT NULL REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_runs_project ON runs(project_id);
CREATE INDEX idx_runs_tenant ON runs(tenant_id);
CREATE INDEX idx_runs_state ON runs(state);

-- ============================================
-- バリアント（LP/クリエイティブ）
-- ============================================

-- LPバリアント
CREATE TABLE IF NOT EXISTS variants_lp (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- 構成
  appeal_axis TEXT NOT NULL, -- 訴求軸
  structure_type TEXT NOT NULL, -- 構成タイプ
  content_json TEXT NOT NULL, -- JSON: ブロック/セクション構成

  -- 版管理
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, approved, published

  -- 公開
  public_url TEXT,
  published_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_variants_lp_run ON variants_lp(run_id);
CREATE INDEX idx_variants_lp_tenant ON variants_lp(tenant_id);

-- クリエイティブバリアント
CREATE TABLE IF NOT EXISTS variants_creative (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- サイズ
  aspect_ratio TEXT NOT NULL, -- 1:1, 4:5, 9:16
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,

  -- アセット
  asset_url TEXT NOT NULL, -- R2 URL
  layers_json TEXT, -- JSON: テンプレレイヤー（文字要素等）

  -- 版管理
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, approved, published

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_variants_creative_run ON variants_creative(run_id);
CREATE INDEX idx_variants_creative_tenant ON variants_creative(tenant_id);

-- ============================================
-- 承認フロー
-- ============================================

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 承認対象
  target_type TEXT NOT NULL, -- lp, creative, measurement, stop_conditions, budget, url
  target_id TEXT NOT NULL,

  -- チェックリスト
  checklist_json TEXT NOT NULL, -- JSON: チェック項目と結果

  -- 承認
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  comment TEXT,

  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_approvals_run ON approvals(run_id);
CREATE INDEX idx_approvals_target ON approvals(target_type, target_id);

-- ============================================
-- デプロイメント（公開スナップショット）
-- ============================================

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_lp_id TEXT REFERENCES variants_lp(id),

  -- 公開情報
  public_url TEXT NOT NULL,
  snapshot_url TEXT NOT NULL, -- R2 スナップショットURL

  -- 状態
  status TEXT NOT NULL DEFAULT 'active', -- active, stopped, rolled_back

  deployed_by TEXT NOT NULL REFERENCES users(id),
  deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
  stopped_at TEXT
);

CREATE INDEX idx_deployments_run ON deployments(run_id);
CREATE INDEX idx_deployments_status ON deployments(status);

-- ============================================
-- Meta連携
-- ============================================

-- Meta OAuth接続
CREATE TABLE IF NOT EXISTS meta_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- OAuth
  ad_account_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL, -- 暗号化保存
  token_expires_at TEXT,
  refresh_token_encrypted TEXT,

  -- 状態
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, revoked

  connected_by TEXT NOT NULL REFERENCES users(id),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(tenant_id, ad_account_id)
);

CREATE INDEX idx_meta_connections_tenant ON meta_connections(tenant_id);

-- Meta広告エンティティ
CREATE TABLE IF NOT EXISTS meta_entities (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_connection_id TEXT NOT NULL REFERENCES meta_connections(id),

  -- エンティティ情報
  entity_type TEXT NOT NULL, -- campaign, adset, ad
  external_id TEXT NOT NULL, -- Meta側のID
  parent_id TEXT REFERENCES meta_entities(id), -- 親エンティティ

  -- 設定
  config_json TEXT NOT NULL, -- JSON: 設定内容

  -- 状態
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_review, active, paused, deleted
  review_status TEXT, -- pending, approved, rejected

  -- 予算（Adsetの場合）
  budget_daily INTEGER,
  budget_lifetime INTEGER,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meta_entities_run ON meta_entities(run_id);
CREATE INDEX idx_meta_entities_external ON meta_entities(external_id);
CREATE INDEX idx_meta_entities_type ON meta_entities(entity_type);

-- ============================================
-- 計測・集計
-- ============================================

-- 日次メトリクス
CREATE TABLE IF NOT EXISTS metrics_daily (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_lp_id TEXT REFERENCES variants_lp(id),
  variant_creative_id TEXT REFERENCES variants_creative(id),
  meta_entity_id TEXT REFERENCES meta_entities(id),

  date TEXT NOT NULL, -- YYYY-MM-DD

  -- 基本指標
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend INTEGER NOT NULL DEFAULT 0, -- 円

  -- イベント
  page_views INTEGER NOT NULL DEFAULT 0,
  cta_clicks INTEGER NOT NULL DEFAULT 0,
  form_starts INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,

  -- 計算指標
  ctr REAL, -- Click Through Rate
  cpc REAL, -- Cost Per Click
  cpa REAL, -- Cost Per Acquisition
  cvr REAL, -- Conversion Rate

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(run_id, variant_lp_id, variant_creative_id, meta_entity_id, date)
);

CREATE INDEX idx_metrics_daily_run ON metrics_daily(run_id);
CREATE INDEX idx_metrics_daily_date ON metrics_daily(date);

-- 時間別メトリクス（直近のみ保持、古いものはアーカイブ）
CREATE TABLE IF NOT EXISTS metrics_hourly (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_entity_id TEXT REFERENCES meta_entities(id),

  datetime TEXT NOT NULL, -- YYYY-MM-DD HH:00:00

  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_metrics_hourly_run ON metrics_hourly(run_id);
CREATE INDEX idx_metrics_hourly_datetime ON metrics_hourly(datetime);

-- ============================================
-- 停止イベント
-- ============================================

CREATE TABLE IF NOT EXISTS stop_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 停止理由
  reason TEXT NOT NULL, -- budget_total, budget_daily, cpa_limit, cv_zero, error_consecutive, manual
  details_json TEXT, -- JSON: 詳細情報

  -- 対象
  target_type TEXT, -- run, adset, ad
  target_id TEXT,

  -- 実行結果
  executed INTEGER NOT NULL DEFAULT 0,
  execution_result TEXT, -- success, failed, manual_required
  error_message TEXT,

  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  executed_at TEXT
);

CREATE INDEX idx_stop_events_run ON stop_events(run_id);
CREATE INDEX idx_stop_events_triggered ON stop_events(triggered_at);

-- ============================================
-- 監査ログ
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,

  -- 操作
  action TEXT NOT NULL, -- create, update, delete, approve, reject, start, stop, etc.
  target_type TEXT NOT NULL, -- tenant, user, project, run, variant, deployment, etc.
  target_id TEXT NOT NULL,

  -- 差分
  before_state TEXT, -- JSON
  after_state TEXT, -- JSON

  -- メタ
  ip_address TEXT,
  user_agent TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- 通知
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 通知内容
  event_type TEXT NOT NULL, -- approval_request, approval_complete, run_started, run_stopped, stop_triggered, api_warning, daily_summary, run_complete
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json TEXT, -- JSON: 追加データ

  -- 配信
  channel TEXT NOT NULL, -- slack, email, webhook
  recipient TEXT NOT NULL, -- チャンネル/メールアドレス/URL

  -- 状態
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TEXT,
  error_message TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================
-- 初期データ
-- ============================================

-- デフォルトロール
INSERT OR IGNORE INTO roles (id, name, permissions) VALUES
  ('role_tenant_owner', 'tenant_owner', '["*"]'),
  ('role_operator', 'operator', '["run:*", "variant:*", "deployment:*", "meta:*", "report:read"]'),
  ('role_reviewer', 'reviewer', '["run:read", "variant:read", "approval:*", "report:read"]'),
  ('role_viewer', 'viewer', '["run:read", "variant:read", "report:read"]');
