/**
 * Winner Determination & Learning System
 * 勝ち判定・学習・次Run生成
 */

// テスト結果
export interface TestResult {
  id: string
  runId: string
  testType: TestType
  startDate: string
  endDate: string
  primaryMetric: MetricType
  variants: VariantResult[]
  winner: WinnerDecision
  confidence: number
  sampleSize: number
  learnings: Learning[]
  createdAt: string
}

// テストタイプ
export type TestType = 'ab_test' | 'multivariate' | 'bandit'

// メトリクスタイプ
export type MetricType = 'cvr' | 'ctr' | 'cpa' | 'roas' | 'revenue' | 'cpc'

// バリアント結果
export interface VariantResult {
  variantId: string
  variantName: string
  isControl: boolean
  sampleSize: number
  conversions: number
  clicks: number
  impressions: number
  spend: number
  revenue: number
  metrics: VariantMetrics
}

// バリアントメトリクス
export interface VariantMetrics {
  cvr: number
  ctr: number
  cpa: number
  roas: number
  cpc: number
  cpm: number
}

// 勝者判定
export interface WinnerDecision {
  status: 'winner' | 'loser' | 'tie' | 'insufficient_data'
  winnerVariantId?: string
  improvement?: number
  confidence: number
  reason: string
}

// 学習
export interface Learning {
  id: string
  type: LearningType
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  suggestedAction?: string
  metadata: Record<string, unknown>
}

// 学習タイプ
export type LearningType =
  | 'headline_performance'
  | 'cta_performance'
  | 'image_performance'
  | 'color_performance'
  | 'audience_insight'
  | 'timing_insight'
  | 'placement_insight'
  | 'general'

// 統計的有意性の結果
export interface SignificanceResult {
  isSignificant: boolean
  pValue: number
  confidenceLevel: number
  standardError: number
  zScore: number
  minimumDetectableEffect: number
}

// 次のRun提案
export interface NextRunSuggestion {
  id: string
  sourceRunId: string
  type: 'iterate' | 'expand' | 'pivot'
  title: string
  description: string
  suggestedChanges: SuggestedChange[]
  expectedImprovement: number
  confidence: number
  priority: 'high' | 'medium' | 'low'
}

// 提案される変更
export interface SuggestedChange {
  target: 'headline' | 'cta' | 'image' | 'targeting' | 'budget' | 'schedule'
  currentValue: string
  suggestedValue: string
  rationale: string
}

/**
 * テスト結果IDを生成
 */
export function generateTestResultId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `test_${timestamp}_${random}`
}

/**
 * 学習IDを生成
 */
export function generateLearningId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `learn_${timestamp}_${random}`
}

/**
 * 提案IDを生成
 */
export function generateSuggestionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `suggest_${timestamp}_${random}`
}

/**
 * コンバージョン率を計算
 */
export function calculateCVR(conversions: number, clicks: number): number {
  if (clicks === 0) return 0
  return (conversions / clicks) * 100
}

/**
 * CTRを計算
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0
  return (clicks / impressions) * 100
}

/**
 * CPAを計算
 */
export function calculateCPA(spend: number, conversions: number): number {
  if (conversions === 0) return Infinity
  return spend / conversions
}

/**
 * ROASを計算
 */
export function calculateROAS(revenue: number, spend: number): number {
  if (spend === 0) return 0
  return revenue / spend
}

/**
 * CPCを計算
 */
export function calculateCPC(spend: number, clicks: number): number {
  if (clicks === 0) return 0
  return spend / clicks
}

/**
 * CPMを計算
 */
export function calculateCPM(spend: number, impressions: number): number {
  if (impressions === 0) return 0
  return (spend / impressions) * 1000
}

/**
 * バリアントメトリクスを計算
 */
