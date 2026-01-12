/**
 * Meta Marketing API Integration
 * Meta広告APIの連携・同期
 */

// API設定
export const META_API_VERSION = 'v22.0'
export const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

// APIバージョン有効期限（v22.0は2026年1月13日まで有効）
export const META_API_VERSION_EXPIRY = new Date('2026-01-13')

// OAuth設定
export interface MetaOAuthConfig {
  appId: string
  appSecret: string
  redirectUri: string
}

// トークン情報
export interface MetaToken {
  accessToken: string
  tokenType: 'short_lived' | 'long_lived'
  expiresAt: Date
  scopes: string[]
}

// Meta接続情報
export interface MetaConnection {
  id: string
  tenantId: string
  adAccountId: string
  businessId?: string
  token: MetaToken
  status: 'active' | 'expired' | 'revoked'
  createdAt: string
  updatedAt: string
}

// キャンペーン
export interface MetaCampaign {
  id: string
  metaId?: string
  runId: string
  name: string
  objective: CampaignObjective
  status: MetaEntityStatus
  dailyBudget?: number
  lifetimeBudget?: number
  startTime?: string
  endTime?: string
  specialAdCategories: SpecialAdCategory[]
  syncedAt?: string
}

// 広告セット
export interface MetaAdSet {
  id: string
  metaId?: string
  campaignId: string
  name: string
  status: MetaEntityStatus
  dailyBudget?: number
  lifetimeBudget?: number
  bidStrategy: BidStrategy
  targeting: MetaTargeting
  optimization: OptimizationGoal
  startTime?: string
  endTime?: string
  syncedAt?: string
}

// 広告
export interface MetaAd {
  id: string
  metaId?: string
  adSetId: string
  name: string
  status: MetaEntityStatus
  creativeId: string
  trackingSpecs?: TrackingSpec[]
  syncedAt?: string
}

// キャンペーン目的
export type CampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_APP_PROMOTION'

// 特別広告カテゴリ
export type SpecialAdCategory =
  | 'NONE'
  | 'EMPLOYMENT'
  | 'HOUSING'
  | 'CREDIT'
  | 'ISSUES_ELECTIONS_POLITICS'

// エンティティステータス
export type MetaEntityStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'

// 入札戦略
export type BidStrategy =
  | 'LOWEST_COST_WITHOUT_CAP'
  | 'LOWEST_COST_WITH_BID_CAP'
  | 'COST_CAP'
  | 'LOWEST_COST_WITH_MIN_ROAS'

// 最適化ゴール
export type OptimizationGoal =
  | 'IMPRESSIONS'
  | 'REACH'
  | 'LINK_CLICKS'
  | 'LANDING_PAGE_VIEWS'
  | 'CONVERSIONS'
  | 'VALUE'

// ターゲティング
export interface MetaTargeting {
  geoLocations?: {
    countries?: string[]
    regions?: { key: string }[]
    cities?: { key: string; radius?: number }[]
  }
  ageMin?: number
  ageMax?: number
  genders?: (0 | 1 | 2)[] // 0: unknown, 1: male, 2: female
  locales?: number[]
  interests?: { id: string; name: string }[]
  behaviors?: { id: string; name: string }[]
  customAudiences?: { id: string }[]
  excludedCustomAudiences?: { id: string }[]
}

// トラッキング仕様
export interface TrackingSpec {
  action_type: string
  fb_pixel?: string[]
  application?: string[]
}

// インサイトデータ
export interface MetaInsight {
  dateStart: string
  dateStop: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  cpc: number
  cpm: number
  ctr: number
  conversions: number
  costPerConversion: number
  frequency: number
  actions?: MetaAction[]
}

// アクション
export interface MetaAction {
  actionType: string
  value: number
}

// API応答
export interface MetaApiResponse<T> {
  success: boolean
  data?: T
  error?: MetaApiError
}

// APIエラー
export interface MetaApiError {
  code: number
  type: string
  message: string
  errorSubcode?: number
  isTransient: boolean
  errorUserTitle?: string
  errorUserMsg?: string
}

// 同期結果
export interface SyncResult {
  success: boolean
  syncedAt: string
  entityType: 'campaign' | 'adset' | 'ad' | 'insights'
  entityId: string
  metaId?: string
  error?: string
}

