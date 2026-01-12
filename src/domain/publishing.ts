/**
 * Publishing System
 * 公開・デプロイ・URL管理
 */

// デプロイメントステータス
export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'rollback'
  | 'cancelled'

// デプロイメント環境
export type DeploymentEnvironment = 'preview' | 'staging' | 'production'

// デプロイメント
export interface Deployment {
  id: string
  runId: string
  tenantId: string
  environment: DeploymentEnvironment
  status: DeploymentStatus
  version: number
  deployedBy: string
  deployedAt?: string
  completedAt?: string
  assets: DeployedAsset[]
  urls: GeneratedUrls
  error?: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// デプロイ済みアセット
export interface DeployedAsset {
  id: string
  type: 'lp' | 'creative' | 'config'
  variantId?: string
  sourceUrl: string
  deployedUrl: string
  hash: string
  size: number
  contentType: string
}

// 生成URL
export interface GeneratedUrls {
  baseUrl: string
  lpUrls: LPUrl[]
  creativeUrls: CreativeUrl[]
  trackingUrl?: string
  previewUrl?: string
}

// LP URL
export interface LPUrl {
  variantId: string
  url: string
  shortUrl?: string
  qrCodeUrl?: string
}

// クリエイティブURL
export interface CreativeUrl {
  variantId: string
  aspectRatio: string
  url: string
}

// URL設定
export interface UrlConfig {
  baseDomain: string
  useHttps: boolean
  pathPrefix?: string
  cdnDomain?: string
}

// プレビュー設定
export interface PreviewConfig {
  domain: string
  ttlSeconds: number
  requireAuth: boolean
}

// デプロイメントリクエスト
export interface DeploymentRequest {
  runId: string
  tenantId: string
  environment: DeploymentEnvironment
  deployedBy: string
  lpVariantIds?: string[]
  creativeVariantIds?: string[]
}

// デプロイメントログ
export interface DeploymentLog {
  deploymentId: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  details?: Record<string, unknown>
}

// ロールバックリクエスト
export interface RollbackRequest {
  deploymentId: string
  targetVersion: number
  reason: string
  requestedBy: string
}

/**
 * デプロイメントIDを生成
 */
export function generateDeploymentId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `deploy_${timestamp}_${random}`
}

/**
 * アセットIDを生成
 */
export function generateAssetId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `asset_${timestamp}_${random}`
}

/**
 * デプロイメントを作成
 */
