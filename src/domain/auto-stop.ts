/**
 * Auto-Stop (Guardrails) System
 * 予算超過や異常検知時の自動停止ロジック
 */

// 停止理由
export type StopReason =
  | 'budget_total'      // 総額上限到達
  | 'budget_daily'      // 日額上限到達
  | 'cpa_limit'         // CPA上限超過
  | 'cv_zero'           // CVゼロ継続
  | 'error_consecutive' // エラー連続
  | 'manual'            // 手動停止

// 停止条件設定
export interface StopConditions {
  // 総額上限
  budgetTotalEnabled: boolean
  budgetTotal?: number

  // 日額上限
  budgetDailyEnabled: boolean
  budgetDaily?: number

  // CPA上限
  cpaLimitEnabled: boolean
  cpaLimit?: number
  cpaMinSample?: number // 最低サンプル数

  // CVゼロ継続
  cvZeroHoursEnabled: boolean
  cvZeroHours?: number // 時間

  // エラー連続
  errorConsecutiveEnabled: boolean
  errorConsecutiveCount?: number
}

// メトリクスデータ
export interface MetricsData {
  totalSpend: number           // 累計支出
  dailySpend: number           // 本日支出
  conversions: number          // CV数
  cpa: number | null           // CPA（CV数>0の場合のみ）
  lastConversionAt: string | null  // 最後のCV時刻
  consecutiveErrors: number    // 連続エラー数
}

// 停止判定結果
export interface StopEvaluation {
  shouldStop: boolean
  reason: StopReason | null
  details: StopEvaluationDetails | null
}

export interface StopEvaluationDetails {
  condition: string
  currentValue: number | string
  threshold: number | string
  message: string
}

// 停止イベント
export interface StopEvent {
  runId: string
  tenantId: string
  reason: StopReason
  details: StopEvaluationDetails
  targetType?: 'run' | 'adset' | 'ad'
  targetId?: string
  triggeredAt: string
}

/**
 * 停止条件を検証
 */
export function validateStopConditions(conditions: StopConditions): string[] {
  const errors: string[] = []

  if (conditions.budgetTotalEnabled && (conditions.budgetTotal == null || conditions.budgetTotal <= 0)) {
    errors.push('総額上限が有効な場合は正の値を設定してください')
  }

  if (conditions.budgetDailyEnabled && (conditions.budgetDaily == null || conditions.budgetDaily <= 0)) {
    errors.push('日額上限が有効な場合は正の値を設定してください')
  }

  if (conditions.cpaLimitEnabled) {
    if (conditions.cpaLimit == null || conditions.cpaLimit <= 0) {
      errors.push('CPA上限が有効な場合は正の値を設定してください')
    }
    if (conditions.cpaMinSample == null || conditions.cpaMinSample <= 0) {
      errors.push('CPA上限の最低サンプル数を設定してください')
    }
  }

  if (conditions.cvZeroHoursEnabled && (conditions.cvZeroHours == null || conditions.cvZeroHours <= 0)) {
    errors.push('CVゼロ継続時間が有効な場合は正の値を設定してください')
  }

  if (conditions.errorConsecutiveEnabled && (conditions.errorConsecutiveCount == null || conditions.errorConsecutiveCount <= 0)) {
    errors.push('連続エラー回数が有効な場合は正の値を設定してください')
  }

  return errors
}

/**
 * 総額上限チェック
 */
