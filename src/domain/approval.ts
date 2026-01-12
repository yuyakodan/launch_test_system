/**
 * Approval Flow System
 * 配信前の承認フローロジック
 */

import type { RoleName } from '../auth/permissions'

// 承認対象タイプ
export type ApprovalTargetType =
  | 'lp'
  | 'creative'
  | 'measurement'
  | 'stop_conditions'
  | 'budget'
  | 'url'

// 承認ステータス
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

// チェックリスト項目
export interface ChecklistItem {
  id: string
  label: string
  description?: string
  checked: boolean
  required: boolean
}

// 承認チェックリスト
export interface ApprovalChecklist {
  items: ChecklistItem[]
}

// 承認リクエスト
export interface ApprovalRequest {
  runId: string
  tenantId: string
  targetType: ApprovalTargetType
  targetId: string
  checklist: ApprovalChecklist
}

// 承認結果
export interface ApprovalResult {
  id: string
  runId: string
  tenantId: string
  targetType: ApprovalTargetType
  targetId: string
  status: ApprovalStatus
  checklist: ApprovalChecklist
  comment?: string
  reviewedBy: string
  reviewedAt: string
}

// 承認エラー
export class ApprovalError extends Error {
  public readonly reason: string
  public readonly details?: Record<string, unknown>

  constructor(message: string, reason: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApprovalError'
    this.reason = reason
    this.details = details
  }
}

// 対象タイプごとのデフォルトチェックリスト
export const DEFAULT_CHECKLISTS: Record<ApprovalTargetType, ChecklistItem[]> = {
  lp: [
    {
      id: 'lp_ng_words',
      label: 'NGワードチェック',
      description: '禁止表現が含まれていないことを確認',
      checked: false,
      required: true,
    },
    {
      id: 'lp_claims',
      label: '訴求内容の根拠確認',
      description: '記載内容に根拠があることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'lp_legal',
      label: '法的表示の確認',
      description: '必要な法的表示が含まれていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'lp_design',
      label: 'デザイン・レイアウト確認',
      description: 'ブランドガイドラインに準拠していることを確認',
      checked: false,
      required: false,
    },
  ],
  creative: [
    {
      id: 'creative_ng_words',
      label: 'NGワードチェック',
      description: '禁止表現が含まれていないことを確認',
      checked: false,
      required: true,
    },
    {
      id: 'creative_size',
      label: 'サイズ・解像度確認',
      description: '配信先の要件を満たしていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'creative_brand',
      label: 'ブランド要素確認',
      description: 'ロゴ・カラー等がガイドラインに準拠',
      checked: false,
      required: false,
    },
  ],
  measurement: [
    {
      id: 'measurement_utm',
      label: 'UTMパラメータ確認',
      description: '必要なUTMパラメータが設定されていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'measurement_events',
      label: 'イベント設定確認',
      description: 'CV等のイベントが正しく設定されていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'measurement_test',
      label: '計測テスト完了',
      description: 'イベント発火のテストが完了していることを確認',
      checked: false,
      required: true,
    },
  ],
  stop_conditions: [
    {
      id: 'stop_budget_total',
      label: '総予算上限設定',
      description: '総予算の上限が適切に設定されていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'stop_budget_daily',
      label: '日予算上限設定',
      description: '日予算の上限が適切に設定されていることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'stop_cpa',
      label: 'CPA上限設定',
      description: 'CPA上限が適切に設定されていることを確認',
      checked: false,
      required: false,
    },
  ],
  budget: [
    {
      id: 'budget_total',
      label: '総予算確認',
      description: '予算総額が承認範囲内であることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'budget_daily',
      label: '日予算確認',
      description: '日次予算が適切であることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'budget_account',
      label: '広告アカウント残高確認',
      description: '広告アカウントに十分な残高があることを確認',
      checked: false,
      required: true,
    },
  ],
  url: [
    {
      id: 'url_valid',
      label: 'URL有効性確認',
      description: 'URLが正しくアクセス可能であることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'url_ssl',
      label: 'SSL確認',
      description: 'HTTPSで配信されることを確認',
      checked: false,
      required: true,
    },
    {
      id: 'url_redirect',
      label: 'リダイレクト確認',
      description: '意図しないリダイレクトがないことを確認',
      checked: false,
      required: false,
    },
  ],
}

