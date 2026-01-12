import { describe, it, expect } from 'vitest'
import {
  validateStopConditions,
  checkBudgetTotal,
  checkBudgetDaily,
  checkCpaLimit,
  checkCvZero,
  checkErrorConsecutive,
  evaluateStopConditions,
  createStopEvent,
  getStopReasonLabel,
  createDefaultStopConditions,
  type StopConditions,
  type MetricsData,
} from '../../src/domain/auto-stop'

describe('Auto-Stop System', () => {
  describe('validateStopConditions', () => {
    it('should pass valid conditions', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: true,
        budgetTotal: 100000,
        budgetDailyEnabled: true,
        budgetDaily: 10000,
        cpaLimitEnabled: true,
        cpaLimit: 5000,
        cpaMinSample: 50,
        cvZeroHoursEnabled: true,
        cvZeroHours: 24,
        errorConsecutiveEnabled: true,
        errorConsecutiveCount: 3,
      }

      const errors = validateStopConditions(conditions)
      expect(errors).toHaveLength(0)
    })

    it('should reject invalid budget total', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: true,
        budgetTotal: undefined,
        budgetDailyEnabled: false,
        cpaLimitEnabled: false,
        cvZeroHoursEnabled: false,
        errorConsecutiveEnabled: false,
      }

      const errors = validateStopConditions(conditions)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.includes('総額上限'))).toBe(true)
    })

    it('should reject CPA limit without min sample', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: false,
        budgetDailyEnabled: false,
        cpaLimitEnabled: true,
        cpaLimit: 5000,
        cpaMinSample: undefined,
        cvZeroHoursEnabled: false,
        errorConsecutiveEnabled: false,
      }

      const errors = validateStopConditions(conditions)
      expect(errors.some((e) => e.includes('最低サンプル'))).toBe(true)
    })
  })

  describe('checkBudgetTotal', () => {
    const conditions: StopConditions = {
      budgetTotalEnabled: true,
      budgetTotal: 100000,
      budgetDailyEnabled: false,
      cpaLimitEnabled: false,
      cvZeroHoursEnabled: false,
      errorConsecutiveEnabled: false,
    }

    it('should stop when total spend exceeds limit', () => {
      const metrics: MetricsData = {
        totalSpend: 100000,
        dailySpend: 10000,
        conversions: 20,
        cpa: 5000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkBudgetTotal(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('budget_total')
    })

    it('should not stop when under limit', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 10,
        cpa: 5000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkBudgetTotal(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })

    it('should not check when disabled', () => {
      const disabledConditions: StopConditions = {
        ...conditions,
        budgetTotalEnabled: false,
      }

      const metrics: MetricsData = {
        totalSpend: 200000,
        dailySpend: 20000,
        conversions: 0,
        cpa: null,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkBudgetTotal(disabledConditions, metrics)
      expect(result.shouldStop).toBe(false)
    })
  })

  describe('checkBudgetDaily', () => {
    const conditions: StopConditions = {
      budgetTotalEnabled: false,
      budgetDailyEnabled: true,
      budgetDaily: 10000,
      cpaLimitEnabled: false,
      cvZeroHoursEnabled: false,
      errorConsecutiveEnabled: false,
    }

    it('should stop when daily spend exceeds limit', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 10000,
        conversions: 10,
        cpa: 1000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkBudgetDaily(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('budget_daily')
    })

    it('should not stop when under limit', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5,
        cpa: 1000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkBudgetDaily(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })
  })

  describe('checkCpaLimit', () => {
    const conditions: StopConditions = {
      budgetTotalEnabled: false,
      budgetDailyEnabled: false,
      cpaLimitEnabled: true,
      cpaLimit: 5000,
      cpaMinSample: 10,
      cvZeroHoursEnabled: false,
      errorConsecutiveEnabled: false,
    }

    it('should stop when CPA exceeds limit after min sample', () => {
      const metrics: MetricsData = {
        totalSpend: 60000,
        dailySpend: 6000,
        conversions: 10,
        cpa: 6000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkCpaLimit(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('cpa_limit')
    })

    it('should not stop when CPA is under limit', () => {
      const metrics: MetricsData = {
        totalSpend: 40000,
        dailySpend: 4000,
        conversions: 10,
        cpa: 4000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkCpaLimit(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })

    it('should not check before min sample reached', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5, // Under min sample of 10
        cpa: 10000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkCpaLimit(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })

    it('should not check when CPA is null', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 10,
        cpa: null,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = checkCpaLimit(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })
  })

  describe('checkCvZero', () => {
    const conditions: StopConditions = {
      budgetTotalEnabled: false,
      budgetDailyEnabled: false,
      cpaLimitEnabled: false,
      cvZeroHoursEnabled: true,
      cvZeroHours: 24,
      errorConsecutiveEnabled: false,
    }

    it('should stop when no CV for specified hours', () => {
      const lastCvTime = new Date()
      lastCvTime.setHours(lastCvTime.getHours() - 25)

      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5,
        cpa: 10000,
        lastConversionAt: lastCvTime.toISOString(),
        consecutiveErrors: 0,
      }

      const result = checkCvZero(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('cv_zero')
    })

    it('should not stop when CV within threshold', () => {
      const lastCvTime = new Date()
      lastCvTime.setHours(lastCvTime.getHours() - 12)

      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5,
        cpa: 10000,
        lastConversionAt: lastCvTime.toISOString(),
        consecutiveErrors: 0,
      }

      const result = checkCvZero(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })
  })

  describe('checkErrorConsecutive', () => {
    const conditions: StopConditions = {
      budgetTotalEnabled: false,
      budgetDailyEnabled: false,
      cpaLimitEnabled: false,
      cvZeroHoursEnabled: false,
      errorConsecutiveEnabled: true,
      errorConsecutiveCount: 3,
    }

    it('should stop when consecutive errors reach limit', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5,
        cpa: 10000,
        lastConversionAt: null,
        consecutiveErrors: 3,
      }

      const result = checkErrorConsecutive(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('error_consecutive')
    })

    it('should not stop when errors under limit', () => {
      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 5,
        cpa: 10000,
        lastConversionAt: null,
        consecutiveErrors: 2,
      }

      const result = checkErrorConsecutive(conditions, metrics)
      expect(result.shouldStop).toBe(false)
    })
  })

  describe('evaluateStopConditions', () => {
    it('should check all conditions in priority order', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: true,
        budgetTotal: 100000,
        budgetDailyEnabled: true,
        budgetDaily: 10000,
        cpaLimitEnabled: true,
        cpaLimit: 5000,
        cpaMinSample: 10,
        cvZeroHoursEnabled: false,
        errorConsecutiveEnabled: false,
      }

      // Both budget total and daily exceeded
      const metrics: MetricsData = {
        totalSpend: 100000,
        dailySpend: 15000,
        conversions: 10,
        cpa: 10000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = evaluateStopConditions(conditions, metrics)
      // Should return budget_total first (highest priority)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('budget_total')
    })

    it('should return no stop when all conditions pass', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: true,
        budgetTotal: 100000,
        budgetDailyEnabled: true,
        budgetDaily: 10000,
        cpaLimitEnabled: false,
        cvZeroHoursEnabled: false,
        errorConsecutiveEnabled: false,
      }

      const metrics: MetricsData = {
        totalSpend: 50000,
        dailySpend: 5000,
        conversions: 10,
        cpa: 5000,
        lastConversionAt: null,
        consecutiveErrors: 0,
      }

      const result = evaluateStopConditions(conditions, metrics)
      expect(result.shouldStop).toBe(false)
      expect(result.reason).toBeNull()
    })

    it('should prioritize error_consecutive before CPA', () => {
      const conditions: StopConditions = {
        budgetTotalEnabled: false,
        budgetDailyEnabled: false,
        cpaLimitEnabled: true,
        cpaLimit: 5000,
        cpaMinSample: 10,
        cvZeroHoursEnabled: false,
        errorConsecutiveEnabled: true,
        errorConsecutiveCount: 3,
      }

      const metrics: MetricsData = {
        totalSpend: 100000,
        dailySpend: 10000,
        conversions: 10,
        cpa: 10000, // Over CPA limit
        lastConversionAt: null,
        consecutiveErrors: 5, // Also over error limit
      }

      const result = evaluateStopConditions(conditions, metrics)
      expect(result.shouldStop).toBe(true)
      expect(result.reason).toBe('error_consecutive')
    })
  })

  describe('createStopEvent', () => {
    it('should create stop event from evaluation', () => {
      const evaluation = {
        shouldStop: true,
        reason: 'budget_total' as const,
        details: {
          condition: '総額上限',
          currentValue: 100000,
          threshold: 100000,
          message: 'Test message',
        },
      }

      const event = createStopEvent('run_123', 'tenant_456', evaluation, 'run', 'run_123')

      expect(event).not.toBeNull()
      expect(event?.runId).toBe('run_123')
      expect(event?.reason).toBe('budget_total')
      expect(event?.targetType).toBe('run')
    })

    it('should return null for non-stop evaluation', () => {
      const evaluation = {
        shouldStop: false,
        reason: null,
        details: null,
      }

      const event = createStopEvent('run_123', 'tenant_456', evaluation)
      expect(event).toBeNull()
    })
  })

  describe('getStopReasonLabel', () => {
    it('should return Japanese labels', () => {
      expect(getStopReasonLabel('budget_total')).toBe('総額上限到達')
      expect(getStopReasonLabel('budget_daily')).toBe('日額上限到達')
      expect(getStopReasonLabel('cpa_limit')).toBe('CPA上限超過')
      expect(getStopReasonLabel('cv_zero')).toBe('CVゼロ継続')
      expect(getStopReasonLabel('error_consecutive')).toBe('連続エラー')
      expect(getStopReasonLabel('manual')).toBe('手動停止')
    })
  })

  describe('createDefaultStopConditions', () => {
    it('should create sensible defaults', () => {
      const defaults = createDefaultStopConditions()

      expect(defaults.budgetTotalEnabled).toBe(true)
      expect(defaults.budgetDailyEnabled).toBe(true)
      expect(defaults.cpaLimitEnabled).toBe(false)
      expect(defaults.cvZeroHoursEnabled).toBe(true)
      expect(defaults.cvZeroHours).toBe(24)
      expect(defaults.errorConsecutiveEnabled).toBe(true)
      expect(defaults.errorConsecutiveCount).toBe(3)
    })
  })
})

