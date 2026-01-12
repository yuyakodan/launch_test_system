import { describe, it, expect } from 'vitest'
import {
  generateDeploymentId,
  generateAssetId,
  createDeployment,
  updateDeploymentStatus,
  startDeployment,
  completeDeployment,
  failDeployment,
  generateLPUrl,
  generateCreativeUrl,
  generatePreviewUrl,
  generateShortUrl,
  generateShortCode,
  generateQRCodeUrl,
  generateTrackingUrl,
  createDeployedAsset,
  generateHash,
  generateAllUrls,
  createDeploymentLog,
  canRollback,
  executeRollback,
  canPromote,
  getNextEnvironment,
  validateDeployment,
  isValidUrl,
  isPathSafe,
  generateCacheKey,
  generatePurgePattern,
  getEnvironmentLabel,
  getDeploymentStatusLabel,
  calculateDeploymentDuration,
  formatDeploymentDuration,
  type DeploymentRequest,
  type Deployment,
  type UrlConfig,
  type PreviewConfig,
  type DeployedAsset,
  type GeneratedUrls,
} from '../../src/domain/publishing'

describe('Publishing System', () => {
  describe('ID Generation', () => {
    describe('generateDeploymentId', () => {
      it('should generate unique deployment IDs', () => {
        const id1 = generateDeploymentId()
        const id2 = generateDeploymentId()

        expect(id1).toMatch(/^deploy_/)
        expect(id2).toMatch(/^deploy_/)
        expect(id1).not.toBe(id2)
      })
    })

    describe('generateAssetId', () => {
      it('should generate unique asset IDs', () => {
        const id1 = generateAssetId()
        const id2 = generateAssetId()

        expect(id1).toMatch(/^asset_/)
        expect(id2).toMatch(/^asset_/)
        expect(id1).not.toBe(id2)
      })
    })
  })

  describe('Deployment Management', () => {
    const request: DeploymentRequest = {
      runId: 'run_1',
      tenantId: 'tenant_1',
      environment: 'staging',
      deployedBy: 'user_1',
    }

    describe('createDeployment', () => {
      it('should create deployment', () => {
        const deployment = createDeployment(request)

        expect(deployment.id).toMatch(/^deploy_/)
        expect(deployment.runId).toBe('run_1')
        expect(deployment.tenantId).toBe('tenant_1')
        expect(deployment.environment).toBe('staging')
        expect(deployment.status).toBe('pending')
        expect(deployment.deployedBy).toBe('user_1')
        expect(deployment.version).toBe(1)
        expect(deployment.assets).toHaveLength(0)
      })
    })

    describe('updateDeploymentStatus', () => {
      it('should update status', () => {
        const deployment = createDeployment(request)
        const updated = updateDeploymentStatus(deployment, 'deploying')

        expect(updated.status).toBe('deploying')
      })

      it('should set completedAt for terminal statuses', () => {
        const deployment = createDeployment(request)
        const updated = updateDeploymentStatus(deployment, 'deployed')

        expect(updated.completedAt).toBeDefined()
      })

      it('should include error message', () => {
        const deployment = createDeployment(request)
        const updated = updateDeploymentStatus(deployment, 'failed', 'Connection timeout')

        expect(updated.error).toBe('Connection timeout')
      })
    })

    describe('startDeployment', () => {
      it('should start deployment', () => {
        const deployment = createDeployment(request)
        const started = startDeployment(deployment)

        expect(started.status).toBe('deploying')
        expect(started.deployedAt).toBeDefined()
      })
    })

    describe('completeDeployment', () => {
      it('should complete deployment with assets and URLs', () => {
        const deployment = createDeployment(request)
        const assets: DeployedAsset[] = [
          createDeployedAsset('lp', 'source.html', 'deployed.html'),
        ]
        const urls: GeneratedUrls = {
          baseUrl: 'https://example.com',
          lpUrls: [],
          creativeUrls: [],
        }

        const completed = completeDeployment(deployment, assets, urls)

        expect(completed.status).toBe('deployed')
        expect(completed.assets).toHaveLength(1)
        expect(completed.urls.baseUrl).toBe('https://example.com')
      })
    })

    describe('failDeployment', () => {
      it('should fail deployment with error', () => {
        const deployment = createDeployment(request)
        const failed = failDeployment(deployment, 'Asset upload failed')

        expect(failed.status).toBe('failed')
        expect(failed.error).toBe('Asset upload failed')
      })
    })
  })

  describe('URL Generation', () => {
    const config: UrlConfig = {
      baseDomain: 'example.com',
      useHttps: true,
      pathPrefix: 'ads',
      cdnDomain: 'cdn.example.com',
    }

    describe('generateLPUrl', () => {
      it('should generate LP URL', () => {
        const url = generateLPUrl(config, 'tenant_1', 'run_1', 'var_1')

        expect(url).toBe('https://example.com/ads/lp/tenant_1/run_1/var_1')
      })

      it('should use HTTP when configured', () => {
        const httpConfig = { ...config, useHttps: false }
        const url = generateLPUrl(httpConfig, 'tenant_1', 'run_1', 'var_1')

        expect(url).toContain('http://')
      })

      it('should omit path prefix when not set', () => {
        const noPrefix = { ...config, pathPrefix: undefined }
        const url = generateLPUrl(noPrefix, 'tenant_1', 'run_1', 'var_1')

        expect(url).toBe('https://example.com/lp/tenant_1/run_1/var_1')
      })
    })

    describe('generateCreativeUrl', () => {
      it('should generate creative URL with CDN', () => {
        const url = generateCreativeUrl(config, 'tenant_1', 'run_1', 'var_1', '1:1')

        expect(url).toBe('https://cdn.example.com/ads/creative/tenant_1/run_1/var_1/1x1')
      })

      it('should fallback to base domain without CDN', () => {
        const noCdn = { ...config, cdnDomain: undefined }
        const url = generateCreativeUrl(noCdn, 'tenant_1', 'run_1', 'var_1', '9:16')

        expect(url).toContain('example.com')
        expect(url).toContain('9x16')
      })
    })

    describe('generatePreviewUrl', () => {
      const previewConfig: PreviewConfig = {
        domain: 'preview.example.com',
        ttlSeconds: 3600,
        requireAuth: true,
      }

      it('should generate preview URL', () => {
        const url = generatePreviewUrl(previewConfig, 'deploy_1', 'var_1')

        expect(url).toBe('https://preview.example.com/preview/deploy_1/var_1')
      })

      it('should include auth token when required', () => {
        const url = generatePreviewUrl(previewConfig, 'deploy_1', 'var_1', 'secret123')

        expect(url).toContain('token=secret123')
      })
    })

    describe('generateShortUrl', () => {
      it('should generate short URL', () => {
        const url = generateShortUrl('example.com', 'abc123')

        expect(url).toBe('https://example.com/s/abc123')
      })
    })

    describe('generateShortCode', () => {
      it('should generate short code of specified length', () => {
        const code = generateShortCode(10)

        expect(code).toHaveLength(10)
        expect(code).toMatch(/^[a-zA-Z0-9]+$/)
      })

      it('should use default length of 8', () => {
        const code = generateShortCode()

        expect(code).toHaveLength(8)
      })
    })

    describe('generateQRCodeUrl', () => {
      it('should generate QR code URL', () => {
        const url = generateQRCodeUrl('https://example.com/page', 300)

        expect(url).toContain('api.qrserver.com')
        expect(url).toContain('size=300x300')
        expect(url).toContain(encodeURIComponent('https://example.com/page'))
      })
    })

    describe('generateTrackingUrl', () => {
      it('should generate tracking URL', () => {
        const url = generateTrackingUrl(config, 'tenant_1', 'run_1', 'click')

        expect(url).toBe('https://example.com/ads/track/tenant_1/run_1/click')
      })
    })

    describe('generateAllUrls', () => {
      it('should generate all URLs', () => {
        const lpVariantIds = ['lp_1', 'lp_2']
        const creativeVariants = [
          { id: 'cr_1', aspectRatio: '1:1' },
          { id: 'cr_2', aspectRatio: '9:16' },
        ]

        const urls = generateAllUrls(config, 'tenant_1', 'run_1', lpVariantIds, creativeVariants)

        expect(urls.baseUrl).toContain('tenant_1/run_1')
        expect(urls.lpUrls).toHaveLength(2)
        expect(urls.creativeUrls).toHaveLength(2)
        expect(urls.trackingUrl).toBeDefined()
        expect(urls.lpUrls[0].shortUrl).toBeDefined()
        expect(urls.lpUrls[0].qrCodeUrl).toBeDefined()
      })
    })
  })

  describe('Asset Management', () => {
    describe('createDeployedAsset', () => {
      it('should create deployed asset', () => {
        const asset = createDeployedAsset(
          'lp',
          'source.html',
          'https://cdn.example.com/deployed.html',
          {
            variantId: 'var_1',
            size: 1024,
            contentType: 'text/html',
          }
        )

        expect(asset.id).toMatch(/^asset_/)
        expect(asset.type).toBe('lp')
        expect(asset.sourceUrl).toBe('source.html')
        expect(asset.deployedUrl).toBe('https://cdn.example.com/deployed.html')
        expect(asset.variantId).toBe('var_1')
        expect(asset.size).toBe(1024)
        expect(asset.contentType).toBe('text/html')
        expect(asset.hash).toBeDefined()
      })
    })

    describe('generateHash', () => {
      it('should generate consistent hash', () => {
        const hash1 = generateHash('test input')
        const hash2 = generateHash('test input')

        expect(hash1).toBe(hash2)
      })

      it('should generate different hashes for different inputs', () => {
        const hash1 = generateHash('input 1')
        const hash2 = generateHash('input 2')

        expect(hash1).not.toBe(hash2)
      })
    })
  })

  describe('Deployment Logging', () => {
    describe('createDeploymentLog', () => {
      it('should create deployment log', () => {
        const log = createDeploymentLog('deploy_1', 'info', 'Starting deployment')

        expect(log.deploymentId).toBe('deploy_1')
        expect(log.level).toBe('info')
        expect(log.message).toBe('Starting deployment')
        expect(log.timestamp).toBeDefined()
      })

      it('should include details', () => {
        const log = createDeploymentLog('deploy_1', 'error', 'Failed', { reason: 'timeout' })

        expect(log.details).toEqual({ reason: 'timeout' })
      })
    })
  })

  describe('Rollback', () => {
    describe('canRollback', () => {
      it('should return true for deployed deployment with version > 1', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
          status: 'deployed',
          version: 2,
        }

        expect(canRollback(deployment)).toBe(true)
      })

      it('should return false for version 1', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
          status: 'deployed',
          version: 1,
        }

        expect(canRollback(deployment)).toBe(false)
      })

      it('should return false for non-deployed status', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
          status: 'deploying',
          version: 2,
        }

        expect(canRollback(deployment)).toBe(false)
      })
    })

    describe('executeRollback', () => {
      it('should execute rollback', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
          status: 'deployed',
          version: 2,
        }

        const rolledBack = executeRollback(deployment, {
          deploymentId: deployment.id,
          targetVersion: 1,
          reason: 'Performance issue',
          requestedBy: 'admin_1',
        })

        expect(rolledBack.status).toBe('rollback')
        expect(rolledBack.metadata.rollback).toBeDefined()
      })

      it('should throw error for invalid rollback', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
          status: 'pending',
          version: 1,
        }

        expect(() =>
          executeRollback(deployment, {
            deploymentId: deployment.id,
            targetVersion: 1,
            reason: 'Test',
            requestedBy: 'admin_1',
          })
        ).toThrow('Deployment cannot be rolled back')
      })
    })
  })

  describe('Environment Promotion', () => {
    describe('canPromote', () => {
      it('should allow promotion to higher environment', () => {
        expect(canPromote('preview', 'staging')).toBe(true)
        expect(canPromote('staging', 'production')).toBe(true)
        expect(canPromote('preview', 'production')).toBe(true)
      })

      it('should not allow promotion to lower environment', () => {
        expect(canPromote('production', 'staging')).toBe(false)
        expect(canPromote('staging', 'preview')).toBe(false)
      })

      it('should not allow promotion to same environment', () => {
        expect(canPromote('staging', 'staging')).toBe(false)
      })
    })

    describe('getNextEnvironment', () => {
      it('should return next environment', () => {
        expect(getNextEnvironment('preview')).toBe('staging')
        expect(getNextEnvironment('staging')).toBe('production')
      })

      it('should return null for production', () => {
        expect(getNextEnvironment('production')).toBeNull()
      })
    })
  })

  describe('Validation', () => {
    describe('validateDeployment', () => {
      it('should validate valid deployment', () => {
        const deployment = createDeployment({
          runId: 'run_1',
          tenantId: 'tenant_1',
          environment: 'staging',
          deployedBy: 'user_1',
        })

        const result = validateDeployment(deployment)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should detect missing fields', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: '',
            tenantId: '',
            environment: 'staging',
            deployedBy: '',
          }),
        }

        const result = validateDeployment(deployment)

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should require assets for production', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'production',
            deployedBy: 'user_1',
          }),
        }

        const result = validateDeployment(deployment)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Production deployment requires at least one asset')
      })
    })

    describe('isValidUrl', () => {
      it('should validate correct URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true)
        expect(isValidUrl('http://localhost:3000')).toBe(true)
      })

      it('should reject invalid URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false)
        expect(isValidUrl('')).toBe(false)
      })
    })

    describe('isPathSafe', () => {
      it('should accept safe paths', () => {
        expect(isPathSafe('tenant_1/run_1/var_1')).toBe(true)
        expect(isPathSafe('abc-123')).toBe(true)
      })

      it('should reject path traversal', () => {
        expect(isPathSafe('../secret')).toBe(false)
        expect(isPathSafe('foo/../bar')).toBe(false)
      })

      it('should reject double slashes', () => {
        expect(isPathSafe('foo//bar')).toBe(false)
      })

      it('should reject special characters', () => {
        expect(isPathSafe('foo<script>')).toBe(false)
      })
    })
  })

  describe('CDN', () => {
    describe('generateCacheKey', () => {
      it('should generate cache key', () => {
        const key = generateCacheKey('tenant_1', 'run_1', 'var_1', 3)

        expect(key).toBe('tenant_1/run_1/var_1/v3')
      })
    })

    describe('generatePurgePattern', () => {
      it('should generate purge pattern for run', () => {
        const pattern = generatePurgePattern('tenant_1', 'run_1')

        expect(pattern).toBe('/tenant_1/run_1/*')
      })

      it('should generate purge pattern for variant', () => {
        const pattern = generatePurgePattern('tenant_1', 'run_1', 'var_1')

        expect(pattern).toBe('/tenant_1/run_1/var_1/*')
      })
    })
  })

  describe('Labels', () => {
    describe('getEnvironmentLabel', () => {
      it('should return Japanese labels', () => {
        expect(getEnvironmentLabel('preview')).toBe('プレビュー')
        expect(getEnvironmentLabel('staging')).toBe('ステージング')
        expect(getEnvironmentLabel('production')).toBe('本番')
      })
    })

    describe('getDeploymentStatusLabel', () => {
      it('should return Japanese labels', () => {
        expect(getDeploymentStatusLabel('pending')).toBe('待機中')
        expect(getDeploymentStatusLabel('deploying')).toBe('デプロイ中')
        expect(getDeploymentStatusLabel('deployed')).toBe('デプロイ完了')
        expect(getDeploymentStatusLabel('failed')).toBe('失敗')
      })
    })
  })

  describe('Duration', () => {
    describe('calculateDeploymentDuration', () => {
      it('should calculate duration', () => {
        const deployment: Deployment = {
          ...createDeployment({
            runId: 'run_1',
            tenantId: 'tenant_1',
            environment: 'staging',
            deployedBy: 'user_1',
          }),
          deployedAt: '2025-01-15T10:00:00.000Z',
          completedAt: '2025-01-15T10:01:30.000Z',
        }

        const duration = calculateDeploymentDuration(deployment)

        expect(duration).toBe(90000) // 90 seconds
      })

      it('should return null for incomplete deployment', () => {
        const deployment = createDeployment({
          runId: 'run_1',
          tenantId: 'tenant_1',
          environment: 'staging',
          deployedBy: 'user_1',
        })

        const duration = calculateDeploymentDuration(deployment)

        expect(duration).toBeNull()
      })
    })

    describe('formatDeploymentDuration', () => {
      it('should format milliseconds', () => {
        expect(formatDeploymentDuration(500)).toBe('500ms')
      })

      it('should format seconds', () => {
        expect(formatDeploymentDuration(5000)).toBe('5秒')
      })

      it('should format minutes', () => {
        expect(formatDeploymentDuration(90000)).toBe('1分30秒')
      })
    })
  })
})
