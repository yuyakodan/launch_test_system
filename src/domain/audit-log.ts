/**
 * Audit Log System
 * 全操作を記録する監査ログシステム
 */

// 監査アクション
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'publish'
  | 'unpublish'
  | 'login'
  | 'logout'

// 対象タイプ
export type AuditTargetType =
  | 'tenant'
  | 'user'
  | 'project'
  | 'run'
  | 'variant_lp'
  | 'variant_creative'
  | 'approval'
  | 'deployment'
  | 'meta_connection'
  | 'meta_entity'
  | 'stop_event'
  | 'notification'

// 監査ログエントリ
export interface AuditLogEntry {
  id: string
  tenantId: string
  userId: string | null
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  metadata: AuditMetadata
  createdAt: string
}

// メタデータ
export interface AuditMetadata {
  ipAddress?: string
  userAgent?: string
  requestId?: string
  sessionId?: string
}

// 監査ログ作成リクエスト
export interface CreateAuditLogRequest {
  tenantId: string
  userId?: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  metadata?: Partial<AuditMetadata>
}

// 監査ログ検索パラメータ
export interface AuditLogSearchParams {
  tenantId: string
  userId?: string
  action?: AuditAction
  targetType?: AuditTargetType
  targetId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

/**
 * 監査ログIDを生成
 */
export function generateAuditLogId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `audit_${timestamp}_${random}`
}

/**
 * 監査ログエントリを作成
 */
export function createAuditLogEntry(request: CreateAuditLogRequest): AuditLogEntry {
  return {
    id: generateAuditLogId(),
    tenantId: request.tenantId,
    userId: request.userId || null,
    action: request.action,
    targetType: request.targetType,
    targetId: request.targetId,
    beforeState: request.beforeState || null,
    afterState: request.afterState || null,
    metadata: {
      ipAddress: request.metadata?.ipAddress,
      userAgent: request.metadata?.userAgent,
      requestId: request.metadata?.requestId,
      sessionId: request.metadata?.sessionId,
    },
    createdAt: new Date().toISOString(),
  }
}

/**
 * 差分を計算
 */
export function calculateDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {}

  if (before == null && after == null) {
    return diff
  }

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ])

  for (const key of allKeys) {
    const beforeValue = before?.[key]
    const afterValue = after?.[key]

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = { before: beforeValue, after: afterValue }
    }
  }

  return diff
}

/**
 * アクションのラベルを取得
 */
export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: '作成',
    read: '閲覧',
    update: '更新',
    delete: '削除',
    approve: '承認',
    reject: '却下',
    start: '開始',
    stop: '停止',
    pause: '一時停止',
    resume: '再開',
    publish: '公開',
    unpublish: '非公開',
    login: 'ログイン',
    logout: 'ログアウト',
  }
  return labels[action]
}

/**
 * 対象タイプのラベルを取得
 */
export function getTargetTypeLabel(targetType: AuditTargetType): string {
  const labels: Record<AuditTargetType, string> = {
    tenant: 'テナント',
    user: 'ユーザー',
    project: 'プロジェクト',
    run: 'Run',
    variant_lp: 'LPバリアント',
    variant_creative: 'クリエイティブバリアント',
    approval: '承認',
    deployment: 'デプロイメント',
    meta_connection: 'Meta接続',
    meta_entity: 'Meta広告',
    stop_event: '停止イベント',
    notification: '通知',
  }
  return labels[targetType]
}

/**
 * 監査ログの説明文を生成
 */
export function generateAuditDescription(entry: AuditLogEntry): string {
  const actionLabel = getActionLabel(entry.action)
  const targetLabel = getTargetTypeLabel(entry.targetType)

  return `${targetLabel}（${entry.targetId}）を${actionLabel}しました`
}

/**
 * 監査ログをR2バックアップ用にシリアライズ
 */
export function serializeForBackup(entries: AuditLogEntry[]): string {
  return entries
    .map((entry) => JSON.stringify(entry))
    .join('\n')
}

/**
 * バックアップからデシリアライズ
 */
export function deserializeFromBackup(data: string): AuditLogEntry[] {
  return data
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditLogEntry)
}

/**
 * 監査ログのフィルタリング
 */
export function filterAuditLogs(
  entries: AuditLogEntry[],
  params: AuditLogSearchParams
): AuditLogEntry[] {
  return entries.filter((entry) => {
    // テナントIDは必須
    if (entry.tenantId !== params.tenantId) {
      return false
    }

    // ユーザーIDフィルタ
    if (params.userId && entry.userId !== params.userId) {
      return false
    }

    // アクションフィルタ
    if (params.action && entry.action !== params.action) {
      return false
    }

    // 対象タイプフィルタ
    if (params.targetType && entry.targetType !== params.targetType) {
      return false
    }

    // 対象IDフィルタ
    if (params.targetId && entry.targetId !== params.targetId) {
      return false
    }

    // 日付範囲フィルタ
    const entryDate = new Date(entry.createdAt)
    if (params.startDate && entryDate < new Date(params.startDate)) {
      return false
    }
    if (params.endDate && entryDate > new Date(params.endDate)) {
      return false
    }

    return true
  })
}

/**
 * 監査ログのページネーション
 */
export function paginateAuditLogs(
  entries: AuditLogEntry[],
  limit = 50,
  offset = 0
): { entries: AuditLogEntry[]; total: number; hasMore: boolean } {
  const total = entries.length
  const paginated = entries.slice(offset, offset + limit)

  return {
    entries: paginated,
    total,
    hasMore: offset + limit < total,
  }
}

/**
 * 重要なアクションかどうか判定
 */
export function isCriticalAction(action: AuditAction): boolean {
  const criticalActions: AuditAction[] = [
    'delete',
    'approve',
    'reject',
    'start',
    'stop',
    'publish',
    'unpublish',
  ]
  return criticalActions.includes(action)
}

/**
 * 監査ログエントリのハッシュを計算（改ざん検知用）
 */
export function calculateEntryHash(entry: AuditLogEntry): string {
  const content = JSON.stringify({
    id: entry.id,
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    createdAt: entry.createdAt,
  })

  // 簡易ハッシュ（本番では暗号学的ハッシュを使用）
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32bit integer
  }
  return hash.toString(16)
}