/**
 * OAuth認証URLを生成
 */
export function generateOAuthUrl(
  config: MetaOAuthConfig,
  state: string,
  scopes: string[] = ['ads_management', 'ads_read', 'business_management']
): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    scope: scopes.join(','),
    response_type: 'code',
  })

  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`
}

/**
 * 認証コードからトークンを取得
 */
export async function exchangeCodeForToken(
  config: MetaOAuthConfig,
  code: string
): Promise<MetaApiResponse<MetaToken>> {
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  })

  try {
    const response = await fetch(
      `${META_API_BASE_URL}/oauth/access_token?${params.toString()}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: parseMetaError(errorData),
      }
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        tokenType: 'short_lived',
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scopes: data.scope?.split(',') || [],
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: -1,
        type: 'NetworkError',
        message: error instanceof Error ? error.message : 'Network error',
        isTransient: true,
      },
    }
  }
}

/**
 * 短期トークンを長期トークンに交換
 */
export async function exchangeForLongLivedToken(
  config: MetaOAuthConfig,
  shortLivedToken: string
): Promise<MetaApiResponse<MetaToken>> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken,
  })

  try {
    const response = await fetch(
      `${META_API_BASE_URL}/oauth/access_token?${params.toString()}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: parseMetaError(errorData),
      }
    }

    const data = await response.json()

    // 長期トークンは約60日間有効
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        tokenType: 'long_lived',
        expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
        scopes: [],
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: -1,
        type: 'NetworkError',
        message: error instanceof Error ? error.message : 'Network error',
        isTransient: true,
      },
    }
  }
}

/**
 * トークンの有効性を検証
 */
export function isTokenValid(token: MetaToken, bufferMinutes = 60): boolean {
  const bufferMs = bufferMinutes * 60 * 1000
  return token.expiresAt.getTime() - bufferMs > Date.now()
}

/**
 * トークンの残り時間（日）を取得
 */
export function getTokenExpiryDays(token: MetaToken): number {
  const diff = token.expiresAt.getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

/**
 * APIバージョンの有効性をチェック
 */
export function isApiVersionValid(currentDate = new Date()): boolean {
  return currentDate < META_API_VERSION_EXPIRY
}

/**
 * APIバージョンの残り日数を取得
 */
export function getApiVersionExpiryDays(currentDate = new Date()): number {
  const diff = META_API_VERSION_EXPIRY.getTime() - currentDate.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

/**
 * キャンペーンを作成
 */
export function createCampaignPayload(
  campaign: Omit<MetaCampaign, 'id' | 'metaId' | 'syncedAt'>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    special_ad_categories: campaign.specialAdCategories,
  }

  if (campaign.dailyBudget) {
    payload.daily_budget = campaign.dailyBudget
  }

  if (campaign.lifetimeBudget) {
    payload.lifetime_budget = campaign.lifetimeBudget
  }

  if (campaign.startTime) {
    payload.start_time = campaign.startTime
  }

  if (campaign.endTime) {
    payload.end_time = campaign.endTime
  }

  return payload
}

/**
 * 広告セットを作成
 */
export function createAdSetPayload(
  adSet: Omit<MetaAdSet, 'id' | 'metaId' | 'syncedAt'>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: adSet.name,
    status: adSet.status,
    bid_strategy: adSet.bidStrategy,
    optimization_goal: adSet.optimization,
    targeting: convertTargetingToApiFormat(adSet.targeting),
  }

  if (adSet.dailyBudget) {
    payload.daily_budget = adSet.dailyBudget
  }

  if (adSet.lifetimeBudget) {
    payload.lifetime_budget = adSet.lifetimeBudget
  }

  if (adSet.startTime) {
    payload.start_time = adSet.startTime
  }

  if (adSet.endTime) {
    payload.end_time = adSet.endTime
  }

  return payload
}

/**
 * ターゲティングをAPI形式に変換
 */
export function convertTargetingToApiFormat(
  targeting: MetaTargeting
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (targeting.geoLocations) {
    result.geo_locations = {}
    if (targeting.geoLocations.countries) {
      result.geo_locations = {
        ...result.geo_locations,
        countries: targeting.geoLocations.countries,
      }
    }
    if (targeting.geoLocations.regions) {
      result.geo_locations = {
        ...result.geo_locations,
        regions: targeting.geoLocations.regions,
      }
    }
    if (targeting.geoLocations.cities) {
      result.geo_locations = {
        ...result.geo_locations,
        cities: targeting.geoLocations.cities,
      }
    }
  }

  if (targeting.ageMin !== undefined) {
    result.age_min = targeting.ageMin
  }

  if (targeting.ageMax !== undefined) {
    result.age_max = targeting.ageMax
  }

  if (targeting.genders) {
    result.genders = targeting.genders
  }

  if (targeting.locales) {
    result.locales = targeting.locales
  }

  if (targeting.interests) {
    result.interests = targeting.interests
  }

  if (targeting.behaviors) {
    result.behaviors = targeting.behaviors
  }

  if (targeting.customAudiences) {
    result.custom_audiences = targeting.customAudiences
  }

  if (targeting.excludedCustomAudiences) {
    result.excluded_custom_audiences = targeting.excludedCustomAudiences
  }

  return result
}

/**
 * 広告ペイロードを作成
 */
export function createAdPayload(
  ad: Omit<MetaAd, 'id' | 'metaId' | 'syncedAt'>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: ad.name,
    status: ad.status,
    creative: { creative_id: ad.creativeId },
  }

  if (ad.trackingSpecs) {
    payload.tracking_specs = ad.trackingSpecs
  }

  return payload
}

/**
 * インサイトを取得するためのフィールド
 */
export function getInsightsFields(): string[] {
  return [
    'impressions',
    'reach',
    'clicks',
    'spend',
    'cpc',
    'cpm',
    'ctr',
    'frequency',
    'actions',
    'cost_per_action_type',
  ]
}

/**
 * インサイトデータをパース
 */
export function parseInsightData(
  rawData: Record<string, unknown>
): MetaInsight {
  const actions = (rawData.actions as Array<{ action_type: string; value: string }>) || []
  const costPerAction = (rawData.cost_per_action_type as Array<{ action_type: string; value: string }>) || []

  const conversions = actions
    .filter((a) => a.action_type === 'purchase' || a.action_type === 'lead')
    .reduce((sum, a) => sum + parseFloat(a.value), 0)

  const costPerConversion = costPerAction.find(
    (c) => c.action_type === 'purchase' || c.action_type === 'lead'
  )

  return {
    dateStart: rawData.date_start as string,
    dateStop: rawData.date_stop as string,
    impressions: parseInt(rawData.impressions as string) || 0,
    reach: parseInt(rawData.reach as string) || 0,
    clicks: parseInt(rawData.clicks as string) || 0,
    spend: parseFloat(rawData.spend as string) || 0,
    cpc: parseFloat(rawData.cpc as string) || 0,
    cpm: parseFloat(rawData.cpm as string) || 0,
    ctr: parseFloat(rawData.ctr as string) || 0,
    conversions,
    costPerConversion: costPerConversion ? parseFloat(costPerConversion.value) : 0,
    frequency: parseFloat(rawData.frequency as string) || 0,
    actions: actions.map((a) => ({
      actionType: a.action_type,
      value: parseFloat(a.value),
    })),
  }
}

/**
 * Metaエラーをパース
 */
export function parseMetaError(errorData: Record<string, unknown>): MetaApiError {
  const error = errorData.error as Record<string, unknown> | undefined

  if (!error) {
    return {
      code: -1,
      type: 'UnknownError',
      message: 'Unknown error occurred',
      isTransient: false,
    }
  }

  const code = error.code as number
  const isTransient = isTransientError(code)

  return {
    code,
    type: error.type as string,
    message: error.message as string,
    errorSubcode: error.error_subcode as number | undefined,
    isTransient,
    errorUserTitle: error.error_user_title as string | undefined,
    errorUserMsg: error.error_user_msg as string | undefined,
  }
}

/**
 * 一時的なエラーかどうかを判定
 */
export function isTransientError(code: number): boolean {
  // 一時的なエラーコード
  const transientCodes = [
    1, // Unknown error
    2, // Service temporarily unavailable
    4, // Too many calls
    17, // Rate limit
    341, // Application limit reached
    368, // Temporarily blocked
  ]

  return transientCodes.includes(code)
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function isRetryableError(error: MetaApiError): boolean {
  return error.isTransient
}

/**
 * リトライ待機時間を計算（エクスポネンシャルバックオフ）
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
  // ジッターを追加
  const jitter = delay * 0.1 * Math.random()
  return Math.floor(delay + jitter)
}

/**
 * 同期結果を作成
 */
export function createSyncResult(
  entityType: SyncResult['entityType'],
  entityId: string,
  success: boolean,
  metaId?: string,
  error?: string
): SyncResult {
  return {
    success,
    syncedAt: new Date().toISOString(),
    entityType,
    entityId,
    metaId,
    error,
  }
}

/**
 * 接続を作成
 */
export function createMetaConnection(
  tenantId: string,
  adAccountId: string,
  token: MetaToken,
  businessId?: string
): MetaConnection {
  const now = new Date().toISOString()

  return {
    id: `meta_conn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    tenantId,
    adAccountId,
    businessId,
    token,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 接続ステータスを更新
 */
export function updateConnectionStatus(
  connection: MetaConnection,
  status: MetaConnection['status']
): MetaConnection {
  return {
    ...connection,
    status,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 接続トークンを更新
 */
export function updateConnectionToken(
  connection: MetaConnection,
  token: MetaToken
): MetaConnection {
  return {
    ...connection,
    token,
    status: 'active',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 予算をセント単位に変換（Meta APIは最小通貨単位を使用）
 */
export function convertToCents(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * セント単位から通常単位に変換
 */
export function convertFromCents(cents: number): number {
  return cents / 100
}

/**
 * 日付範囲のインサイト取得用パラメータを生成
 */
export function createInsightsParams(
  startDate: Date,
  endDate: Date,
  level: 'campaign' | 'adset' | 'ad' = 'ad',
  timeIncrement: 'all_days' | '1' | '7' | '28' = '1'
): Record<string, string> {
  return {
    level,
    time_range: JSON.stringify({
      since: formatDate(startDate),
      until: formatDate(endDate),
    }),
    time_increment: timeIncrement,
    fields: getInsightsFields().join(','),
  }
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * バッチリクエストを作成
 */
export function createBatchRequest(
  requests: Array<{
    method: 'GET' | 'POST' | 'DELETE'
    relativePath: string
    body?: Record<string, unknown>
  }>
): Array<{ method: string; relative_url: string; body?: string }> {
  return requests.map((req) => ({
    method: req.method,
    relative_url: req.relativePath,
    body: req.body ? JSON.stringify(req.body) : undefined,
  }))
}

/**
 * キャンペーン目的のラベルを取得
 */
export function getCampaignObjectiveLabel(objective: CampaignObjective): string {
  const labels: Record<CampaignObjective, string> = {
    OUTCOME_AWARENESS: '認知度',
    OUTCOME_ENGAGEMENT: 'エンゲージメント',
    OUTCOME_LEADS: 'リード獲得',
    OUTCOME_SALES: '売上',
    OUTCOME_TRAFFIC: 'トラフィック',
    OUTCOME_APP_PROMOTION: 'アプリ促進',
  }
  return labels[objective]
}

/**
 * 入札戦略のラベルを取得
 */
export function getBidStrategyLabel(strategy: BidStrategy): string {
  const labels: Record<BidStrategy, string> = {
    LOWEST_COST_WITHOUT_CAP: '最低コスト（上限なし）',
    LOWEST_COST_WITH_BID_CAP: '最低コスト（入札上限あり）',
    COST_CAP: 'コスト上限',
    LOWEST_COST_WITH_MIN_ROAS: '最低ROAS',
  }
  return labels[strategy]
}

/**
 * エンティティステータスのラベルを取得
 */
export function getEntityStatusLabel(status: MetaEntityStatus): string {
  const labels: Record<MetaEntityStatus, string> = {
    ACTIVE: '配信中',
    PAUSED: '一時停止',
    DELETED: '削除済み',
    ARCHIVED: 'アーカイブ済み',
  }
  return labels[status]
}