export function calculateVariantMetrics(result: VariantResult): VariantMetrics {
  return {
    cvr: calculateCVR(result.conversions, result.clicks),
    ctr: calculateCTR(result.clicks, result.impressions),
    cpa: calculateCPA(result.spend, result.conversions),
    roas: calculateROAS(result.revenue, result.spend),
    cpc: calculateCPC(result.spend, result.clicks),
    cpm: calculateCPM(result.spend, result.impressions),
  }
}

/**
 * 標準誤差を計算
 */
export function calculateStandardError(rate: number, sampleSize: number): number {
  if (sampleSize === 0) return 0
  const p = rate / 100 // Convert percentage to proportion
  return Math.sqrt((p * (1 - p)) / sampleSize)
}

/**
 * Z-scoreを計算
 */
export function calculateZScore(
  rateA: number,
  rateB: number,
  seA: number,
  seB: number
): number {
  const seDiff = Math.sqrt(seA * seA + seB * seB)
  if (seDiff === 0) return 0
  return (rateA - rateB) / 100 / seDiff
}

/**
 * P値を計算（正規分布の両側検定）
 */
export function calculatePValue(zScore: number): number {
  // Standard normal distribution CDF approximation
  const absZ = Math.abs(zScore)
  const t = 1 / (1 + 0.2316419 * absZ)
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return 2 * p // Two-tailed test
}

/**
 * 統計的有意性をテスト
 */
export function testSignificance(
  controlResult: VariantResult,
  treatmentResult: VariantResult,
  metric: MetricType = 'cvr',
  confidenceLevel = 0.95
): SignificanceResult {
  const controlMetrics = calculateVariantMetrics(controlResult)
  const treatmentMetrics = calculateVariantMetrics(treatmentResult)

  let controlRate: number
  let treatmentRate: number
  let controlN: number
  let treatmentN: number

  switch (metric) {
    case 'cvr':
      controlRate = controlMetrics.cvr
      treatmentRate = treatmentMetrics.cvr
      controlN = controlResult.clicks
      treatmentN = treatmentResult.clicks
      break
    case 'ctr':
      controlRate = controlMetrics.ctr
      treatmentRate = treatmentMetrics.ctr
      controlN = controlResult.impressions
      treatmentN = treatmentResult.impressions
      break
    default:
      controlRate = controlMetrics.cvr
      treatmentRate = treatmentMetrics.cvr
      controlN = controlResult.clicks
      treatmentN = treatmentResult.clicks
  }

  const seControl = calculateStandardError(controlRate, controlN)
  const seTreatment = calculateStandardError(treatmentRate, treatmentN)
  const zScore = calculateZScore(treatmentRate, controlRate, seTreatment, seControl)
  const pValue = calculatePValue(zScore)

  const criticalZ = 1.96 // For 95% confidence
  const isSignificant = pValue < (1 - confidenceLevel)

  // Minimum detectable effect at current sample size
  const pooledSE = Math.sqrt(seControl * seControl + seTreatment * seTreatment)
  const mde = criticalZ * pooledSE * 100

  return {
    isSignificant,
    pValue,
    confidenceLevel,
    standardError: pooledSE,
    zScore,
    minimumDetectableEffect: mde,
  }
}

/**
 * 必要なサンプルサイズを計算
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  power = 0.8,
  confidenceLevel = 0.95
): number {
  // Z values for common confidence levels and power
  const zAlpha = confidenceLevel === 0.95 ? 1.96 : 2.576 // 95% or 99%
  const zBeta = power === 0.8 ? 0.84 : 1.28 // 80% or 90%

  const p1 = baselineRate / 100
  const p2 = (baselineRate + minimumDetectableEffect) / 100
  const pooledP = (p1 + p2) / 2

  const numerator = 2 * Math.pow(zAlpha + zBeta, 2) * pooledP * (1 - pooledP)
  const denominator = Math.pow(p2 - p1, 2)

  if (denominator === 0) return Infinity

  return Math.ceil(numerator / denominator)
}

/**
 * 勝者を判定
 */
