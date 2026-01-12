import { describe, it, expect } from 'vitest'
import {
  generateTestResultId,
  generateLearningId,
  generateSuggestionId,
  calculateCVR,
  calculateCTR,
  calculateCPA,
  calculateROAS,
  calculateCPC,
  calculateCPM,
  calculateVariantMetrics,
  calculateStandardError,
  calculateZScore,
  calculatePValue,
  testSignificance,
  calculateRequiredSampleSize,
  determineWinner,
  getMetricValue,
  generateLearnings,
  generateNextRunSuggestion,
  createTestResult,
  getMetricTypeLabel,
  getTestTypeLabel,
  getWinnerStatusLabel,
  getImpactLabel,
  type VariantResult,
  type WinnerDecision,
} from '../../src/domain/winner-learning'

describe('Winner Determination & Learning System', () => {
  describe('ID Generation', () => {
    describe('generateTestResultId', () => {
      it('should generate unique test result IDs', () => {
        const id1 = generateTestResultId()
        const id2 = generateTestResultId()

        expect(id1).toMatch(/^test_/)
        expect(id2).toMatch(/^test_/)
        expect(id1).not.toBe(id2)
      })
    })

    describe('generateLearningId', () => {
      it('should generate unique learning IDs', () => {
        const id1 = generateLearningId()
        const id2 = generateLearningId()

        expect(id1).toMatch(/^learn_/)
        expect(id2).toMatch(/^learn_/)
        expect(id1).not.toBe(id2)
      })
    })

    describe('generateSuggestionId', () => {
      it('should generate unique suggestion IDs', () => {
        const id1 = generateSuggestionId()
        const id2 = generateSuggestionId()

        expect(id1).toMatch(/^suggest_/)
        expect(id2).toMatch(/^suggest_/)
        expect(id1).not.toBe(id2)
      })
    })
  })

  describe('Metrics Calculation', () => {
    describe('calculateCVR', () => {
      it('should calculate conversion rate', () => {
        expect(calculateCVR(10, 100)).toBe(10)
        expect(calculateCVR(25, 500)).toBe(5)
      })

      it('should return 0 for zero clicks', () => {
        expect(calculateCVR(0, 0)).toBe(0)
      })
    })

    describe('calculateCTR', () => {
      it('should calculate click through rate', () => {
        expect(calculateCTR(100, 10000)).toBe(1)
        expect(calculateCTR(50, 2500)).toBe(2)
      })

      it('should return 0 for zero impressions', () => {
        expect(calculateCTR(0, 0)).toBe(0)
      })
    })

    describe('calculateCPA', () => {
      it('should calculate cost per acquisition', () => {
        expect(calculateCPA(1000, 10)).toBe(100)
        expect(calculateCPA(5000, 25)).toBe(200)
      })

      it('should return Infinity for zero conversions', () => {
        expect(calculateCPA(1000, 0)).toBe(Infinity)
      })
    })

    describe('calculateROAS', () => {
      it('should calculate return on ad spend', () => {
        expect(calculateROAS(10000, 1000)).toBe(10)
        expect(calculateROAS(5000, 2500)).toBe(2)
      })

      it('should return 0 for zero spend', () => {
        expect(calculateROAS(1000, 0)).toBe(0)
      })
    })

    describe('calculateCPC', () => {
      it('should calculate cost per click', () => {
        expect(calculateCPC(500, 100)).toBe(5)
        expect(calculateCPC(1000, 200)).toBe(5)
      })

      it('should return 0 for zero clicks', () => {
        expect(calculateCPC(1000, 0)).toBe(0)
      })
    })

    describe('calculateCPM', () => {
      it('should calculate cost per mille', () => {
        expect(calculateCPM(500, 100000)).toBe(5)
        expect(calculateCPM(1000, 50000)).toBe(20)
      })

      it('should return 0 for zero impressions', () => {
        expect(calculateCPM(1000, 0)).toBe(0)
      })
    })

    describe('calculateVariantMetrics', () => {
      it('should calculate all variant metrics', () => {
        const result: VariantResult = {
          variantId: 'var_1',
          variantName: 'Variant A',
          isControl: false,
          sampleSize: 1000,
          conversions: 50,
          clicks: 500,
          impressions: 10000,
          spend: 2500,
          revenue: 25000,
          metrics: {
            cvr: 0,
            ctr: 0,
            cpa: 0,
            roas: 0,
            cpc: 0,
            cpm: 0,
          },
        }

        const metrics = calculateVariantMetrics(result)

        expect(metrics.cvr).toBe(10) // 50/500 * 100
        expect(metrics.ctr).toBe(5) // 500/10000 * 100
        expect(metrics.cpa).toBe(50) // 2500/50
        expect(metrics.roas).toBe(10) // 25000/2500
        expect(metrics.cpc).toBe(5) // 2500/500
        expect(metrics.cpm).toBe(250) // (2500/10000) * 1000
      })
    })
  })

  describe('Statistical Tests', () => {
    describe('calculateStandardError', () => {
      it('should calculate standard error', () => {
        const se = calculateStandardError(10, 1000) // 10% rate, 1000 samples
        expect(se).toBeCloseTo(0.0095, 3)
      })

      it('should return 0 for zero sample size', () => {
        expect(calculateStandardError(10, 0)).toBe(0)
      })
    })

    describe('calculateZScore', () => {
      it('should calculate Z-score for rate comparison', () => {
        const zScore = calculateZScore(12, 10, 0.01, 0.01) // 12% vs 10%
        expect(zScore).toBeGreaterThan(0)
      })
    })

    describe('calculatePValue', () => {
      it('should calculate p-value from Z-score', () => {
        const pValue = calculatePValue(1.96)
        expect(pValue).toBeCloseTo(0.05, 2)
      })

      it('should return 1 for Z-score of 0', () => {
        const pValue = calculatePValue(0)
        expect(pValue).toBeCloseTo(1, 1)
      })
    })

    describe('testSignificance', () => {
      it('should detect significant difference', () => {
        const control: VariantResult = {
          variantId: 'control',
          variantName: 'Control',
          isControl: true,
          sampleSize: 10000,
          conversions: 500,
          clicks: 5000,
          impressions: 100000,
          spend: 10000,
          revenue: 50000,
          metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
        }

        const treatment: VariantResult = {
          variantId: 'treatment',
          variantName: 'Treatment',
          isControl: false,
          sampleSize: 10000,
          conversions: 700,
          clicks: 5000,
          impressions: 100000,
          spend: 10000,
          revenue: 70000,
          metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
        }

        const result = testSignificance(control, treatment, 'cvr')

        expect(result.zScore).toBeGreaterThan(0)
        expect(result.pValue).toBeLessThan(0.05)
        expect(result.isSignificant).toBe(true)
      })

      it('should not detect significance with small samples', () => {
        const control: VariantResult = {
          variantId: 'control',
          variantName: 'Control',
          isControl: true,
          sampleSize: 100,
          conversions: 10,
          clicks: 50,
          impressions: 1000,
          spend: 1000,
          revenue: 5000,
          metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
        }

        const treatment: VariantResult = {
          variantId: 'treatment',
          variantName: 'Treatment',
          isControl: false,
          sampleSize: 100,
          conversions: 12,
          clicks: 50,
          impressions: 1000,
          spend: 1000,
          revenue: 6000,
          metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
        }

        const result = testSignificance(control, treatment, 'cvr')

        expect(result.isSignificant).toBe(false)
      })
    })

    describe('calculateRequiredSampleSize', () => {
      it('should calculate required sample size', () => {
        // Detect 2% absolute improvement from 10% baseline
        const sampleSize = calculateRequiredSampleSize(10, 2)

        expect(sampleSize).toBeGreaterThan(1000)
        expect(sampleSize).toBeLessThan(10000)
      })
    })
  })

  describe('Winner Determination', () => {
    describe('determineWinner', () => {
      const createVariant = (
        id: string,
        name: string,
        isControl: boolean,
        conversions: number,
        clicks: number
      ): VariantResult => ({
        variantId: id,
        variantName: name,
        isControl,
        sampleSize: clicks,
        conversions,
        clicks,
        impressions: clicks * 100,
        spend: clicks * 5,
        revenue: conversions * 100,
        metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
      })

      it('should determine winner with significant improvement', () => {
        const variants: VariantResult[] = [
          createVariant('control', 'Control', true, 500, 5000),
          createVariant('treatment', 'Treatment', false, 700, 5000),
        ]

        const result = determineWinner(variants, 'cvr')

        expect(result.status).toBe('winner')
        expect(result.winnerVariantId).toBe('treatment')
        expect(result.improvement).toBeGreaterThan(0)
      })

      it('should return tie for similar performance', () => {
        const variants: VariantResult[] = [
          createVariant('control', 'Control', true, 500, 5000),
          createVariant('treatment', 'Treatment', false, 510, 5000),
        ]

        const result = determineWinner(variants, 'cvr')

        expect(result.status).toBe('tie')
      })

      it('should return insufficient_data for small samples', () => {
        const variants: VariantResult[] = [
          createVariant('control', 'Control', true, 5, 50),
          createVariant('treatment', 'Treatment', false, 7, 50),
        ]

        const result = determineWinner(variants, 'cvr', 0.95, 200)

        expect(result.status).toBe('insufficient_data')
      })

      it('should require control variant', () => {
        const variants: VariantResult[] = [
          createVariant('var1', 'Variant 1', false, 500, 5000),
          createVariant('var2', 'Variant 2', false, 700, 5000),
        ]

        const result = determineWinner(variants, 'cvr')

        expect(result.status).toBe('insufficient_data')
        expect(result.reason).toContain('control')
      })

      it('should require at least 2 variants', () => {
        const variants: VariantResult[] = [
          createVariant('control', 'Control', true, 500, 5000),
        ]

        const result = determineWinner(variants, 'cvr')

        expect(result.status).toBe('insufficient_data')
      })
    })

    describe('getMetricValue', () => {
      const result: VariantResult = {
        variantId: 'var_1',
        variantName: 'Variant A',
        isControl: false,
        sampleSize: 1000,
        conversions: 100,
        clicks: 500,
        impressions: 10000,
        spend: 2500,
        revenue: 10000,
        metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
      }

      it('should return CVR', () => {
        expect(getMetricValue(result, 'cvr')).toBe(20) // 100/500 * 100
      })

      it('should return CTR', () => {
        expect(getMetricValue(result, 'ctr')).toBe(5) // 500/10000 * 100
      })

      it('should return CPA', () => {
        expect(getMetricValue(result, 'cpa')).toBe(25) // 2500/100
      })

      it('should return ROAS', () => {
        expect(getMetricValue(result, 'roas')).toBe(4) // 10000/2500
      })

      it('should return revenue', () => {
        expect(getMetricValue(result, 'revenue')).toBe(10000)
      })
    })
  })

  describe('Learning Generation', () => {
    describe('generateLearnings', () => {
      it('should generate learnings for winner', () => {
        const variants: VariantResult[] = [
          {
            variantId: 'control',
            variantName: 'Control',
            isControl: true,
            sampleSize: 5000,
            conversions: 500,
            clicks: 5000,
            impressions: 100000,
            spend: 10000,
            revenue: 50000,
            metrics: { cvr: 10, ctr: 5, cpa: 20, roas: 5, cpc: 2, cpm: 100 },
          },
          {
            variantId: 'treatment',
            variantName: 'Treatment',
            isControl: false,
            sampleSize: 5000,
            conversions: 700,
            clicks: 5000,
            impressions: 100000,
            spend: 10000,
            revenue: 70000,
            metrics: { cvr: 14, ctr: 5, cpa: 14.29, roas: 7, cpc: 2, cpm: 100 },
          },
        ]

        const winner: WinnerDecision = {
          status: 'winner',
          winnerVariantId: 'treatment',
          improvement: 40,
          confidence: 0.95,
          reason: 'Treatment outperformed control by 40%',
        }

        const learnings = generateLearnings(variants, winner)

        expect(learnings.length).toBeGreaterThan(0)
        expect(learnings.some((l) => l.title.includes('勝者'))).toBe(true)
      })

      it('should identify CTR differences', () => {
        const variants: VariantResult[] = [
          {
            variantId: 'control',
            variantName: 'Control',
            isControl: true,
            sampleSize: 5000,
            conversions: 500,
            clicks: 500,
            impressions: 100000,
            spend: 10000,
            revenue: 50000,
            metrics: { cvr: 100, ctr: 0.5, cpa: 20, roas: 5, cpc: 20, cpm: 100 },
          },
          {
            variantId: 'treatment',
            variantName: 'Treatment',
            isControl: false,
            sampleSize: 5000,
            conversions: 500,
            clicks: 2000,
            impressions: 100000,
            spend: 10000,
            revenue: 50000,
            metrics: { cvr: 25, ctr: 2, cpa: 20, roas: 5, cpc: 5, cpm: 100 },
          },
        ]

        const winner: WinnerDecision = {
          status: 'tie',
          confidence: 0.5,
          reason: 'No significant difference',
        }

        const learnings = generateLearnings(variants, winner)

        expect(learnings.some((l) => l.title.includes('CTR'))).toBe(true)
      })
    })
  })

  describe('Next Run Suggestions', () => {
    describe('generateNextRunSuggestion', () => {
      it('should suggest sample size expansion for insufficient data', () => {
        const winner: WinnerDecision = {
          status: 'insufficient_data',
          confidence: 0,
          reason: 'Not enough samples',
        }

        const suggestion = generateNextRunSuggestion('run_1', winner, [], [])

        expect(suggestion).not.toBeNull()
        expect(suggestion?.type).toBe('iterate')
        expect(suggestion?.title).toContain('サンプルサイズ')
      })

      it('should suggest iteration for winner', () => {
        const winner: WinnerDecision = {
          status: 'winner',
          winnerVariantId: 'treatment',
          improvement: 20,
          confidence: 0.95,
          reason: 'Treatment won',
        }

        const variants: VariantResult[] = [
          {
            variantId: 'treatment',
            variantName: 'Treatment',
            isControl: false,
            sampleSize: 5000,
            conversions: 700,
            clicks: 5000,
            impressions: 100000,
            spend: 10000,
            revenue: 70000,
            metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
          },
        ]

        const suggestion = generateNextRunSuggestion('run_1', winner, [], variants)

        expect(suggestion).not.toBeNull()
        expect(suggestion?.type).toBe('iterate')
        expect(suggestion?.title).toContain('最適化')
      })

      it('should suggest pivot for tie', () => {
        const winner: WinnerDecision = {
          status: 'tie',
          confidence: 0.5,
          reason: 'No significant difference',
        }

        const suggestion = generateNextRunSuggestion('run_1', winner, [], [])

        expect(suggestion).not.toBeNull()
        expect(suggestion?.type).toBe('pivot')
      })
    })
  })

  describe('Test Result Creation', () => {
    describe('createTestResult', () => {
      it('should create complete test result', () => {
        const variants: VariantResult[] = [
          {
            variantId: 'control',
            variantName: 'Control',
            isControl: true,
            sampleSize: 5000,
            conversions: 500,
            clicks: 5000,
            impressions: 100000,
            spend: 10000,
            revenue: 50000,
            metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
          },
          {
            variantId: 'treatment',
            variantName: 'Treatment',
            isControl: false,
            sampleSize: 5000,
            conversions: 700,
            clicks: 5000,
            impressions: 100000,
            spend: 10000,
            revenue: 70000,
            metrics: { cvr: 0, ctr: 0, cpa: 0, roas: 0, cpc: 0, cpm: 0 },
          },
        ]

        const result = createTestResult(
          'run_1',
          'ab_test',
          '2025-01-01',
          '2025-01-15',
          'cvr',
          variants
        )

        expect(result.id).toMatch(/^test_/)
        expect(result.runId).toBe('run_1')
        expect(result.testType).toBe('ab_test')
        expect(result.primaryMetric).toBe('cvr')
        expect(result.variants).toHaveLength(2)
        expect(result.variants[0].metrics.cvr).toBeGreaterThan(0)
        expect(result.winner).toBeDefined()
        expect(result.sampleSize).toBe(10000)
      })
    })
  })

  describe('Labels', () => {
    describe('getMetricTypeLabel', () => {
      it('should return Japanese labels', () => {
        expect(getMetricTypeLabel('cvr')).toBe('コンバージョン率')
        expect(getMetricTypeLabel('ctr')).toBe('クリック率')
        expect(getMetricTypeLabel('cpa')).toBe('顧客獲得単価')
        expect(getMetricTypeLabel('roas')).toBe('広告費用対効果')
      })
    })

    describe('getTestTypeLabel', () => {
      it('should return Japanese labels', () => {
        expect(getTestTypeLabel('ab_test')).toBe('A/Bテスト')
        expect(getTestTypeLabel('multivariate')).toBe('多変量テスト')
        expect(getTestTypeLabel('bandit')).toBe('バンディットテスト')
      })
    })

    describe('getWinnerStatusLabel', () => {
      it('should return Japanese labels', () => {
        expect(getWinnerStatusLabel('winner')).toBe('勝者あり')
        expect(getWinnerStatusLabel('loser')).toBe('コントロールが優位')
        expect(getWinnerStatusLabel('tie')).toBe('引き分け')
        expect(getWinnerStatusLabel('insufficient_data')).toBe('データ不足')
      })
    })

    describe('getImpactLabel', () => {
      it('should return Japanese labels', () => {
        expect(getImpactLabel('high')).toBe('高')
        expect(getImpactLabel('medium')).toBe('中')
        expect(getImpactLabel('low')).toBe('低')
      })
    })
  })
})
