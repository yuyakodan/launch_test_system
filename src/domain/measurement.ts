/**
 * Measurement & Tracking System
 * 計測・UTM・イベント管理
 */

// UTMパラメータ
export interface UTMParams {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content?: string
  utm_term?: string
}

// UTMパラメータ設定
export interface UTMConfig {
  runId: string
  variantId: string
  source: string
  medium: 'cpc' | 'cpm' | 'social' | 'email' | 'affiliate' | 'display'
  campaign: string
  content?: string
  term?: string
}

// トラッキングイベント
export interface TrackingEvent {
  id: string
  runId: string
  variantId: string
  eventType: EventType
  eventName: string
  value?: number
  currency?: string
  metadata: Record<string, unknown>
  userAgent?: string
  ipAddress?: string
  referrer?: string
  timestamp: string
}

// イベントタイプ
export type EventType =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'purchase'
  | 'lead'
  | 'sign_up'
  | 'add_to_cart'
  | 'checkout'
  | 'custom'

// コンバージョン定義
export interface ConversionDefinition {
  id: string
  runId: string
  name: string
  eventType: EventType
  eventName: string
  value?: number
  isRevenue: boolean
  attributionWindow: number // days
  priority: number
}

// コンバージョンレコード
export interface ConversionRecord {
  id: string
  definitionId: string
  runId: string
  variantId: string
  eventId: string
  value: number
  attributed: boolean
  attributionSource?: string
  timestamp: string
}

// 時間単位メトリクス
export interface HourlyMetrics {
  runId: string
  variantId: string
  hour: string // ISO format hour (YYYY-MM-DDTHH:00:00Z)
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
}

// 日単位メトリクス
export interface DailyMetrics {
  runId: string
  variantId: string
  date: string // YYYY-MM-DD
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  cpc: number
  cpm: number
  ctr: number
  cvr: number
  cpa: number
  roas: number
}

// メトリクス集計結果
export interface AggregatedMetrics {
  totalImpressions: number
  totalReach: number
  totalClicks: number
  totalSpend: number
  totalConversions: number
  totalRevenue: number
  avgCpc: number
  avgCpm: number
  avgCtr: number
  avgCvr: number
  avgCpa: number
  roas: number
}

// トラッキングピクセル設定
export interface PixelConfig {
  id: string
  runId: string
  platform: 'meta' | 'google' | 'custom'
  pixelId: string
  events: string[]
  enabled: boolean
}

/**
 * イベントIDを生成
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `evt_${timestamp}_${random}`
}

/**
 * コンバージョンIDを生成
 */
export function generateConversionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `conv_${timestamp}_${random}`
}

/**
 * UTMパラメータを生成
 */
export function generateUTMParams(config: UTMConfig): UTMParams {
  const params: UTMParams = {
    utm_source: config.source,
    utm_medium: config.medium,
    utm_campaign: config.campaign,
  }

  if (config.content) {
    params.utm_content = config.content
  }

  if (config.term) {
    params.utm_term = config.term
  }

  return params
}

/**
 * UTMパラメータをクエリ文字列に変換
 */
export function utmToQueryString(params: UTMParams): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value)
    }
  })

  return searchParams.toString()
}

/**
 * UTMパラメータ付きURLを生成
 */
