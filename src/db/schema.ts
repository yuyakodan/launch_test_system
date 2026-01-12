/**
 * Database Schema Type Definitions
 * Auto-generated types for D1 database tables
 */

// ============================================
// テナント・ユーザー・権限管理
// ============================================

export interface Tenant {
  id: string
  name: string
  plan: 'lite' | 'standard' | 'pro' | 'growth'
  settings: TenantSettings | null
  created_at: string
  updated_at: string
}

export interface TenantSettings {
  notification_slack_webhook?: string
  notification_email?: string
  custom_domain?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  mfa_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: 'tenant_owner' | 'operator' | 'reviewer' | 'viewer'
  permissions: string[]
  created_at: string
}

export interface Membership {
  id: string
  tenant_id: string
  user_id: string
  role_id: string
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
  created_at: string
}

// ============================================
// プロジェクト
// ============================================

export interface Project {
  id: string
  tenant_id: string
  name: string
  description: string | null
  cv_definition: CVDefinition
  ng_expressions: string[] | null
  brand_settings: BrandSettings | null
  created_at: string
  updated_at: string
}

export interface CVDefinition {
  event_name: string
  completion_condition: string
}

export interface BrandSettings {
  primary_color?: string
  logo_url?: string
  font_family?: string
}

// ============================================
// Run（実験単位）
// ============================================

export type RunState =
  | 'draft'
  | 'designing'
  | 'generating'
  | 'ready_for_review'
  | 'approved'
  | 'publishing'
  | 'live'
  | 'running'
  | 'paused'
  | 'completed'
  | 'archived'

export interface Run {
  id: string
  project_id: string
  tenant_id: string
  name: string
  state: RunState

  // ヒアリング入力
  product_info: ProductInfo | null
  evidence: Evidence | null
  faqs: FAQ[] | null
  target_hypothesis: TargetHypothesis | null
  offer: Offer | null

  // 検証設計
  appeal_axes: AppealAxis[] | null
  experiment_plan: ExperimentPlan | null

  // 停止条件
  stop_conditions: StopConditions
  budget_total: number | null
  budget_daily: number | null