export function determineWinner(
  variants: VariantResult[],
  primaryMetric: MetricType = 'cvr',
  confidenceLevel = 0.95,
  minSampleSize = 100
): WinnerDecision {
  if (variants.length < 2) {
    return {
      status: 'insufficient_data',
      confidence: 0,
      reason: 'At least 2 variants required for comparison',
    }
  }

  // Find control variant
  const control = variants.find((v) => v.isControl)
  if (!control) {
    return {
      status: 'insufficient_data',
      confidence: 0,
      reason: 'No control variant specified',
    }
  }

  // Check minimum sample size
  const totalSampleSize = variants.reduce((sum, v) => sum + v.sampleSize, 0)
  if (totalSampleSize < minSampleSize) {
    return {
      status: 'insufficient_data',
      confidence: 0,
      reason: `Insufficient sample size: ${totalSampleSize}/${minSampleSize}`,
    }
  }

  // Compare each treatment against control
  const treatments = variants.filter((v) => !v.isControl)
  let bestTreatment: VariantResult | null = null
  let bestImprovement = 0
  let bestConfidence = 0
  let significantWinner = false

  for (const treatment of treatments) {
    const significance = testSignificance(control, treatment, primaryMetric, confidenceLevel)

    const controlMetric = getMetricValue(control, primaryMetric)
    const treatmentMetric = getMetricValue(treatment, primaryMetric)

    // For CPA, lower is better
    const isLowerBetter = primaryMetric === 'cpa' || primaryMetric === 'cpc'
    const improvement = isLowerBetter
      ? ((controlMetric - treatmentMetric) / controlMetric) * 100
      : ((treatmentMetric - controlMetric) / controlMetric) * 100

    if (significance.isSignificant && improvement > 0) {
      if (improvement > bestImprovement) {
        bestTreatment = treatment
        bestImprovement = improvement
        bestConfidence = 1 - significance.pValue
        significantWinner = true
      }
    }
  }

  if (significantWinner && bestTreatment) {
    return {
      status: 'winner',
      winnerVariantId: bestTreatment.variantId,
      improvement: bestImprovement,
      confidence: bestConfidence,
      reason: `${bestTreatment.variantName} outperformed control by ${bestImprovement.toFixed(1)}%`,
    }
  }

  // Check if control is significantly better
  for (const treatment of treatments) {
    const significance = testSignificance(control, treatment, primaryMetric, confidenceLevel)
    const controlMetric = getMetricValue(control, primaryMetric)
    const treatmentMetric = getMetricValue(treatment, primaryMetric)

    const isLowerBetter = primaryMetric === 'cpa' || primaryMetric === 'cpc'
    const controlBetter = isLowerBetter
      ? controlMetric < treatmentMetric
      : controlMetric > treatmentMetric

    if (significance.isSignificant && controlBetter) {
      return {
        status: 'loser',
        winnerVariantId: control.variantId,
        confidence: 1 - significance.pValue,
        reason: 'Control outperformed all treatments',
      }
    }
  }

  return {
    status: 'tie',
    confidence: 0.5,
    reason: 'No statistically significant difference found',
  }
}

/**
 * メトリクス値を取得
 */
export function getMetricValue(result: VariantResult, metric: MetricType): number {
  const metrics = calculateVariantMetrics(result)

  switch (metric) {
    case 'cvr':
      return metrics.cvr
    case 'ctr':
      return metrics.ctr
    case 'cpa':
      return metrics.cpa
    case 'roas':
      return metrics.roas
    case 'cpc':
      return metrics.cpc
    case 'revenue':
      return result.revenue
    default:
      return metrics.cvr
  }
}

/**
 * 学習を生成
 */