describe('Auto-Stop Safety Scenarios', () => {
  it('should stop immediately at budget limit', () => {
    const conditions = createDefaultStopConditions()
    conditions.budgetTotal = 100000

    const metrics: MetricsData = {
      totalSpend: 100001,
      dailySpend: 10000,
      conversions: 20,
      cpa: 5000,
      lastConversionAt: null,
      consecutiveErrors: 0,
    }

    const result = evaluateStopConditions(conditions, metrics)
    expect(result.shouldStop).toBe(true)
    expect(result.reason).toBe('budget_total')
  })

  it('should protect against runaway spending with daily limit', () => {
    const conditions = createDefaultStopConditions()
    conditions.budgetTotal = 1000000
    conditions.budgetDaily = 10000

    const metrics: MetricsData = {
      totalSpend: 50000,
      dailySpend: 12000, // Over daily limit
      conversions: 5,
      cpa: 10000,
      lastConversionAt: null,
      consecutiveErrors: 0,
    }

    const result = evaluateStopConditions(conditions, metrics)
    expect(result.shouldStop).toBe(true)
    expect(result.reason).toBe('budget_daily')
  })

  it('should detect system issues via consecutive errors', () => {
    const conditions = createDefaultStopConditions()
    conditions.budgetTotal = 1000000
    conditions.budgetDaily = 100000

    const metrics: MetricsData = {
      totalSpend: 10000,
      dailySpend: 1000,
      conversions: 0,
      cpa: null,
      lastConversionAt: null,
      consecutiveErrors: 5, // System issues
    }

    const result = evaluateStopConditions(conditions, metrics)
    expect(result.shouldStop).toBe(true)
    expect(result.reason).toBe('error_consecutive')
  })

  it('should allow learning period before CPA check', () => {
    const conditions = createDefaultStopConditions()
    conditions.cpaLimitEnabled = true
    conditions.cpaLimit = 5000
    conditions.cpaMinSample = 50

    // Only 10 conversions - still in learning period
    const metrics: MetricsData = {
      totalSpend: 100000,
      dailySpend: 10000,
      conversions: 10,
      cpa: 10000, // Would be over limit
      lastConversionAt: new Date().toISOString(),
      consecutiveErrors: 0,
    }

    // Set budgets high so they don't trigger
    conditions.budgetTotal = 1000000
    conditions.budgetDaily = 100000

    const result = evaluateStopConditions(conditions, metrics)
    // Should NOT stop because min sample not reached
    expect(result.shouldStop).toBe(false)
  })
})
