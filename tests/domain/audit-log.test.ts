import { describe, it, expect } from 'vitest'
import {
  generateAuditLogId,
  createAuditLogEntry,
  calculateDiff,
  getActionLabel,
  getTargetTypeLabel,
  generateAuditDescription,
  serializeForBackup,
  deserializeFromBackup,
  filterAuditLogs,
  paginateAuditLogs,
  isCriticalAction,
  calculateEntryHash,
  type AuditLogEntry,
  type CreateAuditLogRequest,
  type AuditLogSearchParams,
} from '../../src/domain/audit-log'

describe('Audit Log System', () => {
  describe('generateAuditLogId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateAuditLogId()
      const id2 = generateAuditLogId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^audit_/)
    })
  })

  describe('createAuditLogEntry', () => {
    it('should create entry with all fields', () => {
      const request: CreateAuditLogRequest = {
        tenantId: 'tenant_123',
        userId: 'user_456',
        action: 'create',
        targetType: 'run',
        targetId: 'run_789',
        beforeState: null,
        afterState: { state: 'draft' },
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      }

      const entry = createAuditLogEntry(request)

      expect(entry.tenantId).toBe('tenant_123')
      expect(entry.userId).toBe('user_456')
      expect(entry.action).toBe('create')
      expect(entry.targetType).toBe('run')
      expect(entry.targetId).toBe('run_789')
      expect(entry.afterState).toEqual({ state: 'draft' })
      expect(entry.metadata.ipAddress).toBe('192.168.1.1')
      expect(entry.createdAt).toBeDefined()
    })

    it('should handle missing optional fields', () => {
      const request: CreateAuditLogRequest = {
        tenantId: 'tenant_123',
        action: 'read',
        targetType: 'project',
        targetId: 'project_1',
      }

      const entry = createAuditLogEntry(request)

      expect(entry.userId).toBeNull()
      expect(entry.beforeState).toBeNull()
      expect(entry.afterState).toBeNull()
    })
  })

  describe('calculateDiff', () => {
    it('should detect added fields', () => {
      const before = { a: 1 }
      const after = { a: 1, b: 2 }

      const diff = calculateDiff(before, after)

      expect(diff.b).toEqual({ before: undefined, after: 2 })
    })

    it('should detect removed fields', () => {
      const before = { a: 1, b: 2 }
      const after = { a: 1 }

      const diff = calculateDiff(before, after)

      expect(diff.b).toEqual({ before: 2, after: undefined })
    })

    it('should detect changed fields', () => {
      const before = { state: 'draft' }
      const after = { state: 'designing' }

      const diff = calculateDiff(before, after)

      expect(diff.state).toEqual({ before: 'draft', after: 'designing' })
    })

    it('should ignore unchanged fields', () => {
      const before = { a: 1, b: 2 }
      const after = { a: 1, b: 2 }

      const diff = calculateDiff(before, after)

      expect(Object.keys(diff)).toHaveLength(0)
    })

    it('should handle null states', () => {
      expect(calculateDiff(null, null)).toEqual({})
      expect(calculateDiff(null, { a: 1 })).toEqual({ a: { before: undefined, after: 1 } })
      expect(calculateDiff({ a: 1 }, null)).toEqual({ a: { before: 1, after: undefined } })
    })
  })

  describe('getActionLabel', () => {
    it('should return Japanese labels', () => {
      expect(getActionLabel('create')).toBe('作成')
      expect(getActionLabel('update')).toBe('更新')
      expect(getActionLabel('delete')).toBe('削除')
      expect(getActionLabel('approve')).toBe('承認')
      expect(getActionLabel('start')).toBe('開始')
    })
  })

  describe('getTargetTypeLabel', () => {
    it('should return Japanese labels', () => {
      expect(getTargetTypeLabel('run')).toBe('Run')
      expect(getTargetTypeLabel('variant_lp')).toBe('LPバリアント')
      expect(getTargetTypeLabel('approval')).toBe('承認')
    })
  })

  describe('generateAuditDescription', () => {
    it('should generate readable description', () => {
      const entry: AuditLogEntry = {
        id: 'audit_1',
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'create',
        targetType: 'run',
        targetId: 'run_123',
        beforeState: null,
        afterState: null,
        metadata: {},
        createdAt: new Date().toISOString(),
      }

      const description = generateAuditDescription(entry)

      expect(description).toBe('Run（run_123）を作成しました')
    })
  })

  describe('serializeForBackup / deserializeFromBackup', () => {
    it('should serialize and deserialize correctly', () => {
      const entries: AuditLogEntry[] = [
        {
          id: 'audit_1',
          tenantId: 'tenant_1',
          userId: 'user_1',
          action: 'create',
          targetType: 'run',
          targetId: 'run_1',
          beforeState: null,
          afterState: { state: 'draft' },
          metadata: {},
          createdAt: '2026-01-13T00:00:00Z',
        },
        {
          id: 'audit_2',
          tenantId: 'tenant_1',
          userId: 'user_1',
          action: 'update',
          targetType: 'run',
          targetId: 'run_1',
          beforeState: { state: 'draft' },
          afterState: { state: 'designing' },
          metadata: {},
          createdAt: '2026-01-13T01:00:00Z',
        },
      ]

      const serialized = serializeForBackup(entries)
      const deserialized = deserializeFromBackup(serialized)

      expect(deserialized).toHaveLength(2)
      expect(deserialized[0].id).toBe('audit_1')
      expect(deserialized[1].action).toBe('update')
    })
  })

  describe('filterAuditLogs', () => {
    const createEntry = (
      overrides: Partial<AuditLogEntry> = {}
    ): AuditLogEntry => ({
      id: 'audit_1',
      tenantId: 'tenant_1',
      userId: 'user_1',
      action: 'create',
      targetType: 'run',
      targetId: 'run_1',
      beforeState: null,
      afterState: null,
      metadata: {},
      createdAt: '2026-01-13T12:00:00Z',
      ...overrides,
    })

    it('should filter by tenant ID', () => {
      const entries = [
        createEntry({ tenantId: 'tenant_1' }),
        createEntry({ id: 'audit_2', tenantId: 'tenant_2' }),
      ]

      const params: AuditLogSearchParams = { tenantId: 'tenant_1' }
      const filtered = filterAuditLogs(entries, params)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].tenantId).toBe('tenant_1')
    })

    it('should filter by user ID', () => {
      const entries = [
        createEntry({ userId: 'user_1' }),
        createEntry({ id: 'audit_2', userId: 'user_2' }),
      ]

      const params: AuditLogSearchParams = { tenantId: 'tenant_1', userId: 'user_1' }
      const filtered = filterAuditLogs(entries, params)

      expect(filtered).toHaveLength(1)
    })

    it('should filter by action', () => {
      const entries = [
        createEntry({ action: 'create' }),
        createEntry({ id: 'audit_2', action: 'update' }),
      ]

      const params: AuditLogSearchParams = { tenantId: 'tenant_1', action: 'create' }
      const filtered = filterAuditLogs(entries, params)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].action).toBe('create')
    })

    it('should filter by date range', () => {
      const entries = [
        createEntry({ createdAt: '2026-01-10T12:00:00Z' }),
        createEntry({ id: 'audit_2', createdAt: '2026-01-13T12:00:00Z' }),
        createEntry({ id: 'audit_3', createdAt: '2026-01-15T12:00:00Z' }),
      ]

      const params: AuditLogSearchParams = {
        tenantId: 'tenant_1',
        startDate: '2026-01-12T00:00:00Z',
        endDate: '2026-01-14T00:00:00Z',
      }
      const filtered = filterAuditLogs(entries, params)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('audit_2')
    })
  })

  describe('paginateAuditLogs', () => {
    const entries: AuditLogEntry[] = Array.from({ length: 100 }, (_, i) => ({
      id: `audit_${i}`,
      tenantId: 'tenant_1',
      userId: 'user_1',
      action: 'read' as const,
      targetType: 'run' as const,
      targetId: 'run_1',
      beforeState: null,
      afterState: null,
      metadata: {},
      createdAt: new Date().toISOString(),
    }))

    it('should paginate correctly', () => {
      const result = paginateAuditLogs(entries, 10, 0)

      expect(result.entries).toHaveLength(10)
      expect(result.total).toBe(100)
      expect(result.hasMore).toBe(true)
    })

    it('should handle last page', () => {
      const result = paginateAuditLogs(entries, 10, 95)

      expect(result.entries).toHaveLength(5)
      expect(result.hasMore).toBe(false)
    })

    it('should use default limit', () => {
      const result = paginateAuditLogs(entries)

      expect(result.entries).toHaveLength(50)
    })
  })

  describe('isCriticalAction', () => {
    it('should identify critical actions', () => {
      expect(isCriticalAction('delete')).toBe(true)
      expect(isCriticalAction('approve')).toBe(true)
      expect(isCriticalAction('start')).toBe(true)
      expect(isCriticalAction('stop')).toBe(true)
      expect(isCriticalAction('publish')).toBe(true)
    })

    it('should identify non-critical actions', () => {
      expect(isCriticalAction('create')).toBe(false)
      expect(isCriticalAction('read')).toBe(false)
      expect(isCriticalAction('update')).toBe(false)
    })
  })

  describe('calculateEntryHash', () => {
    it('should generate consistent hash', () => {
      const entry: AuditLogEntry = {
        id: 'audit_1',
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'create',
        targetType: 'run',
        targetId: 'run_1',
        beforeState: null,
        afterState: null,
        metadata: {},
        createdAt: '2026-01-13T00:00:00Z',
      }

      const hash1 = calculateEntryHash(entry)
      const hash2 = calculateEntryHash(entry)

      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different entries', () => {
      const entry1: AuditLogEntry = {
        id: 'audit_1',
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'create',
        targetType: 'run',
        targetId: 'run_1',
        beforeState: null,
        afterState: null,
        metadata: {},
        createdAt: '2026-01-13T00:00:00Z',
      }

      const entry2: AuditLogEntry = {
        ...entry1,
        id: 'audit_2',
      }

      expect(calculateEntryHash(entry1)).not.toBe(calculateEntryHash(entry2))
    })
  })
})
