import { describe, it, expect } from 'vitest'
import {
  generateEventId,
  generateConversionId,
  generateUTMParams,
  utmToQueryString,
  appendUTMToUrl,
  parseUTMFromUrl,
  generateVariantIdentifier,
  parseVariantIdentifier,
  createTrackingEvent,
  createConversionDefinition,
  isConversionEvent,
  createConversionRecord,
  createHourlyMetrics,
  createDailyMetrics,
  calculateDerivedMetrics,
  updateHourlyMetrics,
  aggregateHourlyToDaily,
  aggregateDailyMetrics,
  compareVariantMetrics,
  formatDateString,
  formatHourString,
  generateDateRange,
  generateHourRange,
  createPixelConfig,
  generateMetaPixelCode,
  generateGATag,
  getEventTypeLabel,
  getMetricsPeriodLabel,
  type UTMConfig,
  type UTMParams,
  type TrackingEvent,
  type HourlyMetrics,
  type DailyMetrics,
  type AggregatedMetrics,
} from '../../src/domain/measurement'

describe('Measurement & Tracking System', () => {
  describe('ID Generation', () => {
    describe('generateEventId', () => {
      it('should generate unique event IDs', () => {
        const id1 = generateEventId()
        const id2 = generateEventId()

        expect(id1).toMatch(/^evt_/)
        expect(id2).toMatch(/^evt_/)
        expect(id1).not.toBe(id2)
      })
    })

    describe('generateConversionId', () => {
      it('should generate unique conversion IDs', () => {
        const id1 = generateConversionId()
        const id2 = generateConversionId()

        expect(id1).toMatch(/^conv_/)
        expect(id2).toMatch(/^conv_/)
        expect(id1).not.toBe(id2)
      })
    })
  })

  describe('UTM Parameters', () => {
    describe('generateUTMParams', () => {
      it('should generate UTM params with required fields', () => {
        const config: UTMConfig = {
          runId: 'run_1',
          variantId: 'var_1',
          source: 'facebook',
          medium: 'cpc',
          campaign: 'summer_sale',
        }

        const params = generateUTMParams(config)

        expect(params.utm_source).toBe('facebook')
        expect(params.utm_medium).toBe('cpc')
        expect(params.utm_campaign).toBe('summer_sale')
        expect(params.utm_content).toBeUndefined()
        expect(params.utm_term).toBeUndefined()
      })

      it('should include optional fields when provided', () => {
        const config: UTMConfig = {
          runId: 'run_1',
          variantId: 'var_1',
          source: 'google',
          medium: 'cpc',
          campaign: 'brand',
          content: 'ad_v1',
          term: 'keyword',
        }

        const params = generateUTMParams(config)

        expect(params.utm_content).toBe('ad_v1')
        expect(params.utm_term).toBe('keyword')
      })
    })

    describe('utmToQueryString', () => {
      it('should convert UTM params to query string', () => {
        const params: UTMParams = {
          utm_source: 'facebook',
          utm_medium: 'cpc',
          utm_campaign: 'test',
        }

        const queryString = utmToQueryString(params)

        expect(queryString).toContain('utm_source=facebook')
        expect(queryString).toContain('utm_medium=cpc')
        expect(queryString).toContain('utm_campaign=test')
      })
    })

    describe('appendUTMToUrl', () => {
      it('should append UTM params to URL', () => {
        const params: UTMParams = {
          utm_source: 'facebook',
          utm_medium: 'cpc',
          utm_campaign: 'test',
        }

        const url = appendUTMToUrl('https://example.com/page', params)

        expect(url).toContain('utm_source=facebook')
        expect(url).toContain('utm_medium=cpc')
        expect(url).toContain('utm_campaign=test')
      })

      it('should preserve existing query params', () => {
        const params: UTMParams = {
          utm_source: 'facebook',
          utm_medium: 'cpc',
          utm_campaign: 'test',
        }

        const url = appendUTMToUrl('https://example.com/page?existing=value', params)

        expect(url).toContain('existing=value')
        expect(url).toContain('utm_source=facebook')
      })
    })

    describe('parseUTMFromUrl', () => {
      it('should parse UTM params from URL', () => {
        const url =
          'https://example.com/page?utm_source=facebook&utm_medium=cpc&utm_campaign=test&utm_content=ad1'

        const params = parseUTMFromUrl(url)

        expect(params).not.toBeNull()
        expect(params?.utm_source).toBe('facebook')
        expect(params?.utm_medium).toBe('cpc')
        expect(params?.utm_campaign).toBe('test')
        expect(params?.utm_content).toBe('ad1')
      })

      it('should return null for missing required params', () => {
        const url = 'https://example.com/page?utm_source=facebook'

        const params = parseUTMFromUrl(url)

        expect(params).toBeNull()
      })

      it('should return null for invalid URL', () => {
        const params = parseUTMFromUrl('not-a-url')

        expect(params).toBeNull()
      })
    })
  })

  describe('Variant Identifier', () => {
    describe('generateVariantIdentifier', () => {
      it('should generate variant identifier', () => {
        const identifier = generateVariantIdentifier('run_123', 'var_456', 'meta')

        expect(identifier).toBe('meta_run_123_var_456')
      })

      it('should use default platform', () => {
        const identifier = generateVariantIdentifier('run_123', 'var_456')

        expect(identifier).toBe('meta_run_123_var_456')
      })
    })

    describe('parseVariantIdentifier', () => {
      it('should parse variant identifier', () => {
        // Format: platform_runId_variantId (variantId is last segment)
        const result = parseVariantIdentifier('meta_run123_var456')

        expect(result).not.toBeNull()
        expect(result?.platform).toBe('meta')
        expect(result?.runId).toBe('run123')
        expect(result?.variantId).toBe('var456')
      })

      it('should handle run IDs with underscores', () => {
        // runId contains underscores, variantId is last segment
        const result = parseVariantIdentifier('meta_run_test_123_var')

        expect(result).not.toBeNull()
        expect(result?.platform).toBe('meta')
        expect(result?.runId).toBe('run_test_123')
        expect(result?.variantId).toBe('var')
      })

      it('should return null for invalid identifier', () => {
        const result = parseVariantIdentifier('invalid')

        expect(result).toBeNull()
      })

      it('should return null for single underscore', () => {
        const result = parseVariantIdentifier('meta_only')

        expect(result).toBeNull()
      })
    })
  })

  describe('Tracking Events', () => {
    describe('createTrackingEvent', () => {
      it('should create tracking event', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'page_view', 'home')

        expect(event.id).toMatch(/^evt_/)
        expect(event.runId).toBe('run_1')
        expect(event.variantId).toBe('var_1')
        expect(event.eventType).toBe('page_view')
        expect(event.eventName).toBe('home')
        expect(event.timestamp).toBeDefined()
      })

      it('should include optional fields', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'purchase', 'order_complete', {
          value: 100,
          currency: 'JPY',
          metadata: { orderId: '12345' },
          userAgent: 'Mozilla/5.0',
          referrer: 'https://google.com',
        })

        expect(event.value).toBe(100)
        expect(event.currency).toBe('JPY')
        expect(event.metadata).toEqual({ orderId: '12345' })
        expect(event.userAgent).toBe('Mozilla/5.0')
        expect(event.referrer).toBe('https://google.com')
      })
    })
  })

  describe('Conversion Definitions', () => {
    describe('createConversionDefinition', () => {
      it('should create conversion definition', () => {
        const def = createConversionDefinition('run_1', 'Purchase', 'purchase', 'order_complete')

        expect(def.id).toMatch(/^conv_/)
        expect(def.runId).toBe('run_1')
        expect(def.name).toBe('Purchase')
        expect(def.eventType).toBe('purchase')
        expect(def.eventName).toBe('order_complete')
        expect(def.isRevenue).toBe(false)
        expect(def.attributionWindow).toBe(7)
      })

      it('should apply custom options', () => {
        const def = createConversionDefinition('run_1', 'Lead', 'lead', 'form_submit', {
          value: 5000,
          isRevenue: true,
          attributionWindow: 30,
          priority: 1,
        })

        expect(def.value).toBe(5000)
        expect(def.isRevenue).toBe(true)
        expect(def.attributionWindow).toBe(30)
        expect(def.priority).toBe(1)
      })
    })

    describe('isConversionEvent', () => {
      it('should match conversion event', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'purchase', 'order_complete')
        const def = createConversionDefinition('run_1', 'Purchase', 'purchase', 'order_complete')

        expect(isConversionEvent(event, def)).toBe(true)
      })

      it('should not match different run', () => {
        const event = createTrackingEvent('run_2', 'var_1', 'purchase', 'order_complete')
        const def = createConversionDefinition('run_1', 'Purchase', 'purchase', 'order_complete')

        expect(isConversionEvent(event, def)).toBe(false)
      })

      it('should not match different event type', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'lead', 'form_submit')
        const def = createConversionDefinition('run_1', 'Purchase', 'purchase', 'order_complete')

        expect(isConversionEvent(event, def)).toBe(false)
      })
    })

    describe('createConversionRecord', () => {
      it('should create conversion record', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'purchase', 'order_complete', {
          value: 10000,
        })
        const def = createConversionDefinition('run_1', 'Purchase', 'purchase', 'order_complete')

        const record = createConversionRecord(event, def, 'utm')

        expect(record.id).toMatch(/^conv_/)
        expect(record.definitionId).toBe(def.id)
        expect(record.runId).toBe('run_1')
        expect(record.variantId).toBe('var_1')
        expect(record.eventId).toBe(event.id)
        expect(record.value).toBe(10000)
        expect(record.attributed).toBe(true)
        expect(record.attributionSource).toBe('utm')
      })

      it('should use definition value if event value is missing', () => {
        const event = createTrackingEvent('run_1', 'var_1', 'lead', 'form_submit')
        const def = createConversionDefinition('run_1', 'Lead', 'lead', 'form_submit', {
          value: 5000,
        })

        const record = createConversionRecord(event, def)

        expect(record.value).toBe(5000)
      })
    })
  })

  describe('Metrics', () => {
    describe('createHourlyMetrics', () => {
      it('should create hourly metrics', () => {
        const hour = new Date('2025-01-15T14:30:00Z')
        const metrics = createHourlyMetrics('run_1', 'var_1', hour)

        expect(metrics.runId).toBe('run_1')
        expect(metrics.variantId).toBe('var_1')
        expect(metrics.hour).toBe('2025-01-15T14:00:00.000Z')
        expect(metrics.impressions).toBe(0)
        expect(metrics.clicks).toBe(0)
      })
    })

    describe('createDailyMetrics', () => {
      it('should create daily metrics', () => {
        const date = new Date('2025-01-15T14:30:00Z')
        const metrics = createDailyMetrics('run_1', 'var_1', date)

        expect(metrics.runId).toBe('run_1')
        expect(metrics.variantId).toBe('var_1')
        expect(metrics.date).toBe('2025-01-15')
        expect(metrics.impressions).toBe(0)
      })
    })

    describe('calculateDerivedMetrics', () => {
      it('should calculate derived metrics', () => {
        const metrics: DailyMetrics = {
          runId: 'run_1',
          variantId: 'var_1',
          date: '2025-01-15',
          impressions: 10000,
          reach: 8000,
          clicks: 100,
          spend: 5000,
          conversions: 10,
          revenue: 50000,
          cpc: 0,
          cpm: 0,
          ctr: 0,
          cvr: 0,
          cpa: 0,
          roas: 0,
        }

        const result = calculateDerivedMetrics(metrics)

        expect(result.cpc).toBe(50) // 5000 / 100
        expect(result.cpm).toBe(500) // (5000 / 10000) * 1000
        expect(result.ctr).toBe(1) // (100 / 10000) * 100
        expect(result.cvr).toBe(10) // (10 / 100) * 100
        expect(result.cpa).toBe(500) // 5000 / 10
        expect(result.roas).toBe(10) // 50000 / 5000
      })

      it('should handle zero values', () => {
        const metrics: DailyMetrics = {
          runId: 'run_1',
          variantId: 'var_1',
          date: '2025-01-15',
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

        const result = calculateDerivedMetrics(metrics)

        expect(result.cpc).toBe(0)
        expect(result.cpm).toBe(0)
        expect(result.ctr).toBe(0)
        expect(result.cvr).toBe(0)
        expect(result.cpa).toBe(0)
        expect(result.roas).toBe(0)
      })
    })

    describe('updateHourlyMetrics', () => {
      it('should update hourly metrics', () => {
        const metrics: HourlyMetrics = {
          runId: 'run_1',
          variantId: 'var_1',
          hour: '2025-01-15T14:00:00.000Z',
          impressions: 100,
          clicks: 10,
          spend: 500,
          conversions: 1,
          revenue: 5000,
        }

        const updated = updateHourlyMetrics(metrics, {
          impressions: 50,
          clicks: 5,
          spend: 250,
        })

        expect(updated.impressions).toBe(150)
        expect(updated.clicks).toBe(15)
        expect(updated.spend).toBe(750)
        expect(updated.conversions).toBe(1) // Unchanged
      })
    })

    describe('aggregateHourlyToDaily', () => {
      it('should aggregate hourly metrics to daily', () => {
        const hourlyMetrics: HourlyMetrics[] = [
          {
            runId: 'run_1',
            variantId: 'var_1',
            hour: '2025-01-15T10:00:00.000Z',
            impressions: 1000,
            clicks: 10,
            spend: 500,
            conversions: 1,
            revenue: 5000,
          },
          {
            runId: 'run_1',
            variantId: 'var_1',
            hour: '2025-01-15T11:00:00.000Z',
            impressions: 2000,
            clicks: 20,
            spend: 1000,
            conversions: 2,
            revenue: 10000,
          },
        ]

        const daily = aggregateHourlyToDaily(hourlyMetrics, '2025-01-15')

        expect(daily).not.toBeNull()
        expect(daily?.impressions).toBe(3000)
        expect(daily?.clicks).toBe(30)
        expect(daily?.spend).toBe(1500)
        expect(daily?.conversions).toBe(3)
        expect(daily?.revenue).toBe(15000)
        expect(daily?.cpc).toBe(50) // Derived
      })

      it('should return null for no matching data', () => {
        const hourlyMetrics: HourlyMetrics[] = [
          {
            runId: 'run_1',
            variantId: 'var_1',
            hour: '2025-01-14T10:00:00.000Z',
            impressions: 1000,
            clicks: 10,
            spend: 500,
            conversions: 1,
            revenue: 5000,
          },
        ]

        const daily = aggregateHourlyToDaily(hourlyMetrics, '2025-01-15')

        expect(daily).toBeNull()
      })
    })

    describe('aggregateDailyMetrics', () => {
      it('should aggregate multiple daily metrics', () => {
        const dailyMetrics: DailyMetrics[] = [
          {
            runId: 'run_1',
            variantId: 'var_1',
            date: '2025-01-15',
            impressions: 10000,
            reach: 8000,
            clicks: 100,
            spend: 5000,
            conversions: 10,
            revenue: 50000,
            cpc: 50,
            cpm: 500,
            ctr: 1,
            cvr: 10,
            cpa: 500,
            roas: 10,
          },
          {
            runId: 'run_1',
            variantId: 'var_1',
            date: '2025-01-16',
            impressions: 15000,
            reach: 12000,
            clicks: 150,
            spend: 7500,
            conversions: 15,
            revenue: 75000,
            cpc: 50,
            cpm: 500,
            ctr: 1,
            cvr: 10,
            cpa: 500,
            roas: 10,
          },
        ]

        const aggregated = aggregateDailyMetrics(dailyMetrics)

        expect(aggregated.totalImpressions).toBe(25000)
        expect(aggregated.totalClicks).toBe(250)
        expect(aggregated.totalSpend).toBe(12500)
        expect(aggregated.totalConversions).toBe(25)
        expect(aggregated.totalRevenue).toBe(125000)
        expect(aggregated.avgCpc).toBe(50)
        expect(aggregated.roas).toBe(10)
      })

      it('should return zeros for empty metrics', () => {
        const aggregated = aggregateDailyMetrics([])

        expect(aggregated.totalImpressions).toBe(0)
        expect(aggregated.totalClicks).toBe(0)
        expect(aggregated.avgCpc).toBe(0)
      })
    })

    describe('compareVariantMetrics', () => {
      it('should compare variant metrics', () => {
        const variantA: AggregatedMetrics = {
          totalImpressions: 10000,
          totalReach: 8000,
          totalClicks: 100,
          totalSpend: 5000,
          totalConversions: 20,
          totalRevenue: 100000,
          avgCpc: 50,
          avgCpm: 500,
          avgCtr: 1,
          avgCvr: 20,
          avgCpa: 250,
          roas: 20,
        }

        const variantB: AggregatedMetrics = {
          totalImpressions: 10000,
          totalReach: 8000,
          totalClicks: 100,
          totalSpend: 5000,
          totalConversions: 10,
          totalRevenue: 50000,
          avgCpc: 50,
          avgCpm: 500,
          avgCtr: 1,
          avgCvr: 10,
          avgCpa: 500,
          roas: 10,
        }

        const comparison = compareVariantMetrics(variantA, variantB)

        expect(comparison.conversionsDiff).toBe(10)
        expect(comparison.cvrDiff).toBe(10)
        expect(comparison.roasDiff).toBe(10)
        expect(comparison.winner).toBe('A')
      })

      it('should return tie for similar metrics', () => {
        const variantA: AggregatedMetrics = {
          totalImpressions: 10000,
          totalReach: 8000,
          totalClicks: 100,
          totalSpend: 5000,
          totalConversions: 10,
          totalRevenue: 50000,
          avgCpc: 50,
          avgCpm: 500,
          avgCtr: 1,
          avgCvr: 10,
          avgCpa: 500,
          roas: 10,
        }

        const variantB: AggregatedMetrics = {
          totalImpressions: 10000,
          totalReach: 8000,
          totalClicks: 100,
          totalSpend: 5000,
          totalConversions: 10,
          totalRevenue: 52000, // Within 10% threshold
          avgCpc: 50,
          avgCpm: 500,
          avgCtr: 1,
          avgCvr: 10,
          avgCpa: 500,
          roas: 10.4,
        }

        const comparison = compareVariantMetrics(variantA, variantB)

        expect(comparison.winner).toBe('tie')
      })
    })
  })

  describe('Date Utilities', () => {
    describe('formatDateString', () => {
      it('should format date as YYYY-MM-DD', () => {
        const date = new Date('2025-06-15T12:00:00Z')
        expect(formatDateString(date)).toBe('2025-06-15')
      })

      it('should pad single digits', () => {
        const date = new Date('2025-01-05T00:00:00Z')
        expect(formatDateString(date)).toBe('2025-01-05')
      })
    })

    describe('formatHourString', () => {
      it('should format hour string', () => {
        const date = new Date('2025-06-15T14:30:45Z')
        expect(formatHourString(date)).toBe('2025-06-15T14:00:00.000Z')
      })
    })

    describe('generateDateRange', () => {
      it('should generate date range', () => {
        const start = new Date('2025-01-01')
        const end = new Date('2025-01-05')

        const range = generateDateRange(start, end)

        expect(range).toHaveLength(5)
        expect(range[0]).toBe('2025-01-01')
        expect(range[4]).toBe('2025-01-05')
      })
    })

    describe('generateHourRange', () => {
      it('should generate hour range', () => {
        const start = new Date('2025-01-01T10:00:00Z')
        const end = new Date('2025-01-01T14:00:00Z')

        const range = generateHourRange(start, end)

        expect(range).toHaveLength(5)
        expect(range[0]).toContain('10:00:00')
        expect(range[4]).toContain('14:00:00')
      })
    })
  })

  describe('Pixel Configuration', () => {
    describe('createPixelConfig', () => {
      it('should create pixel config', () => {
        const config = createPixelConfig('run_1', 'meta', '123456789')

        expect(config.id).toMatch(/^pixel_/)
        expect(config.runId).toBe('run_1')
        expect(config.platform).toBe('meta')
        expect(config.pixelId).toBe('123456789')
        expect(config.events).toContain('PageView')
        expect(config.enabled).toBe(true)
      })

      it('should accept custom events', () => {
        const config = createPixelConfig('run_1', 'google', 'GA-123', [
          'page_view',
          'conversion',
        ])

        expect(config.events).toEqual(['page_view', 'conversion'])
      })
    })

    describe('generateMetaPixelCode', () => {
      it('should generate Meta pixel code', () => {
        const code = generateMetaPixelCode('123456789')

        expect(code).toContain('fbq')
        expect(code).toContain("'init', '123456789'")
        expect(code).toContain("'track', 'PageView'")
      })
    })

    describe('generateGATag', () => {
      it('should generate GA tag', () => {
        const tag = generateGATag('G-12345678')

        expect(tag).toContain('gtag/js')
        expect(tag).toContain('G-12345678')
        expect(tag).toContain("gtag('config'")
      })
    })
  })

  describe('Label Functions', () => {
    describe('getEventTypeLabel', () => {
      it('should return Japanese labels', () => {
        expect(getEventTypeLabel('page_view')).toBe('ページビュー')
        expect(getEventTypeLabel('purchase')).toBe('購入')
        expect(getEventTypeLabel('lead')).toBe('リード')
        expect(getEventTypeLabel('custom')).toBe('カスタム')
      })
    })

    describe('getMetricsPeriodLabel', () => {
      it('should return single date for same dates', () => {
        expect(getMetricsPeriodLabel('2025-01-15', '2025-01-15')).toBe('2025-01-15')
      })

      it('should return range for different dates', () => {
        expect(getMetricsPeriodLabel('2025-01-15', '2025-01-20')).toBe(
          '2025-01-15 〜 2025-01-20'
        )
      })
    })
  })
})