export function checkBudgetTotal(
  conditions: StopConditions,
  metrics: MetricsData
): StopEvaluation {
  if (!conditions.budgetTotalEnabled || conditions.budgetTotal == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  if (metrics.totalSpend >= conditions.budgetTotal) {
    return {
      shouldStop: true,
      reason: 'budget_total',
      details: {
        condition: '総額上限',
        currentValue: metrics.totalSpend,
        threshold: conditions.budgetTotal,
        message: `総支出 ${metrics.totalSpend}円 が上限 ${conditions.budgetTotal}円 に到達しました`,
      },
    }
  }

  return { shouldStop: false, reason: null, details: null }
}

/**
 * 日額上限チェック
 */
export function checkBudgetDaily(
  conditions: StopConditions,
  metrics: MetricsData
): StopEvaluation {
  if (!conditions.budgetDailyEnabled || conditions.budgetDaily == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  if (metrics.dailySpend >= conditions.budgetDaily) {
    return {
      shouldStop: true,
      reason: 'budget_daily',
      details: {
        condition: '日額上限',
        currentValue: metrics.dailySpend,
        threshold: conditions.budgetDaily,
        message: `本日の支出 ${metrics.dailySpend}円 が上限 ${conditions.budgetDaily}円 に到達しました`,
      },
    }
  }

  return { shouldStop: false, reason: null, details: null }
}

/**
 * CPA上限チェック
 */
export function checkCpaLimit(
  conditions: StopConditions,
  metrics: MetricsData
): StopEvaluation {
  if (!conditions.cpaLimitEnabled || conditions.cpaLimit == null || conditions.cpaMinSample == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  // 最低サンプル数未達の場合はスキップ
  if (metrics.conversions < conditions.cpaMinSample) {
    return { shouldStop: false, reason: null, details: null }
  }

  // CPAが計算できない場合（CV=0）はスキップ
  if (metrics.cpa == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  if (metrics.cpa > conditions.cpaLimit) {
    return {
      shouldStop: true,
      reason: 'cpa_limit',
      details: {
        condition: 'CPA上限',
        currentValue: metrics.cpa,
        threshold: conditions.cpaLimit,
        message: `CPA ${metrics.cpa}円 が上限 ${conditions.cpaLimit}円 を超過しました（サンプル数: ${metrics.conversions}）`,
      },
    }
  }

  return { shouldStop: false, reason: null, details: null }
}

/**
 * CVゼロ継続チェック
 */
export function checkCvZero(
  conditions: StopConditions,
  metrics: MetricsData,
  currentTime: Date = new Date()
): StopEvaluation {
  if (!conditions.cvZeroHoursEnabled || conditions.cvZeroHours == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  // CV=0の場合のみチェック
  if (metrics.conversions > 0 || metrics.lastConversionAt != null) {
    // 最後のCVからの経過時間をチェック
    if (metrics.lastConversionAt) {
      const lastCvTime = new Date(metrics.lastConversionAt)
      const hoursSinceLastCv = (currentTime.getTime() - lastCvTime.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastCv >= conditions.cvZeroHours) {
        return {
          shouldStop: true,
          reason: 'cv_zero',
          details: {
            condition: 'CVゼロ継続',
            currentValue: `${Math.floor(hoursSinceLastCv)}時間`,
            threshold: `${conditions.cvZeroHours}時間`,
            message: `最後のCVから ${Math.floor(hoursSinceLastCv)}時間 経過しました（上限: ${conditions.cvZeroHours}時間）`,
          },
        }
      }
    }

    return { shouldStop: false, reason: null, details: null }
  }

  // CVが一度もない場合は、配信開始からの時間でチェック（別途実装が必要）
  return { shouldStop: false, reason: null, details: null }
}

/**
 * エラー連続チェック
 */
export function checkErrorConsecutive(
  conditions: StopConditions,
  metrics: MetricsData
): StopEvaluation {
  if (!conditions.errorConsecutiveEnabled || conditions.errorConsecutiveCount == null) {
    return { shouldStop: false, reason: null, details: null }
  }

  if (metrics.consecutiveErrors >= conditions.errorConsecutiveCount) {
    return {
      shouldStop: true,
      reason: 'error_consecutive',
      details: {
        condition: '連続エラー',
        currentValue: metrics.consecutiveErrors,
        threshold: conditions.errorConsecutiveCount,
        message: `連続エラー ${metrics.consecutiveErrors}回 が上限 ${conditions.errorConsecutiveCount}回 に到達しました`,
      },
    }
  }

  return { shouldStop: false, reason: null, details: null }
}

/**
 * 全停止条件を評価
 * 安全側に倒す: 一つでも停止条件に該当すれば停止
 */
export function evaluateStopConditions(
  conditions: StopConditions,
  metrics: MetricsData,
  currentTime: Date = new Date()
): StopEvaluation {
  // 優先順位順にチェック（最も重要な条件から）

  // 1. 総額上限（最優先）
  const budgetTotalResult = checkBudgetTotal(conditions, metrics)
  if (budgetTotalResult.shouldStop) {
    return budgetTotalResult
  }

  // 2. 日額上限
  const budgetDailyResult = checkBudgetDaily(conditions, metrics)
  if (budgetDailyResult.shouldStop) {
    return budgetDailyResult
  }

  // 3. エラー連続（システム異常を早期検知）
  const errorResult = checkErrorConsecutive(conditions, metrics)
  if (errorResult.shouldStop) {
    return errorResult
  }

  // 4. CPA上限
  const cpaResult = checkCpaLimit(conditions, metrics)
  if (cpaResult.shouldStop) {
    return cpaResult
  }

  // 5. CVゼロ継続
  const cvZeroResult = checkCvZero(conditions, metrics, currentTime)
  if (cvZeroResult.shouldStop) {
    return cvZeroResult
  }

  return { shouldStop: false, reason: null, details: null }
}

/**
 * 停止イベントを作成
 */
export function createStopEvent(
  runId: string,
  tenantId: string,
  evaluation: StopEvaluation,
  targetType?: 'run' | 'adset' | 'ad',
  targetId?: string
): StopEvent | null {
  if (!evaluation.shouldStop || evaluation.reason == null || evaluation.details == null) {
    return null
  }

  return {
    runId,
    tenantId,
    reason: evaluation.reason,
    details: evaluation.details,
    targetType,
    targetId,
    triggeredAt: new Date().toISOString(),
  }
}

/**
 * 停止理由のラベルを取得
 */
export function getStopReasonLabel(reason: StopReason): string {
  const labels: Record<StopReason, string> = {
    budget_total: '総額上限到達',
    budget_daily: '日額上限到達',
    cpa_limit: 'CPA上限超過',
    cv_zero: 'CVゼロ継続',
    error_consecutive: '連続エラー',
    manual: '手動停止',
  }
  return labels[reason]
}

/**
 * デフォルトの停止条件を作成
 */
export function createDefaultStopConditions(): StopConditions {
  return {
    budgetTotalEnabled: true,
    budgetTotal: undefined,
    budgetDailyEnabled: true,
    budgetDaily: undefined,
    cpaLimitEnabled: false,
    cpaLimit: undefined,
    cpaMinSample: 50,
    cvZeroHoursEnabled: true,
    cvZeroHours: 24,
    errorConsecutiveEnabled: true,
    errorConsecutiveCount: 3,
  }
}
