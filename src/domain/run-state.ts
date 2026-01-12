/**
 * Run State Machine
 * Run単位の状態管理と状態遷移ロジック
 */

import type { RoleName } from '../auth/permissions'

// Run状態
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

// 状態遷移イベント
export type RunTransitionEvent =
  | 'start_design'
  | 'start_generation'
  | 'submit_for_review'
  | 'approve'
  | 'reject'
  | 'start_publish'
  | 'publish_complete'
  | 'start_delivery'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'archive'
  | 'cancel'

// 状態遷移定義
export interface StateTransition {
  from: RunState
  to: RunState
  event: RunTransitionEvent
  allowedRoles: RoleName[]
  requiresApproval?: boolean
  requiresBudget?: boolean
}

// 許可される状態遷移
export const STATE_TRANSITIONS: StateTransition[] = [
  // Draft → Designing
  {
    from: 'draft',
    to: 'designing',
    event: 'start_design',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Designing → Generating
  {
    from: 'designing',
    to: 'generating',
    event: 'start_generation',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Generating → ReadyForReview
  {
    from: 'generating',
    to: 'ready_for_review',
    event: 'submit_for_review',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // ReadyForReview → Approved (承認)
  {
    from: 'ready_for_review',
    to: 'approved',
    event: 'approve',
    allowedRoles: ['tenant_owner', 'reviewer'],
  },

  // ReadyForReview → Designing (差し戻し)
  {
    from: 'ready_for_review',
    to: 'designing',
    event: 'reject',
    allowedRoles: ['tenant_owner', 'reviewer'],
  },

  // Approved → Publishing
  {
    from: 'approved',
    to: 'publishing',
    event: 'start_publish',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Publishing → Live
  {
    from: 'publishing',
    to: 'live',
    event: 'publish_complete',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Live → Running (配信開始) - 承認必須、予算必須
  {
    from: 'live',
    to: 'running',
    event: 'start_delivery',
    allowedRoles: ['tenant_owner', 'operator'],
    requiresApproval: true,
    requiresBudget: true,
  },

  // Running → Paused
  {
    from: 'running',
    to: 'paused',
    event: 'pause',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Paused → Running (再開)
  {
    from: 'paused',
    to: 'running',
    event: 'resume',
    allowedRoles: ['tenant_owner', 'operator'],
    requiresApproval: true,
    requiresBudget: true,
  },

  // Running → Completed
  {
    from: 'running',
    to: 'completed',
    event: 'complete',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Paused → Completed
  {
    from: 'paused',
    to: 'completed',
    event: 'complete',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // Completed → Archived
  {
    from: 'completed',
    to: 'archived',
    event: 'archive',
    allowedRoles: ['tenant_owner', 'operator'],
  },

  // キャンセル（ドラフト/設計中から）
  {
    from: 'draft',
    to: 'archived',
    event: 'cancel',
    allowedRoles: ['tenant_owner', 'operator'],
  },
  {
    from: 'designing',
    to: 'archived',
    event: 'cancel',
    allowedRoles: ['tenant_owner', 'operator'],
  },
]

/**
 * 状態遷移エラー
 */
export class StateTransitionError extends Error {
  public readonly from: RunState
  public readonly to: RunState
  public readonly event: RunTransitionEvent
  public readonly reason: string

  constructor(from: RunState, event: RunTransitionEvent, reason: string, to?: RunState) {
    super(`Cannot transition from '${from}' via '${event}': ${reason}`)
    this.name = 'StateTransitionError'
    this.from = from
    this.to = to || from
    this.event = event
    this.reason = reason
  }
}

/**
 * 指定されたイベントで状態遷移可能かチェック
 */
export function canTransition(
  currentState: RunState,
  event: RunTransitionEvent,
  role: RoleName
): StateTransition | null {
  const transition = STATE_TRANSITIONS.find(
    (t) => t.from === currentState && t.event === event
  )

  if (!transition) {
    return null
  }

  if (!transition.allowedRoles.includes(role) && role !== 'tenant_owner') {
    return null
  }

  return transition
}

/**
 * 状態遷移を実行
 */
export function executeTransition(
  currentState: RunState,
  event: RunTransitionEvent,
  role: RoleName,
  options?: {
    isApproved?: boolean
    hasBudget?: boolean
  }
): RunState {
  const transition = canTransition(currentState, event, role)

  if (!transition) {
    // 遷移が見つからない場合
    const possibleTransitions = STATE_TRANSITIONS.filter((t) => t.from === currentState)

    if (possibleTransitions.length === 0) {
      throw new StateTransitionError(
        currentState,
        event,
        `No transitions available from '${currentState}' state`
      )
    }

    const possibleEvents = possibleTransitions.map((t) => t.event).join(', ')
    throw new StateTransitionError(
      currentState,
      event,
      `Invalid event '${event}'. Possible events: ${possibleEvents}`
    )
  }

  // 承認チェック
  if (transition.requiresApproval && !options?.isApproved) {
    throw new StateTransitionError(
      currentState,
      event,
      'Run must be approved before this transition',
      transition.to
    )
  }

  // 予算チェック
  if (transition.requiresBudget && !options?.hasBudget) {
    throw new StateTransitionError(
      currentState,
      event,
      'Budget must be set before this transition',
      transition.to
    )
  }

  return transition.to
}

/**
 * 現在の状態から可能な遷移を取得
 */
export function getAvailableTransitions(
  currentState: RunState,
  role: RoleName
): StateTransition[] {
  return STATE_TRANSITIONS.filter(
    (t) => t.from === currentState && (t.allowedRoles.includes(role) || role === 'tenant_owner')
  )
}

/**
 * 状態のラベルを取得
 */
export function getStateLabel(state: RunState): string {
  const labels: Record<RunState, string> = {
    draft: '下書き',
    designing: '設計中',
    generating: '生成中',
    ready_for_review: 'レビュー待ち',
    approved: '承認済み',
    publishing: '公開中',
    live: '公開完了',
    running: '配信中',
    paused: '一時停止',
    completed: '完了',
    archived: 'アーカイブ',
  }
  return labels[state]
}

/**
 * 状態が編集可能かどうか
 */
export function isEditable(state: RunState): boolean {
  return ['draft', 'designing'].includes(state)
}

/**
 * 状態が配信可能かどうか
 */
export function isDeliverable(state: RunState): boolean {
  return state === 'live' || state === 'running' || state === 'paused'
}

/**
 * 状態が終了状態かどうか
 */
export function isTerminal(state: RunState): boolean {
  return state === 'completed' || state === 'archived'
}