export function generateLearnings(
  variants: VariantResult[],
  winner: WinnerDecision
): Learning[] {
  const learnings: Learning[] = []

  if (winner.status === 'winner' && winner.winnerVariantId) {
    const winningVariant = variants.find((v) => v.variantId === winner.winnerVariantId)
    if (winningVariant) {
      learnings.push({
        id: generateLearningId(),
        type: 'general',
        title: `${winningVariant.variantName}が勝者`,
        description: `${winningVariant.variantName}が${winner.improvement?.toFixed(1)}%の改善を達成しました`,
        impact: winner.improvement && winner.improvement > 20 ? 'high' : 'medium',
        actionable: true,
        suggestedAction: 'この勝者バリアントを本番で採用し、さらなる改善のためのテストを計画してください',
        metadata: {
          improvementPercent: winner.improvement,
          confidence: winner.confidence,
        },
      })
    }
  }

  // Analyze CTR differences
  const sortedByCTR = [...variants].sort(
    (a, b) => calculateVariantMetrics(b).ctr - calculateVariantMetrics(a).ctr
  )
  const bestCTR = sortedByCTR[0]
  const worstCTR = sortedByCTR[sortedByCTR.length - 1]

  const ctrDiff = calculateVariantMetrics(bestCTR).ctr - calculateVariantMetrics(worstCTR).ctr
  if (ctrDiff > 0.5) {
    learnings.push({
      id: generateLearningId(),
      type: 'general',
      title: 'CTRに大きな差異',
      description: `最高CTR（${bestCTR.variantName}）と最低CTR（${worstCTR.variantName}）の間に${ctrDiff.toFixed(2)}%の差があります`,
      impact: ctrDiff > 1 ? 'high' : 'medium',
      actionable: true,
      suggestedAction: '高CTRバリアントのクリエイティブ要素を分析し、次のテストに活かしてください',
      metadata: {
        bestVariant: bestCTR.variantName,
        worstVariant: worstCTR.variantName,
        ctrDifference: ctrDiff,
      },
    })
  }

  // Analyze conversion efficiency
  const sortedByCPA = [...variants].sort(
    (a, b) => calculateVariantMetrics(a).cpa - calculateVariantMetrics(b).cpa
  )
  const bestCPA = sortedByCPA[0]
  const worstCPA = sortedByCPA.filter((v) => calculateVariantMetrics(v).cpa < Infinity).pop()

  if (worstCPA) {
    const cpaDiff =
      ((calculateVariantMetrics(worstCPA).cpa - calculateVariantMetrics(bestCPA).cpa) /
        calculateVariantMetrics(bestCPA).cpa) *
      100
    if (cpaDiff > 30) {
      learnings.push({
        id: generateLearningId(),
        type: 'general',
        title: 'CPA効率に大きな差異',
        description: `${bestCPA.variantName}は${worstCPA.variantName}より${cpaDiff.toFixed(0)}%効率的にコンバージョンを獲得しています`,
        impact: 'high',
        actionable: true,
        suggestedAction: '効率の良いバリアントの特徴を分析し、予算配分を最適化してください',
        metadata: {
          bestVariant: bestCPA.variantName,
          worstVariant: worstCPA.variantName,
          cpaDifferencePercent: cpaDiff,
        },
      })
    }
  }

  return learnings
}

/**
 * 次のRun提案を生成
 */
