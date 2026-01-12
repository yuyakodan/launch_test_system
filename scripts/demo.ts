/**
 * ドメインロジック動作確認デモ
 */

// Meta API
import {
  generateOAuthUrl,
  isApiVersionValid,
  getApiVersionExpiryDays,
  createCampaignPayload,
  getCampaignObjectiveLabel,
  META_API_VERSION,
} from '../src/domain/meta-api'

// Measurement
import {
  generateUTMParams,
  appendUTMToUrl,
  createTrackingEvent,
  calculateDerivedMetrics,
  type DailyMetrics,
} from '../src/domain/measurement'

// Publishing
import {
  createDeployment,
  generateLPUrl,
  generateAllUrls,
  getEnvironmentLabel,
} from '../src/domain/publishing'

// Winner Learning
import {
  createTestResult,
  getMetricTypeLabel,
  getWinnerStatusLabel,
  type VariantResult,
} from '../src/domain/winner-learning'

// Notification
import {
  createNotification,
  createSlackMessage,
  getNotificationTypeLabel,
} from '../src/domain/notification'

console.log('=' .repeat(60))
console.log('🚀 Launch Test System - ドメインロジック動作確認')
console.log('=' .repeat(60))

// 1. Meta API
console.log('\n📱 1. Meta Marketing API連携')
console.log('-'.repeat(40))
console.log(`API Version: ${META_API_VERSION}`)
console.log(`バージョン有効: ${isApiVersionValid() ? '✅ Yes' : '❌ No'}`)
console.log(`残り日数: ${getApiVersionExpiryDays()}日`)

const oauthUrl = generateOAuthUrl(
  { appId: 'demo_app_id', appSecret: 'secret', redirectUri: 'https://example.com/callback' },
  'state_123'
)
console.log(`OAuth URL: ${oauthUrl.substring(0, 80)}...`)

const campaign = createCampaignPayload({
  runId: 'run_001',
  name: 'Summer Sale 2025',
  objective: 'OUTCOME_SALES',
  status: 'PAUSED',
  dailyBudget: 10000,
  specialAdCategories: ['NONE'],
})
console.log(`キャンペーン目的: ${getCampaignObjectiveLabel('OUTCOME_SALES')}`)
console.log(`キャンペーンペイロード:`, JSON.stringify(campaign, null, 2))

// 2. Measurement
console.log('\n📊 2. 計測・UTMシステム')
console.log('-'.repeat(40))

const utmParams = generateUTMParams({
  runId: 'run_001',
  variantId: 'var_001',
  source: 'facebook',
  medium: 'cpc',
  campaign: 'summer_sale',
  content: 'ad_variant_a',
})
console.log('UTMパラメータ:', utmParams)

const urlWithUtm = appendUTMToUrl('https://example.com/landing', utmParams)
console.log(`URL with UTM: ${urlWithUtm}`)

const event = createTrackingEvent('run_001', 'var_001', 'purchase', 'checkout_complete', {
  value: 9800,
  currency: 'JPY',
  metadata: { orderId: 'ORD-12345' },
})
console.log(`トラッキングイベント: ${event.eventType} - ${event.eventName}`)
console.log(`  値: ¥${event.value} (${event.currency})`)

const metrics: DailyMetrics = {
  runId: 'run_001',
  variantId: 'var_001',
  date: '2025-01-15',
  impressions: 50000,
  reach: 35000,
  clicks: 1500,
  spend: 75000,
  conversions: 45,
  revenue: 441000,
  cpc: 0, cpm: 0, ctr: 0, cvr: 0, cpa: 0, roas: 0,
}
const derived = calculateDerivedMetrics(metrics)
console.log(`メトリクス計算結果:`)
console.log(`  CTR: ${derived.ctr.toFixed(2)}%`)
console.log(`  CVR: ${derived.cvr.toFixed(2)}%`)
console.log(`  CPA: ¥${derived.cpa.toFixed(0)}`)
console.log(`  ROAS: ${derived.roas.toFixed(2)}x`)