export function appendUTMToUrl(baseUrl: string, params: UTMParams): string {
  const url = new URL(baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

/**
 * URLからUTMパラメータをパース
 */
export function parseUTMFromUrl(url: string): UTMParams | null {
  try {
    const parsed = new URL(url)
    const source = parsed.searchParams.get('utm_source')
    const medium = parsed.searchParams.get('utm_medium')
    const campaign = parsed.searchParams.get('utm_campaign')

    if (!source || !medium || !campaign) {
      return null
    }

    return {
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
      utm_content: parsed.searchParams.get('utm_content') || undefined,
      utm_term: parsed.searchParams.get('utm_term') || undefined,
    }
  } catch {
    return null
  }
}

/**
 * バリアント識別子をUTMから生成
 */
export function generateVariantIdentifier(
  runId: string,
  variantId: string,
  platform: string = 'meta'
): string {
  return `${platform}_${runId}_${variantId}`
}

/**
 * バリアント識別子をパース
 */
export function parseVariantIdentifier(
  identifier: string
): { platform: string; runId: string; variantId: string } | null {
  // Format: platform_runId_variantId
  // Both runId and variantId may contain underscores
  const firstUnderscoreIndex = identifier.indexOf('_')
  if (firstUnderscoreIndex === -1) {
    return null
  }

  const lastUnderscoreIndex = identifier.lastIndexOf('_')
  if (lastUnderscoreIndex === firstUnderscoreIndex) {
    return null
  }

  const platform = identifier.substring(0, firstUnderscoreIndex)
  const variantId = identifier.substring(lastUnderscoreIndex + 1)
  const runId = identifier.substring(firstUnderscoreIndex + 1, lastUnderscoreIndex)

  if (!platform || !runId || !variantId) {
    return null
  }

  return {
    platform,
    runId,
    variantId,
  }
}

/**
 * トラッキングイベントを作成
 */
export function createTrackingEvent(
  runId: string,
  variantId: string,
  eventType: EventType,
  eventName: string,
  options?: {
    value?: number
    currency?: string
    metadata?: Record<string, unknown>
    userAgent?: string
    ipAddress?: string
    referrer?: string
  }
): TrackingEvent {
  return {
    id: generateEventId(),
    runId,
    variantId,
    eventType,
    eventName,
    value: options?.value,
    currency: options?.currency,
    metadata: options?.metadata || {},
    userAgent: options?.userAgent,
    ipAddress: options?.ipAddress,
    referrer: options?.referrer,
    timestamp: new Date().toISOString(),
  }
}

/**
 * コンバージョン定義を作成
 */
export function createConversionDefinition(
  runId: string,
  name: string,
  eventType: EventType,
  eventName: string,
  options?: {
    value?: number
    isRevenue?: boolean
    attributionWindow?: number
    priority?: number
  }
): ConversionDefinition {
  return {
    id: generateConversionId(),
    runId,
    name,
    eventType,
    eventName,
    value: options?.value,
    isRevenue: options?.isRevenue ?? false,
    attributionWindow: options?.attributionWindow ?? 7,
    priority: options?.priority ?? 0,
  }
}

/**
 * イベントがコンバージョン定義にマッチするかチェック
 */
export function isConversionEvent(
  event: TrackingEvent,
  definition: ConversionDefinition
): boolean {
  if (event.runId !== definition.runId) {
    return false
  }

  if (event.eventType !== definition.eventType) {
    return false
  }

  if (definition.eventName && event.eventName !== definition.eventName) {
    return false
  }

  return true
}

/**
 * コンバージョンレコードを作成
 */
export function createConversionRecord(
  event: TrackingEvent,
  definition: ConversionDefinition,
  attributionSource?: string
): ConversionRecord {
  return {
    id: generateConversionId(),
    definitionId: definition.id,
    runId: event.runId,
    variantId: event.variantId,
    eventId: event.id,
    value: event.value ?? definition.value ?? 0,
    attributed: true,
    attributionSource,
    timestamp: event.timestamp,
  }
}

/**
 * 時間単位メトリクスを初期化
 */
export function createHourlyMetrics(
  runId: string,
  variantId: string,
  hour: Date
): HourlyMetrics {
  const hourStart = new Date(hour)
  hourStart.setMinutes(0, 0, 0)

  return {
    runId,
    variantId,
    hour: hourStart.toISOString(),
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    revenue: 0,
  }
}

/**
 * 日単位メトリクスを初期化
 */
export function createDailyMetrics(
  runId: string,
  variantId: string,
  date: Date
): DailyMetrics {
  const dateStr = formatDateString(date)

  return {
    runId,
    variantId,
    date: dateStr,
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    revenue: 0,
    cpc: 0,
    cpm: 0,
    ctr: 0,
    cvr: 0,
    cpa: 0,
    roas: 0,
  }
}

/**
 * 日単位メトリクスの派生値を計算
 */
export function calculateDerivedMetrics(metrics: DailyMetrics): DailyMetrics {
  const { impressions, clicks, spend, conversions, revenue } = metrics

  return {
    ...metrics,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? revenue / spend : 0,
  }
}

/**
 * 時間単位メトリクスを更新
 */
export function updateHourlyMetrics(
  metrics: HourlyMetrics,
  update: Partial<Omit<HourlyMetrics, 'runId' | 'variantId' | 'hour'>>
): HourlyMetrics {
  return {
    ...metrics,
    impressions: metrics.impressions + (update.impressions || 0),
    clicks: metrics.clicks + (update.clicks || 0),
    spend: metrics.spend + (update.spend || 0),
    conversions: metrics.conversions + (update.conversions || 0),
    revenue: metrics.revenue + (update.revenue || 0),
  }
}

/**
 * 時間単位メトリクスを日単位に集約
 */
export function aggregateHourlyToDaily(
  hourlyMetrics: HourlyMetrics[],
  date: string
): DailyMetrics | null {
  const filtered = hourlyMetrics.filter((m) => m.hour.startsWith(date))

  if (filtered.length === 0) {
    return null
  }

  const runId = filtered[0].runId
  const variantId = filtered[0].variantId

  const aggregated: DailyMetrics = {
    runId,
    variantId,
    date,
    impressions: 0,
    reach: 0, // Reach cannot be summed, needs deduplication
    clicks: 0,
    spend: 0,
    conversions: 0,
    revenue: 0,
    cpc: 0,
    cpm: 0,
    ctr: 0,
    cvr: 0,
    cpa: 0,
    roas: 0,
  }

  for (const metric of filtered) {
    aggregated.impressions += metric.impressions
    aggregated.clicks += metric.clicks
    aggregated.spend += metric.spend
    aggregated.conversions += metric.conversions
    aggregated.revenue += metric.revenue
  }

  return calculateDerivedMetrics(aggregated)
}

/**
 * 複数日のメトリクスを集約
 */
export function aggregateDailyMetrics(
  dailyMetrics: DailyMetrics[]
): AggregatedMetrics {
  const result: AggregatedMetrics = {
    totalImpressions: 0,
    totalReach: 0,
    totalClicks: 0,
    totalSpend: 0,
    totalConversions: 0,
    totalRevenue: 0,
    avgCpc: 0,
    avgCpm: 0,
    avgCtr: 0,
    avgCvr: 0,
    avgCpa: 0,
    roas: 0,
  }

  if (dailyMetrics.length === 0) {
    return result
  }

  for (const metric of dailyMetrics) {
    result.totalImpressions += metric.impressions
    result.totalReach += metric.reach
    result.totalClicks += metric.clicks
    result.totalSpend += metric.spend
    result.totalConversions += metric.conversions
    result.totalRevenue += metric.revenue
  }

  // Calculate derived metrics
  if (result.totalClicks > 0) {
    result.avgCpc = result.totalSpend / result.totalClicks
  }

  if (result.totalImpressions > 0) {
    result.avgCpm = (result.totalSpend / result.totalImpressions) * 1000
    result.avgCtr = (result.totalClicks / result.totalImpressions) * 100
  }

  if (result.totalClicks > 0) {
    result.avgCvr = (result.totalConversions / result.totalClicks) * 100
  }

  if (result.totalConversions > 0) {
    result.avgCpa = result.totalSpend / result.totalConversions
  }

  if (result.totalSpend > 0) {
    result.roas = result.totalRevenue / result.totalSpend
  }

  return result
}

/**
 * バリアント間のメトリクス比較
 */
export function compareVariantMetrics(
  variantA: AggregatedMetrics,
  variantB: AggregatedMetrics
): {
  impressionsDiff: number
  clicksDiff: number
  conversionsDiff: number
  ctrDiff: number
  cvrDiff: number
  cpaDiff: number
  roasDiff: number
  winner: 'A' | 'B' | 'tie'
} {
  const impressionsDiff = variantA.totalImpressions - variantB.totalImpressions
  const clicksDiff = variantA.totalClicks - variantB.totalClicks
  const conversionsDiff = variantA.totalConversions - variantB.totalConversions
  const ctrDiff = variantA.avgCtr - variantB.avgCtr
  const cvrDiff = variantA.avgCvr - variantB.avgCvr
  const cpaDiff = variantB.avgCpa - variantA.avgCpa // Lower CPA is better
  const roasDiff = variantA.roas - variantB.roas

  // Determine winner based on ROAS (primary) and CVR (secondary)
  let winner: 'A' | 'B' | 'tie' = 'tie'
  const threshold = 0.1 // 10% difference threshold

  if (variantA.roas > 0 && variantB.roas > 0) {
    const roasRatio = variantA.roas / variantB.roas
    if (roasRatio > 1 + threshold) {
      winner = 'A'
    } else if (roasRatio < 1 - threshold) {
      winner = 'B'
    }
  } else if (variantA.avgCvr > 0 && variantB.avgCvr > 0) {
    const cvrRatio = variantA.avgCvr / variantB.avgCvr
    if (cvrRatio > 1 + threshold) {
      winner = 'A'
    } else if (cvrRatio < 1 - threshold) {
      winner = 'B'
    }
  }

  return {
    impressionsDiff,
    clicksDiff,
    conversionsDiff,
    ctrDiff,
    cvrDiff,
    cpaDiff,
    roasDiff,
    winner,
  }
}

/**
 * 日付文字列をフォーマット（YYYY-MM-DD）
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 時刻文字列をフォーマット（YYYY-MM-DDTHH:00:00Z）
 */
export function formatHourString(date: Date): string {
  const hourDate = new Date(date)
  hourDate.setMinutes(0, 0, 0)
  return hourDate.toISOString()
}

/**
 * 日付範囲を生成
 */
export function generateDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    dates.push(formatDateString(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * 時間範囲を生成
 */
export function generateHourRange(startDate: Date, endDate: Date): string[] {
  const hours: string[] = []
  const current = new Date(startDate)
  current.setMinutes(0, 0, 0)

  while (current <= endDate) {
    hours.push(formatHourString(current))
    current.setHours(current.getHours() + 1)
  }

  return hours
}

/**
 * トラッキングピクセル設定を作成
 */
export function createPixelConfig(
  runId: string,
  platform: PixelConfig['platform'],
  pixelId: string,
  events: string[] = ['PageView', 'Lead', 'Purchase']
): PixelConfig {
  return {
    id: `pixel_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    runId,
    platform,
    pixelId,
    events,
    enabled: true,
  }
}

/**
 * Metaピクセルコードを生成
 */
export function generateMetaPixelCode(pixelId: string, events?: string[]): string {
  const baseCode = `
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->`.trim()

  return baseCode
}

/**
 * Google Analyticsタグを生成
 */
export function generateGATag(measurementId: string): string {
  return `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${measurementId}');
</script>
<!-- End Google Analytics -->`.trim()
}

/**
 * イベントタイプのラベルを取得
 */
export function getEventTypeLabel(eventType: EventType): string {
  const labels: Record<EventType, string> = {
    page_view: 'ページビュー',
    click: 'クリック',
    form_submit: 'フォーム送信',
    purchase: '購入',
    lead: 'リード',
    sign_up: '会員登録',
    add_to_cart: 'カート追加',
    checkout: 'チェックアウト',
    custom: 'カスタム',
  }
  return labels[eventType]
}

/**
 * メトリクス期間のラベルを取得
 */
export function getMetricsPeriodLabel(
  startDate: string,
  endDate: string
): string {
  if (startDate === endDate) {
    return startDate
  }
  return `${startDate} 〜 ${endDate}`
}
