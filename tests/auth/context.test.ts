import { describe, it, expect } from 'vitest'
import {
  createAuthContext,
  checkPermission,
  requirePermission,
  checkTenantAccess,
  requireTenantAccess,
  PermissionDeniedError,
  TenantAccessDeniedError,
  type AuthUser,
  type AuthTenant,
  type AuthContext,
} from '../../src/auth/context'

describe('Auth Context', () => {
  const mockUser: AuthUser = {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
  }

  const mockTenant: AuthTenant = {
    id: 'tenant_456',
    name: 'Test Tenant',
    plan: 'standard',
  }

  describe('createAuthContext', () => {
    it('should create context with correct permissions for operator', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(ctx.user).toEqual(mockUser)
      expect(ctx.tenant).toEqual(mockTenant)
      expect(ctx.role).toBe('operator')
      expect(ctx.permissions).toContain('run:*')
    })

    it('should create context with correct permissions for tenant_owner', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'tenant_owner')

      expect(ctx.permissions).toContain('*')
    })

    it('should create context with correct permissions for viewer', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'viewer')

      expect(ctx.permissions).toContain('run:read')
      expect(ctx.permissions).not.toContain('run:*')
    })
  })

  describe('checkPermission', () => {
    it('should return true for allowed permission', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(checkPermission(ctx, 'run', 'create')).toBe(true)
      expect(checkPermission(ctx, 'deployment', 'create')).toBe(true)
    })

    it('should return false for disallowed permission', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(checkPermission(ctx, 'billing', 'update')).toBe(false)
    })

    it('should return true for any permission with tenant_owner', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'tenant_owner')

      expect(checkPermission(ctx, 'billing', 'update')).toBe(true)
      expect(checkPermission(ctx, 'audit', 'read')).toBe(true)
    })
  })

  describe('requirePermission', () => {
    it('should not throw for allowed permission', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(() => requirePermission(ctx, 'run', 'create')).not.toThrow()
    })

    it('should throw PermissionDeniedError for disallowed permission', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'viewer')

      expect(() => requirePermission(ctx, 'run', 'create')).toThrow(PermissionDeniedError)
    })

    it('should include details in PermissionDeniedError', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'viewer')

      try {
        requirePermission(ctx, 'run', 'create')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError)
        const permError = error as PermissionDeniedError
        expect(permError.resource).toBe('run')
        expect(permError.action).toBe('create')
        expect(permError.role).toBe('viewer')
      }
    })
  })

  describe('checkTenantAccess', () => {
    it('should return true for matching tenant', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(checkTenantAccess(ctx, 'tenant_456')).toBe(true)
    })

    it('should return false for different tenant', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(checkTenantAccess(ctx, 'tenant_other')).toBe(false)
    })
  })

  describe('requireTenantAccess', () => {
    it('should not throw for matching tenant', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(() => requireTenantAccess(ctx, 'tenant_456')).not.toThrow()
    })

    it('should throw TenantAccessDeniedError for different tenant', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      expect(() => requireTenantAccess(ctx, 'tenant_other')).toThrow(TenantAccessDeniedError)
    })

    it('should include details in TenantAccessDeniedError', () => {
      const ctx = createAuthContext(mockUser, mockTenant, 'operator')

      try {
        requireTenantAccess(ctx, 'tenant_other')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(TenantAccessDeniedError)
        const tenantError = error as TenantAccessDeniedError
        expect(tenantError.userTenantId).toBe('tenant_456')
        expect(tenantError.targetTenantId).toBe('tenant_other')
      }
    })
  })
})

describe('RBAC Enforcement Scenarios', () => {
  const user: AuthUser = {
    id: 'user_1',
    email: 'user@example.com',
    name: 'User',
  }

  const tenant: AuthTenant = {
    id: 'tenant_1',
    name: 'Tenant',
    plan: 'standard',
  }

  it('should prevent viewer from creating runs', () => {
    const ctx = createAuthContext(user, tenant, 'viewer')

    expect(() => requirePermission(ctx, 'run', 'create')).toThrow(PermissionDeniedError)
  })

  it('should prevent operator from managing billing', () => {
    const ctx = createAuthContext(user, tenant, 'operator')

    expect(() => requirePermission(ctx, 'billing', 'update')).toThrow(PermissionDeniedError)
  })

  it('should allow reviewer to approve', () => {
    const ctx = createAuthContext(user, tenant, 'reviewer')

    expect(() => requirePermission(ctx, 'approval', 'create')).not.toThrow()
  })

  it('should allow tenant_owner full access', () => {
    const ctx = createAuthContext(user, tenant, 'tenant_owner')

    expect(() => requirePermission(ctx, 'billing', 'update')).not.toThrow()
    expect(() => requirePermission(ctx, 'audit', 'read')).not.toThrow()
    expect(() => requirePermission(ctx, 'run', 'delete')).not.toThrow()
  })

  it('should enforce tenant isolation', () => {
    const ctx = createAuthContext(user, tenant, 'tenant_owner')

    // Even tenant_owner cannot access other tenants
    expect(checkTenantAccess(ctx, 'other_tenant')).toBe(false)
  })
})