// 3. Publishing
console.log('\n🚀 3. 公開・デプロイシステム')
console.log('-'.repeat(40))

const deployment = createDeployment({
  runId: 'run_001',
  tenantId: 'tenant_001',
  environment: 'staging',
  deployedBy: 'user_001',
})
console.log(`デプロイID: ${deployment.id}`)
console.log(`環境: ${getEnvironmentLabel(deployment.environment)}`)
console.log(`ステータス: ${deployment.status}`)

const urlConfig = {
  baseDomain: 'launch.example.com',
  useHttps: true,
  pathPrefix: 'v1',
}
const lpUrl = generateLPUrl(urlConfig, 'tenant_001', 'run_001', 'var_001')
console.log(`LP URL: ${lpUrl}`)

const allUrls = generateAllUrls(
  urlConfig,
  'tenant_001',
  'run_001',
  ['lp_var_001', 'lp_var_002'],
  [{ id: 'cr_001', aspectRatio: '1:1' }, { id: 'cr_002', aspectRatio: '9:16' }]
)
console.log(`生成URL数: LP ${allUrls.lpUrls.length}件, Creative ${allUrls.creativeUrls.length}件`)

// 4. Winner Learning
console.log('\n🏆 4. 勝ち判定・学習システム')
console.log('-'.repeat(40))

const variants: VariantResult[] = [
  {
    variantId: 'control',
    variantName: 'コントロール',
    isControl: true,
    sampleSize: 5000,
    conversions: 250,
    clicks: 2500,
    impressions: 50000,
    spend: 50000,
    revenue: 250000,
    metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
  },
  {
    variantId: 'treatment_a',
    variantName: 'バリアントA',
    isControl: false,
    sampleSize: 5000,
    conversions: 350,
    clicks: 2500,
    impressions: 50000,
    spend: 50000,
    revenue: 350000,
    metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
  },
]

const testResult = createTestResult(
  'run_001',
  'ab_test',
  '2025-01-01',
  '2025-01-15',
  'cvr',
  variants
)

console.log(`テストID: ${testResult.id}`)
console.log(`主要指標: ${getMetricTypeLabel(testResult.primaryMetric)}`)
console.log(`サンプルサイズ: ${testResult.sampleSize}`)
console.log(`勝者判定: ${getWinnerStatusLabel(testResult.winner.status)}`)
if (testResult.winner.winnerVariantId) {
  const winner = variants.find(v => v.variantId === testResult.winner.winnerVariantId)
  console.log(`  勝者: ${winner?.variantName}`)
  console.log(`  改善率: ${testResult.winner.improvement?.toFixed(1)}%`)
  console.log(`  信頼度: ${(testResult.winner.confidence * 100).toFixed(1)}%`)
}
console.log(`学習数: ${testResult.learnings.length}件`)
testResult.learnings.forEach((l, i) => {
  console.log(`  ${i + 1}. ${l.title}`)
})

// 5. Notification
console.log('\n🔔 5. 通知システム')
console.log('-'.repeat(40))

const notification = createNotification(
  'tenant_001',
  'winner_declared',
  'slack',
  [{ type: 'channel', target: '#marketing-alerts' }],
  'A/Bテスト勝者決定',
  'Run「Summer Sale 2025」でバリアントAが勝者に決定しました。改善率: 40%',
  { data: { runId: 'run_001', improvement: 40 } }
)

console.log(`通知ID: ${notification.id}`)
console.log(`タイプ: ${getNotificationTypeLabel(notification.type)}`)
console.log(`優先度: ${notification.priority}`)

const slackMsg = createSlackMessage(notification)
console.log(`Slackメッセージ:`)
console.log(`  text: ${slackMsg.text}`)
console.log(`  emoji: ${slackMsg.icon_emoji}`)
console.log(`  color: ${slackMsg.attachments?.[0]?.color}`)

console.log('\n' + '='.repeat(60))
console.log('✅ 全ドメインロジックの動作確認完了')
console.log('='.repeat(60))