export function generateNextRunSuggestion(
  sourceRunId: string,
  winner: WinnerDecision,
  learnings: Learning[],
  variants: VariantResult[]
): NextRunSuggestion | null {
  if (winner.status === 'insufficient_data') {
    return {
      id: generateSuggestionId(),
      sourceRunId,
      type: 'iterate',
      title: 'サンプルサイズ拡大',
      description: 'より多くのサンプルを収集して、統計的に有意な結果を得てください',
      suggestedChanges: [
        {
          target: 'budget',
          currentValue: '現在の予算',
          suggestedValue: '予算を2倍に増加',
          rationale: '十分なサンプルサイズを確保するため',
        },
        {
          target: 'schedule',
          currentValue: '現在の期間',
          suggestedValue: 'テスト期間を延長',
          rationale: 'より多くのデータを収集するため',
        },
      ],
      expectedImprovement: 0,
      confidence: 0.5,
      priority: 'high',
    }
  }

  if (winner.status === 'winner' && winner.winnerVariantId) {
    const winningVariant = variants.find((v) => v.variantId === winner.winnerVariantId)
    if (!winningVariant) return null

    return {
      id: generateSuggestionId(),
      sourceRunId,
      type: 'iterate',
      title: '勝者バリアントの最適化',
      description: `${winningVariant.variantName}をベースに、さらなる改善を目指すA/Bテスト`,
      suggestedChanges: [
        {
          target: 'headline',
          currentValue: '勝者のヘッドライン',
          suggestedValue: 'ヘッドラインのバリエーションをテスト',
          rationale: '勝者をベースにさらなる最適化',
        },
        {
          target: 'cta',
          currentValue: '勝者のCTA',
          suggestedValue: 'CTAの文言・色をテスト',
          rationale: 'コンバージョン率のさらなる改善',
        },
      ],
      expectedImprovement: winner.improvement ? winner.improvement * 0.5 : 10,
      confidence: winner.confidence * 0.8,
      priority: 'high',
    }
  }

  if (winner.status === 'tie') {
    return {
      id: generateSuggestionId(),
      sourceRunId,
      type: 'pivot',
      title: '新しいアプローチのテスト',
      description: '現在のバリアントに有意な差がないため、より大胆な変更をテスト',
      suggestedChanges: [
        {
          target: 'headline',
          currentValue: '既存のヘッドライン群',
          suggestedValue: '全く異なるメッセージングをテスト',
          rationale: '現在のアプローチでは差が出なかった',
        },
        {
          target: 'image',
          currentValue: '既存のビジュアル',
          suggestedValue: '異なるビジュアルスタイルをテスト',
          rationale: 'より大きなインパクトを狙う',
        },
      ],
      expectedImprovement: 15,
      confidence: 0.5,
      priority: 'medium',
    }
  }

  return null
}

/**
 * テスト結果を作成
 */
export function createTestResult(
  runId: string,
  testType: TestType,
  startDate: string,
  endDate: string,
  primaryMetric: MetricType,
  variants: VariantResult[]
): TestResult {
  const enrichedVariants = variants.map((v) => ({
    ...v,
    metrics: calculateVariantMetrics(v),
  }))

  const winner = determineWinner(enrichedVariants, primaryMetric)
  const learnings = generateLearnings(enrichedVariants, winner)
  const totalSampleSize = variants.reduce((sum, v) => sum + v.sampleSize, 0)

  return {
    id: generateTestResultId(),
    runId,
    testType,
    startDate,
    endDate,
    primaryMetric,
    variants: enrichedVariants,
    winner,
    confidence: winner.confidence,
    sampleSize: totalSampleSize,
    learnings,
    createdAt: new Date().toISOString(),
  }
}

/**
 * メトリクスタイプのラベルを取得
 */
export function getMetricTypeLabel(metric: MetricType): string {
  const labels: Record<MetricType, string> = {
    cvr: 'コンバージョン率',
    ctr: 'クリック率',
    cpa: '顧客獲得単価',
    roas: '広告費用対効果',
    revenue: '売上',
    cpc: 'クリック単価',
  }
  return labels[metric]
}

/**
 * テストタイプのラベルを取得
 */
export function getTestTypeLabel(type: TestType): string {
  const labels: Record<TestType, string> = {
    ab_test: 'A/Bテスト',
    multivariate: '多変量テスト',
    bandit: 'バンディットテスト',
  }
  return labels[type]
}

/**
 * 勝者ステータスのラベルを取得
 */
export function getWinnerStatusLabel(status: WinnerDecision['status']): string {
  const labels: Record<WinnerDecision['status'], string> = {
    winner: '勝者あり',
    loser: 'コントロールが優位',
    tie: '引き分け',
    insufficient_data: 'データ不足',
  }
  return labels[status]
}

/**
 * インパクトレベルのラベルを取得
 */
export function getImpactLabel(impact: Learning['impact']): string {
  const labels: Record<Learning['impact'], string> = {
    high: '高',
    medium: '中',
    low: '低',
  }
  return labels[impact]
}