export function createDeployment(request: DeploymentRequest): Deployment {
  const now = new Date().toISOString()

  return {
    id: generateDeploymentId(),
    runId: request.runId,
    tenantId: request.tenantId,
    environment: request.environment,
    status: 'pending',
    version: 1,
    deployedBy: request.deployedBy,
    assets: [],
    urls: {
      baseUrl: '',
      lpUrls: [],
      creativeUrls: [],
    },
    metadata: {},
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * デプロイメントステータスを更新
 */
export function updateDeploymentStatus(
  deployment: Deployment,
  status: DeploymentStatus,
  error?: string
): Deployment {
  const now = new Date().toISOString()

  return {
    ...deployment,
    status,
    error,
    completedAt: ['deployed', 'failed', 'rollback', 'cancelled'].includes(status)
      ? now
      : deployment.completedAt,
    updatedAt: now,
  }
}

/**
 * デプロイメントを開始
 */
export function startDeployment(deployment: Deployment): Deployment {
  return updateDeploymentStatus({
    ...deployment,
    deployedAt: new Date().toISOString(),
  }, 'deploying')
}

/**
 * デプロイメントを完了
 */
export function completeDeployment(
  deployment: Deployment,
  assets: DeployedAsset[],
  urls: GeneratedUrls
): Deployment {
  return {
    ...updateDeploymentStatus(deployment, 'deployed'),
    assets,
    urls,
  }
}

/**
 * デプロイメントを失敗
 */
export function failDeployment(
  deployment: Deployment,
  error: string
): Deployment {
  return updateDeploymentStatus(deployment, 'failed', error)
}

/**
 * LP URLを生成
 */
export function generateLPUrl(
  config: UrlConfig,
  tenantId: string,
  runId: string,
  variantId: string
): string {
  const protocol = config.useHttps ? 'https' : 'http'
  const pathPrefix = config.pathPrefix ? `/${config.pathPrefix}` : ''

  return `${protocol}://${config.baseDomain}${pathPrefix}/lp/${tenantId}/${runId}/${variantId}`
}

/**
 * クリエイティブURLを生成
 */
export function generateCreativeUrl(
  config: UrlConfig,
  tenantId: string,
  runId: string,
  variantId: string,
  aspectRatio: string
): string {
  const protocol = config.useHttps ? 'https' : 'http'
  const domain = config.cdnDomain || config.baseDomain
  const pathPrefix = config.pathPrefix ? `/${config.pathPrefix}` : ''

  return `${protocol}://${domain}${pathPrefix}/creative/${tenantId}/${runId}/${variantId}/${aspectRatio.replace(':', 'x')}`
}

/**
 * プレビューURLを生成
 */
export function generatePreviewUrl(
  config: PreviewConfig,
  deploymentId: string,
  variantId: string,
  token?: string
): string {
  const baseUrl = `https://${config.domain}/preview/${deploymentId}/${variantId}`

  if (config.requireAuth && token) {
    return `${baseUrl}?token=${token}`
  }

  return baseUrl
}

/**
 * 短縮URLを生成
 */
export function generateShortUrl(
  baseDomain: string,
  code: string
): string {
  return `https://${baseDomain}/s/${code}`
}

/**
 * 短縮コードを生成
 */
export function generateShortCode(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * QRコードURLを生成（外部サービス使用想定）
 */
export function generateQRCodeUrl(
  targetUrl: string,
  size = 200
): string {
  const encoded = encodeURIComponent(targetUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}

/**
 * トラッキングURLを生成
 */
export function generateTrackingUrl(
  config: UrlConfig,
  tenantId: string,
  runId: string,
  eventType: string
): string {
  const protocol = config.useHttps ? 'https' : 'http'
  const pathPrefix = config.pathPrefix ? `/${config.pathPrefix}` : ''

  return `${protocol}://${config.baseDomain}${pathPrefix}/track/${tenantId}/${runId}/${eventType}`
}

/**
 * デプロイアセットを作成
 */
export function createDeployedAsset(
  type: DeployedAsset['type'],
  sourceUrl: string,
  deployedUrl: string,
  options?: {
    variantId?: string
    hash?: string
    size?: number
    contentType?: string
  }
): DeployedAsset {
  return {
    id: generateAssetId(),
    type,
    variantId: options?.variantId,
    sourceUrl,
    deployedUrl,
    hash: options?.hash || generateHash(sourceUrl),
    size: options?.size || 0,
    contentType: options?.contentType || 'application/octet-stream',
  }
}

/**
 * 簡易ハッシュ生成
 */
export function generateHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * 全URLを生成
 */
export function generateAllUrls(
  config: UrlConfig,
  tenantId: string,
  runId: string,
  lpVariantIds: string[],
  creativeVariants: { id: string; aspectRatio: string }[]
): GeneratedUrls {
  const protocol = config.useHttps ? 'https' : 'http'
  const pathPrefix = config.pathPrefix ? `/${config.pathPrefix}` : ''
  const baseUrl = `${protocol}://${config.baseDomain}${pathPrefix}/${tenantId}/${runId}`

  const lpUrls: LPUrl[] = lpVariantIds.map((variantId) => {
    const url = generateLPUrl(config, tenantId, runId, variantId)
    const shortCode = generateShortCode()
    const shortUrl = generateShortUrl(config.baseDomain, shortCode)

    return {
      variantId,
      url,
      shortUrl,
      qrCodeUrl: generateQRCodeUrl(url),
    }
  })

  const creativeUrls: CreativeUrl[] = creativeVariants.map((variant) => ({
    variantId: variant.id,
    aspectRatio: variant.aspectRatio,
    url: generateCreativeUrl(config, tenantId, runId, variant.id, variant.aspectRatio),
  }))

  const trackingUrl = generateTrackingUrl(config, tenantId, runId, 'event')

  return {
    baseUrl,
    lpUrls,
    creativeUrls,
    trackingUrl,
  }
}

/**
 * デプロイログを作成
 */
export function createDeploymentLog(
  deploymentId: string,
  level: DeploymentLog['level'],
  message: string,
  details?: Record<string, unknown>
): DeploymentLog {
  return {
    deploymentId,
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  }
}

/**
 * ロールバック可能かチェック
 */
export function canRollback(deployment: Deployment): boolean {
  return deployment.status === 'deployed' && deployment.version > 1
}

/**
 * ロールバックを実行
 */
export function executeRollback(
  deployment: Deployment,
  request: RollbackRequest
): Deployment {
  if (!canRollback(deployment)) {
    throw new Error('Deployment cannot be rolled back')
  }

  return {
    ...updateDeploymentStatus(deployment, 'rollback'),
    metadata: {
      ...deployment.metadata,
      rollback: {
        targetVersion: request.targetVersion,
        reason: request.reason,
        requestedBy: request.requestedBy,
        rolledBackAt: new Date().toISOString(),
      },
    },
  }
}

/**
 * 環境間でのプロモーション可能かチェック
 */
export function canPromote(
  from: DeploymentEnvironment,
  to: DeploymentEnvironment
): boolean {
  const order: DeploymentEnvironment[] = ['preview', 'staging', 'production']
  const fromIndex = order.indexOf(from)
  const toIndex = order.indexOf(to)

  return fromIndex < toIndex
}

/**
 * 次のデプロイ環境を取得
 */
export function getNextEnvironment(
  current: DeploymentEnvironment
): DeploymentEnvironment | null {
  const order: DeploymentEnvironment[] = ['preview', 'staging', 'production']
  const currentIndex = order.indexOf(current)

  if (currentIndex < order.length - 1) {
    return order[currentIndex + 1]
  }

  return null
}

/**
 * デプロイ検証
 */
export function validateDeployment(deployment: Deployment): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!deployment.runId) {
    errors.push('Run ID is required')
  }

  if (!deployment.tenantId) {
    errors.push('Tenant ID is required')
  }

  if (!deployment.deployedBy) {
    errors.push('Deployer information is required')
  }

  if (deployment.environment === 'production' && deployment.assets.length === 0) {
    errors.push('Production deployment requires at least one asset')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * URL形式を検証
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * パス安全性チェック（パストラバーサル防止）
 */
export function isPathSafe(path: string): boolean {
  if (path.includes('..') || path.includes('//')) {
    return false
  }

  // 許可される文字のみ
  const safePattern = /^[a-zA-Z0-9_\-\/]+$/
  return safePattern.test(path)
}

/**
 * CDN キャッシュキーを生成
 */
export function generateCacheKey(
  tenantId: string,
  runId: string,
  variantId: string,
  version: number
): string {
  return `${tenantId}/${runId}/${variantId}/v${version}`
}

/**
 * CDN パージURLを生成
 */
export function generatePurgePattern(
  tenantId: string,
  runId: string,
  variantId?: string
): string {
  if (variantId) {
    return `/${tenantId}/${runId}/${variantId}/*`
  }
  return `/${tenantId}/${runId}/*`
}

/**
 * デプロイ環境のラベルを取得
 */
export function getEnvironmentLabel(env: DeploymentEnvironment): string {
  const labels: Record<DeploymentEnvironment, string> = {
    preview: 'プレビュー',
    staging: 'ステージング',
    production: '本番',
  }
  return labels[env]
}

/**
 * デプロイステータスのラベルを取得
 */
export function getDeploymentStatusLabel(status: DeploymentStatus): string {
  const labels: Record<DeploymentStatus, string> = {
    pending: '待機中',
    deploying: 'デプロイ中',
    deployed: 'デプロイ完了',
    failed: '失敗',
    rollback: 'ロールバック',
    cancelled: 'キャンセル',
  }
  return labels[status]
}

/**
 * デプロイの所要時間を計算（ミリ秒）
 */
export function calculateDeploymentDuration(deployment: Deployment): number | null {
  if (!deployment.deployedAt || !deployment.completedAt) {
    return null
  }

  const start = new Date(deployment.deployedAt).getTime()
  const end = new Date(deployment.completedAt).getTime()

  return end - start
}

/**
 * デプロイの所要時間をフォーマット
 */
export function formatDeploymentDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) {
    return `${seconds}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}分${remainingSeconds}秒`
}