/**
 * 承認可能なロールかチェック
 */
export function canApprove(role: RoleName): boolean {
  return ['tenant_owner', 'reviewer'].includes(role)
}

/**
 * チェックリストが完了しているかチェック
 */
export function isChecklistComplete(checklist: ApprovalChecklist): boolean {
  const requiredItems = checklist.items.filter((item) => item.required)
  return requiredItems.every((item) => item.checked)
}

/**
 * 未完了の必須チェック項目を取得
 */
export function getIncompleteRequiredItems(checklist: ApprovalChecklist): ChecklistItem[] {
  return checklist.items.filter((item) => item.required && !item.checked)
}

/**
 * チェックリストを検証
 */
export function validateChecklist(checklist: ApprovalChecklist): void {
  const incomplete = getIncompleteRequiredItems(checklist)

  if (incomplete.length > 0) {
    throw new ApprovalError(
      `Required checklist items not completed: ${incomplete.map((i) => i.label).join(', ')}`,
      'CHECKLIST_INCOMPLETE',
      { incompleteItems: incomplete.map((i) => i.id) }
    )
  }
}

/**
 * 承認を実行
 */
export function approve(
  request: ApprovalRequest,
  role: RoleName,
  userId: string,
  comment?: string
): ApprovalResult {
  // ロールチェック
  if (!canApprove(role)) {
    throw new ApprovalError(
      `Role '${role}' is not authorized to approve`,
      'UNAUTHORIZED_ROLE',
      { role }
    )
  }

  // チェックリスト検証
  validateChecklist(request.checklist)

  return {
    id: `approval_${Date.now()}`,
    runId: request.runId,
    tenantId: request.tenantId,
    targetType: request.targetType,
    targetId: request.targetId,
    status: 'approved',
    checklist: request.checklist,
    comment,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
  }
}

/**
 * 却下を実行
 */
export function reject(
  request: ApprovalRequest,
  role: RoleName,
  userId: string,
  comment: string
): ApprovalResult {
  // ロールチェック
  if (!canApprove(role)) {
    throw new ApprovalError(
      `Role '${role}' is not authorized to reject`,
      'UNAUTHORIZED_ROLE',
      { role }
    )
  }

  // 却下にはコメント必須
  if (!comment || comment.trim().length === 0) {
    throw new ApprovalError(
      'Comment is required for rejection',
      'COMMENT_REQUIRED'
    )
  }

  return {
    id: `approval_${Date.now()}`,
    runId: request.runId,
    tenantId: request.tenantId,
    targetType: request.targetType,
    targetId: request.targetId,
    status: 'rejected',
    checklist: request.checklist,
    comment,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
  }
}

/**
 * デフォルトのチェックリストを取得
 */
export function getDefaultChecklist(targetType: ApprovalTargetType): ApprovalChecklist {
  return {
    items: DEFAULT_CHECKLISTS[targetType].map((item) => ({ ...item })),
  }
}

/**
 * Runの全承認対象を取得
 */
export function getRequiredApprovalTargets(): ApprovalTargetType[] {
  return ['lp', 'creative', 'measurement', 'stop_conditions', 'budget', 'url']
}

/**
 * 全対象が承認済みかチェック
 */
export function isFullyApproved(approvals: ApprovalResult[]): boolean {
  const requiredTargets = getRequiredApprovalTargets()

  for (const target of requiredTargets) {
    const approval = approvals.find((a) => a.targetType === target)
    if (!approval || approval.status !== 'approved') {
      return false
    }
  }

  return true
}

/**
 * 未承認の対象を取得
 */
export function getPendingApprovalTargets(approvals: ApprovalResult[]): ApprovalTargetType[] {
  const requiredTargets = getRequiredApprovalTargets()
  const approvedTargets = approvals
    .filter((a) => a.status === 'approved')
    .map((a) => a.targetType)

  return requiredTargets.filter((t) => !approvedTargets.includes(t))
}
