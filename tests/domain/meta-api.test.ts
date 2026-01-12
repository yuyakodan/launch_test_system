import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  META_API_VERSION,
  META_API_BASE_URL,
  META_API_VERSION_EXPIRY,
  generateOAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  isTokenValid,
  getTokenExpiryDays,
  isApiVersionValid,
  getApiVersionExpiryDays,
  createCampaignPayload,
  createAdSetPayload,
  createAdPayload,
  convertTargetingToApiFormat,
  getInsightsFields,
  parseInsightData,
  parseMetaError,
  isTransientError,
  isRetryableError,
  calculateRetryDelay,
  createSyncResult,
  createMetaConnection,
  updateConnectionStatus,
  updateConnectionToken,
  convertToCents,
  convertFromCents,
  createInsightsParams,
  formatDate,
  createBatchRequest,
  getCampaignObjectiveLabel,
  getBidStrategyLabel,
  getEntityStatusLabel,
  type MetaOAuthConfig,
  type MetaToken,
  type MetaCampaign,
  type MetaAdSet,
  type MetaAd,
  type MetaTargeting,
  type MetaApiError,
} from '../../src/domain/meta-api'

describe('Meta Marketing API Integration', () => {
  describe('API Constants', () => {
    it('should have correct API version', () => {
      expect(META_API_VERSION).toBe('v22.0')
    })

    it('should have correct API base URL', () => {
      expect(META_API_BASE_URL).toBe('https://graph.facebook.com/v22.0')
    })

    it('should have API version expiry date', () => {
      expect(META_API_VERSION_EXPIRY).toBeInstanceOf(Date)
      expect(META_API_VERSION_EXPIRY.getFullYear()).toBe(2026)
    })
  })

  describe('OAuth Flow', () => {
    const config: MetaOAuthConfig = {
      appId: 'test_app_id',
      appSecret: 'test_app_secret',
      redirectUri: 'https://example.com/callback',
    }

    describe('generateOAuthUrl', () => {
      it('should generate OAuth URL with default scopes', () => {
        const url = generateOAuthUrl(config, 'test_state')

        expect(url).toContain('https://www.facebook.com/v22.0/dialog/oauth')
        expect(url).toContain('client_id=test_app_id')
        expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback')
        expect(url).toContain('state=test_state')
        expect(url).toContain('scope=ads_management%2Cads_read%2Cbusiness_management')
      })

      it('should generate OAuth URL with custom scopes', () => {
        const url = generateOAuthUrl(config, 'test_state', ['ads_read', 'pages_read_engagement'])

        expect(url).toContain('scope=ads_read%2Cpages_read_engagement')
      })
    })

    describe('exchangeCodeForToken', () => {
      beforeEach(() => {
        vi.restoreAllMocks()
      })

      it('should exchange code for token successfully', async () => {
        const mockResponse = {
          access_token: 'test_token',
          expires_in: 3600,
          scope: 'ads_management,ads_read',
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const result = await exchangeCodeForToken(config, 'auth_code')

        expect(result.success).toBe(true)
        expect(result.data?.accessToken).toBe('test_token')
        expect(result.data?.tokenType).toBe('short_lived')
        expect(result.data?.scopes).toEqual(['ads_management', 'ads_read'])
      })

      it('should handle API error', async () => {
        const mockError = {
          error: {
            code: 100,
            type: 'OAuthException',
            message: 'Invalid code',
          },
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve(mockError),
        } as Response)

        const result = await exchangeCodeForToken(config, 'invalid_code')

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe(100)
        expect(result.error?.type).toBe('OAuthException')
      })

      it('should handle network error', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'))

        const result = await exchangeCodeForToken(config, 'auth_code')

        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('NetworkError')
        expect(result.error?.isTransient).toBe(true)
      })
    })

    describe('exchangeForLongLivedToken', () => {
      beforeEach(() => {
        vi.restoreAllMocks()
      })

      it('should exchange for long-lived token', async () => {
        const mockResponse = {
          access_token: 'long_lived_token',
          expires_in: 5184000, // 60 days
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const result = await exchangeForLongLivedToken(config, 'short_token')

        expect(result.success).toBe(true)
        expect(result.data?.accessToken).toBe('long_lived_token')
        expect(result.data?.tokenType).toBe('long_lived')
      })
    })
  })

  describe('Token Management', () => {
    describe('isTokenValid', () => {
      it('should return true for valid token', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          scopes: [],
        }

        expect(isTokenValid(token)).toBe(true)
      })

      it('should return false for expired token', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
          scopes: [],
        }

        expect(isTokenValid(token)).toBe(false)
      })

      it('should account for buffer time', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          scopes: [],
        }

        // With 60 minute buffer, token should be invalid
        expect(isTokenValid(token, 60)).toBe(false)
        // With 10 minute buffer, token should be valid
        expect(isTokenValid(token, 10)).toBe(true)
      })
    })

    describe('getTokenExpiryDays', () => {
      it('should return correct days until expiry', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          scopes: [],
        }

        expect(getTokenExpiryDays(token)).toBe(30)
      })

      it('should return 0 for expired token', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() - 1000),
          scopes: [],
        }

        expect(getTokenExpiryDays(token)).toBe(0)
      })
    })
  })

  describe('API Version Management', () => {
    describe('isApiVersionValid', () => {
      it('should return true before expiry date', () => {
        const beforeExpiry = new Date('2025-12-01')
        expect(isApiVersionValid(beforeExpiry)).toBe(true)
      })

      it('should return false after expiry date', () => {
        const afterExpiry = new Date('2026-02-01')
        expect(isApiVersionValid(afterExpiry)).toBe(false)
      })
    })

    describe('getApiVersionExpiryDays', () => {
      it('should return days until expiry', () => {
        const testDate = new Date('2026-01-01')
        const days = getApiVersionExpiryDays(testDate)
        expect(days).toBe(12) // 12 days until 2026-01-13
      })

      it('should return 0 after expiry', () => {
        const afterExpiry = new Date('2026-02-01')
        expect(getApiVersionExpiryDays(afterExpiry)).toBe(0)
      })
    })
  })

  describe('Campaign Operations', () => {
    describe('createCampaignPayload', () => {
      it('should create campaign payload', () => {
        const campaign: Omit<MetaCampaign, 'id' | 'metaId' | 'syncedAt'> = {
          runId: 'run_1',
          name: 'Test Campaign',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          dailyBudget: 10000,
          specialAdCategories: ['NONE'],
        }

        const payload = createCampaignPayload(campaign)

        expect(payload.name).toBe('Test Campaign')
        expect(payload.objective).toBe('OUTCOME_SALES')
        expect(payload.status).toBe('PAUSED')
        expect(payload.daily_budget).toBe(10000)
        expect(payload.special_ad_categories).toEqual(['NONE'])
      })

      it('should include optional fields when provided', () => {
        const campaign: Omit<MetaCampaign, 'id' | 'metaId' | 'syncedAt'> = {
          runId: 'run_1',
          name: 'Test Campaign',
          objective: 'OUTCOME_TRAFFIC',
          status: 'ACTIVE',
          lifetimeBudget: 500000,
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-01-31T23:59:59Z',
          specialAdCategories: ['NONE'],
        }

        const payload = createCampaignPayload(campaign)

        expect(payload.lifetime_budget).toBe(500000)
        expect(payload.start_time).toBe('2025-01-01T00:00:00Z')
        expect(payload.end_time).toBe('2025-01-31T23:59:59Z')
      })
    })
  })

  describe('AdSet Operations', () => {
    describe('createAdSetPayload', () => {
      it('should create ad set payload', () => {
        const adSet: Omit<MetaAdSet, 'id' | 'metaId' | 'syncedAt'> = {
          campaignId: 'campaign_1',
          name: 'Test AdSet',
          status: 'PAUSED',
          dailyBudget: 5000,
          bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
          targeting: {
            geoLocations: { countries: ['JP'] },
            ageMin: 25,
            ageMax: 45,
          },
          optimization: 'CONVERSIONS',
        }

        const payload = createAdSetPayload(adSet)

        expect(payload.name).toBe('Test AdSet')
        expect(payload.status).toBe('PAUSED')
        expect(payload.daily_budget).toBe(5000)
        expect(payload.bid_strategy).toBe('LOWEST_COST_WITHOUT_CAP')
        expect(payload.optimization_goal).toBe('CONVERSIONS')
      })
    })

    describe('convertTargetingToApiFormat', () => {
      it('should convert targeting to API format', () => {
        const targeting: MetaTargeting = {
          geoLocations: {
            countries: ['JP', 'US'],
            regions: [{ key: 'tokyo' }],
          },
          ageMin: 18,
          ageMax: 65,
          genders: [1, 2],
          interests: [{ id: '123', name: 'Technology' }],
        }

        const result = convertTargetingToApiFormat(targeting)

        expect(result.geo_locations).toEqual({
          countries: ['JP', 'US'],
          regions: [{ key: 'tokyo' }],
        })
        expect(result.age_min).toBe(18)
        expect(result.age_max).toBe(65)
        expect(result.genders).toEqual([1, 2])
        expect(result.interests).toEqual([{ id: '123', name: 'Technology' }])
      })

      it('should handle custom audiences', () => {
        const targeting: MetaTargeting = {
          customAudiences: [{ id: 'audience_1' }],
          excludedCustomAudiences: [{ id: 'audience_2' }],
        }

        const result = convertTargetingToApiFormat(targeting)

        expect(result.custom_audiences).toEqual([{ id: 'audience_1' }])
        expect(result.excluded_custom_audiences).toEqual([{ id: 'audience_2' }])
      })
    })
  })

  describe('Ad Operations', () => {
    describe('createAdPayload', () => {
      it('should create ad payload', () => {
        const ad: Omit<MetaAd, 'id' | 'metaId' | 'syncedAt'> = {
          adSetId: 'adset_1',
          name: 'Test Ad',
          status: 'PAUSED',
          creativeId: 'creative_123',
        }

        const payload = createAdPayload(ad)

        expect(payload.name).toBe('Test Ad')
        expect(payload.status).toBe('PAUSED')
        expect(payload.creative).toEqual({ creative_id: 'creative_123' })
      })

      it('should include tracking specs when provided', () => {
        const ad: Omit<MetaAd, 'id' | 'metaId' | 'syncedAt'> = {
          adSetId: 'adset_1',
          name: 'Test Ad',
          status: 'ACTIVE',
          creativeId: 'creative_123',
          trackingSpecs: [{ action_type: 'offsite_conversion', fb_pixel: ['123456'] }],
        }

        const payload = createAdPayload(ad)

        expect(payload.tracking_specs).toEqual([
          { action_type: 'offsite_conversion', fb_pixel: ['123456'] },
        ])
      })
    })
  })

  describe('Insights', () => {
    describe('getInsightsFields', () => {
      it('should return insight fields', () => {
        const fields = getInsightsFields()

        expect(fields).toContain('impressions')
        expect(fields).toContain('reach')
        expect(fields).toContain('clicks')
        expect(fields).toContain('spend')
        expect(fields).toContain('actions')
      })
    })

    describe('parseInsightData', () => {
      it('should parse raw insight data', () => {
        const rawData = {
          date_start: '2025-01-01',
          date_stop: '2025-01-01',
          impressions: '10000',
          reach: '5000',
          clicks: '100',
          spend: '50.00',
          cpc: '0.50',
          cpm: '5.00',
          ctr: '1.00',
          frequency: '2.0',
          actions: [
            { action_type: 'purchase', value: '10' },
            { action_type: 'link_click', value: '100' },
          ],
          cost_per_action_type: [
            { action_type: 'purchase', value: '5.00' },
          ],
        }

        const insight = parseInsightData(rawData)

        expect(insight.dateStart).toBe('2025-01-01')
        expect(insight.impressions).toBe(10000)
        expect(insight.reach).toBe(5000)
        expect(insight.clicks).toBe(100)
        expect(insight.spend).toBe(50)
        expect(insight.conversions).toBe(10)
        expect(insight.costPerConversion).toBe(5)
        expect(insight.actions).toHaveLength(2)
      })

      it('should handle missing data', () => {
        const rawData = {
          date_start: '2025-01-01',
          date_stop: '2025-01-01',
        }

        const insight = parseInsightData(rawData)

        expect(insight.impressions).toBe(0)
        expect(insight.conversions).toBe(0)
        expect(insight.costPerConversion).toBe(0)
      })
    })

    describe('createInsightsParams', () => {
      it('should create insights params', () => {
        const startDate = new Date('2025-01-01')
        const endDate = new Date('2025-01-31')

        const params = createInsightsParams(startDate, endDate)

        expect(params.level).toBe('ad')
        expect(params.time_increment).toBe('1')
        expect(params.time_range).toContain('2025-01-01')
        expect(params.time_range).toContain('2025-01-31')
      })
    })
  })

  describe('Error Handling', () => {
    describe('parseMetaError', () => {
      it('should parse Meta API error', () => {
        const errorData = {
          error: {
            code: 100,
            type: 'OAuthException',
            message: 'Invalid parameter',
            error_subcode: 33,
          },
        }

        const error = parseMetaError(errorData)

        expect(error.code).toBe(100)
        expect(error.type).toBe('OAuthException')
        expect(error.message).toBe('Invalid parameter')
        expect(error.errorSubcode).toBe(33)
        expect(error.isTransient).toBe(false)
      })

      it('should handle unknown error format', () => {
        const errorData = {}

        const error = parseMetaError(errorData)

        expect(error.code).toBe(-1)
        expect(error.type).toBe('UnknownError')
      })
    })

    describe('isTransientError', () => {
      it('should identify transient errors', () => {
        expect(isTransientError(1)).toBe(true) // Unknown
        expect(isTransientError(2)).toBe(true) // Service unavailable
        expect(isTransientError(4)).toBe(true) // Too many calls
        expect(isTransientError(17)).toBe(true) // Rate limit
      })

      it('should identify non-transient errors', () => {
        expect(isTransientError(100)).toBe(false) // Invalid parameter
        expect(isTransientError(200)).toBe(false) // Permission error
      })
    })

    describe('isRetryableError', () => {
      it('should return true for transient errors', () => {
        const error: MetaApiError = {
          code: 4,
          type: 'OAuthException',
          message: 'Too many calls',
          isTransient: true,
        }

        expect(isRetryableError(error)).toBe(true)
      })

      it('should return false for non-transient errors', () => {
        const error: MetaApiError = {
          code: 100,
          type: 'OAuthException',
          message: 'Invalid parameter',
          isTransient: false,
        }

        expect(isRetryableError(error)).toBe(false)
      })
    })

    describe('calculateRetryDelay', () => {
      it('should calculate exponential backoff', () => {
        const delay0 = calculateRetryDelay(0, 1000)
        const delay1 = calculateRetryDelay(1, 1000)
        const delay2 = calculateRetryDelay(2, 1000)

        expect(delay0).toBeGreaterThanOrEqual(1000)
        expect(delay0).toBeLessThan(1200) // With jitter
        expect(delay1).toBeGreaterThanOrEqual(2000)
        expect(delay2).toBeGreaterThanOrEqual(4000)
      })

      it('should respect max delay', () => {
        const delay = calculateRetryDelay(10, 1000, 5000)

        expect(delay).toBeLessThanOrEqual(5500) // Max + jitter
      })
    })
  })

  describe('Connection Management', () => {
    describe('createMetaConnection', () => {
      it('should create Meta connection', () => {
        const token: MetaToken = {
          accessToken: 'test_token',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          scopes: ['ads_management'],
        }

        const connection = createMetaConnection('tenant_1', 'act_123456', token)

        expect(connection.tenantId).toBe('tenant_1')
        expect(connection.adAccountId).toBe('act_123456')
        expect(connection.status).toBe('active')
        expect(connection.token).toBe(token)
        expect(connection.id).toMatch(/^meta_conn_/)
      })

      it('should include optional business ID', () => {
        const token: MetaToken = {
          accessToken: 'test_token',
          tokenType: 'long_lived',
          expiresAt: new Date(),
          scopes: [],
        }

        const connection = createMetaConnection('tenant_1', 'act_123456', token, 'biz_789')

        expect(connection.businessId).toBe('biz_789')
      })
    })

    describe('updateConnectionStatus', () => {
      it('should update connection status', () => {
        const token: MetaToken = {
          accessToken: 'test',
          tokenType: 'long_lived',
          expiresAt: new Date(),
          scopes: [],
        }
        const connection = createMetaConnection('tenant_1', 'act_123', token)
        // Set a past timestamp to ensure the update creates a different timestamp
        connection.updatedAt = '2020-01-01T00:00:00.000Z'

        const updated = updateConnectionStatus(connection, 'expired')

        expect(updated.status).toBe('expired')
        expect(updated.updatedAt).not.toBe(connection.updatedAt)
      })
    })

    describe('updateConnectionToken', () => {
      it('should update connection token', () => {
        const oldToken: MetaToken = {
          accessToken: 'old_token',
          tokenType: 'short_lived',
          expiresAt: new Date(),
          scopes: [],
        }
        const newToken: MetaToken = {
          accessToken: 'new_token',
          tokenType: 'long_lived',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          scopes: ['ads_management'],
        }

        const connection = createMetaConnection('tenant_1', 'act_123', oldToken)
        connection.status = 'expired'

        const updated = updateConnectionToken(connection, newToken)

        expect(updated.token.accessToken).toBe('new_token')
        expect(updated.status).toBe('active')
      })
    })
  })

  describe('Sync Results', () => {
    describe('createSyncResult', () => {
      it('should create successful sync result', () => {
        const result = createSyncResult('campaign', 'camp_1', true, 'meta_123')

        expect(result.success).toBe(true)
        expect(result.entityType).toBe('campaign')
        expect(result.entityId).toBe('camp_1')
        expect(result.metaId).toBe('meta_123')
        expect(result.syncedAt).toBeDefined()
      })

      it('should create failed sync result', () => {
        const result = createSyncResult('ad', 'ad_1', false, undefined, 'API Error')

        expect(result.success).toBe(false)
        expect(result.error).toBe('API Error')
      })
    })
  })

  describe('Utility Functions', () => {
    describe('convertToCents', () => {
      it('should convert to cents', () => {
        expect(convertToCents(100)).toBe(10000)
        expect(convertToCents(99.99)).toBe(9999)
        expect(convertToCents(0.01)).toBe(1)
      })
    })

    describe('convertFromCents', () => {
      it('should convert from cents', () => {
        expect(convertFromCents(10000)).toBe(100)
        expect(convertFromCents(9999)).toBe(99.99)
        expect(convertFromCents(1)).toBe(0.01)
      })
    })

    describe('formatDate', () => {
      it('should format date as YYYY-MM-DD', () => {
        const date = new Date('2025-06-15T12:00:00Z')
        expect(formatDate(date)).toBe('2025-06-15')
      })

      it('should pad single digit months and days', () => {
        const date = new Date('2025-01-05T00:00:00Z')
        expect(formatDate(date)).toBe('2025-01-05')
      })
    })

    describe('createBatchRequest', () => {
      it('should create batch request', () => {
        const requests = [
          { method: 'GET' as const, relativePath: 'me/adaccounts' },
          { method: 'POST' as const, relativePath: 'act_123/campaigns', body: { name: 'Test' } },
        ]

        const batch = createBatchRequest(requests)

        expect(batch).toHaveLength(2)
        expect(batch[0].method).toBe('GET')
        expect(batch[0].relative_url).toBe('me/adaccounts')
        expect(batch[1].body).toBe('{"name":"Test"}')
      })
    })
  })

  describe('Label Functions', () => {
    describe('getCampaignObjectiveLabel', () => {
      it('should return Japanese labels', () => {
        expect(getCampaignObjectiveLabel('OUTCOME_AWARENESS')).toBe('認知度')
        expect(getCampaignObjectiveLabel('OUTCOME_SALES')).toBe('売上')
        expect(getCampaignObjectiveLabel('OUTCOME_LEADS')).toBe('リード獲得')
      })
    })

    describe('getBidStrategyLabel', () => {
      it('should return Japanese labels', () => {
        expect(getBidStrategyLabel('LOWEST_COST_WITHOUT_CAP')).toBe('最低コスト（上限なし）')
        expect(getBidStrategyLabel('COST_CAP')).toBe('コスト上限')
      })
    })

    describe('getEntityStatusLabel', () => {
      it('should return Japanese labels', () => {
        expect(getEntityStatusLabel('ACTIVE')).toBe('配信中')
        expect(getEntityStatusLabel('PAUSED')).toBe('一時停止')
        expect(getEntityStatusLabel('DELETED')).toBe('削除済み')
      })
    })
  })
})