  // 結果
  winner_variant_id: string | null
  learning_report: LearningReport | null

  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductInfo {
  name: string
  price: number
  description: string
  capabilities: string[]
  limitations: string[]
}

export interface Evidence {
  numbers: string[]
  cases: string[]
  reviews: string[]
}

export interface FAQ {
  question: string
  answer: string
}

export interface TargetHypothesis {
  demographics: string[]
  interests: string[]
  pain_points: string[]
}

export interface Offer {
  main_offer: string
  sub_offers: string[]
  urgency?: string
}

export interface AppealAxis {
  id: string
  name: string
  headline: string
  description: string
}

export interface ExperimentPlan {
  exploration_axes: string[]
  minimum_sample: number
  win_criteria: WinCriteria
}

export interface WinCriteria {
  metric: 'cpa' | 'cvr' | 'ctr'
  comparison: 'min' | 'max'
  min_sample: number
  confidence_level: number
}

export interface StopConditions {
  budget_total_enabled: boolean
  budget_daily_enabled: boolean
  cpa_limit_enabled: boolean
  cpa_limit?: number
  cpa_min_sample?: number
  cv_zero_hours_enabled: boolean
  cv_zero_hours?: number
  error_consecutive_enabled: boolean
  error_consecutive_count?: number
}

export interface LearningReport {
  winning_elements: WinningElement[]
  losing_hypotheses: string[]
  next_run_instructions: NextRunInstruction[]
}

export interface WinningElement {
  type: 'appeal' | 'structure' | 'cta' | 'creative'
  element_id: string
  description: string
}

export interface NextRunInstruction {
  element_type: string
  action: 'fix' | 'explore'
  value?: string
}

// ============================================
// バリアント
// ============================================

export type VariantStatus = 'draft' | 'submitted' | 'approved' | 'published'

export interface VariantLP {
  id: string
  run_id: string
  tenant_id: string
  name: string
  appeal_axis: string
  structure_type: string
  content_json: LPContent
  version: number
  status: VariantStatus
  public_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface LPContent {
  sections: LPSection[]
}

export interface LPSection {
  id: string
  type: 'hero' | 'benefits' | 'testimonials' | 'cta' | 'faq' | 'footer'
  content: Record<string, unknown>
}

export interface VariantCreative {
  id: string
  run_id: string
  tenant_id: string
  name: string
  aspect_ratio: '1:1' | '4:5' | '9:16'
  width: number
  height: number
  asset_url: string
  layers_json: CreativeLayer[] | null
  version: number
  status: VariantStatus
  created_at: string
  updated_at: string
}

export interface CreativeLayer {
  id: string
  type: 'text' | 'image' | 'shape'
  content: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: Record<string, unknown>
}

// ============================================
// 承認
// ============================================

export type ApprovalTargetType =
  | 'lp'
  | 'creative'
  | 'measurement'
  | 'stop_conditions'
  | 'budget'
  | 'url'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Approval {
  id: string
  run_id: string
  tenant_id: string
  target_type: ApprovalTargetType
  target_id: string
  checklist_json: ApprovalChecklist
  status: ApprovalStatus
  comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface ApprovalChecklist {
  items: ApprovalChecklistItem[]
}

export interface ApprovalChecklistItem {
  id: string
  label: string
  checked: boolean
  required: boolean
}

// ============================================
// デプロイメント
// ============================================

export type DeploymentStatus = 'active' | 'stopped' | 'rolled_back'

export interface Deployment {
  id: string
  run_id: string
  tenant_id: string
  variant_lp_id: string | null
  public_url: string
  snapshot_url: string
  status: DeploymentStatus
  deployed_by: string
  deployed_at: string
  stopped_at: string | null
}

// ============================================
// Meta連携
// ============================================

export type MetaConnectionStatus = 'active' | 'expired' | 'revoked'

export interface MetaConnection {
  id: string
  tenant_id: string
  ad_account_id: string
  access_token_encrypted: string
  token_expires_at: string | null
  refresh_token_encrypted: string | null
  status: MetaConnectionStatus
  connected_by: string
  connected_at: string
  updated_at: string
}

export type MetaEntityType = 'campaign' | 'adset' | 'ad'
export type MetaEntityStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'deleted'

export interface MetaEntity {
  id: string
  run_id: string
  tenant_id: string
  meta_connection_id: string
  entity_type: MetaEntityType
  external_id: string
  parent_id: string | null
  config_json: MetaEntityConfig
  status: MetaEntityStatus
  review_status: 'pending' | 'approved' | 'rejected' | null
  budget_daily: number | null
  budget_lifetime: number | null
  created_at: string
  updated_at: string
}

export interface MetaEntityConfig {
  name: string
  objective?: string
  targeting?: Record<string, unknown>
  creative?: Record<string, unknown>
}

// ============================================
// メトリクス
// ============================================

export interface MetricsDaily {
  id: string
  run_id: string
  tenant_id: string
  variant_lp_id: string | null
  variant_creative_id: string | null
  meta_entity_id: string | null
  date: string
  impressions: number
  clicks: number
  spend: number
  page_views: number
  cta_clicks: number
  form_starts: number
  conversions: number
  ctr: number | null
  cpc: number | null
  cpa: number | null
  cvr: number | null
  created_at: string
  updated_at: string
}

export interface MetricsHourly {
  id: string
  run_id: string
  tenant_id: string
  meta_entity_id: string | null
  datetime: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  created_at: string
}

// ============================================
// 停止イベント
// ============================================

export type StopReason =
  | 'budget_total'
  | 'budget_daily'
  | 'cpa_limit'
  | 'cv_zero'
  | 'error_consecutive'
  | 'manual'

export type StopExecutionResult = 'success' | 'failed' | 'manual_required'

export interface StopEvent {
  id: string
  run_id: string
  tenant_id: string
  reason: StopReason
  details_json: Record<string, unknown> | null
  target_type: 'run' | 'adset' | 'ad' | null
  target_id: string | null
  executed: boolean
  execution_result: StopExecutionResult | null
  error_message: string | null
  triggered_at: string
  executed_at: string | null
}

// ============================================
// 監査ログ
// ============================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'start'
  | 'stop'
  | 'publish'
  | 'unpublish'

export interface AuditLog {
  id: string
  tenant_id: string
  user_id: string | null
  action: AuditAction
  target_type: string
  target_id: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ============================================
// 通知
// ============================================

export type NotificationEventType =
  | 'approval_request'
  | 'approval_complete'
  | 'run_started'
  | 'run_stopped'
  | 'stop_triggered'
  | 'api_warning'
  | 'daily_summary'
  | 'run_complete'

export type NotificationChannel = 'slack' | 'email' | 'webhook'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Notification {
  id: string
  tenant_id: string
  event_type: NotificationEventType
  title: string
  body: string
  data_json: Record<string, unknown> | null
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
  sent_at: string | null
  error_message: string | null
  created_at: string
}
