import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  parsePermission,
  getPermissionsForRole,
  mergePermissions,
  ROLE_PERMISSIONS,
  ENFORCEMENT_RULES,
  type Permission,
  type RoleName,
} from '../../src/auth/permissions'

describe('Permission System', () => {
  describe('parsePermission', () => {
    it('should parse resource:action format', () => {
      const result = parsePermission('run:create')
      expect(result).toEqual({ resource: 'run', action: 'create' })
    })

    it('should parse wildcard action', () => {
      const result = parsePermission('run:*')
      expect(result).toEqual({ resource: 'run', action: '*' })
    })

    it('should parse global wildcard', () => {
      const result = parsePermission('*')
      expect(result).toEqual({ resource: '*', action: '*' })
    })
  })

  describe('hasPermission', () => {
    it('should allow action when permission matches exactly', () => {
      const permissions: Permission[] = ['run:create', 'run:read']
      expect(hasPermission(permissions, 'run', 'create')).toBe(true)
      expect(hasPermission(permissions, 'run', 'read')).toBe(true)
    })

    it('should deny action when permission does not match', () => {
      const permissions: Permission[] = ['run:read']
      expect(hasPermission(permissions, 'run', 'create')).toBe(false)
      expect(hasPermission(permissions, 'run', 'delete')).toBe(false)
    })

    it('should allow all actions with wildcard action', () => {
      const permissions: Permission[] = ['run:*']
      expect(hasPermission(permissions, 'run', 'create')).toBe(true)
      expect(hasPermission(permissions, 'run', 'read')).toBe(true)
      expect(hasPermission(permissions, 'run', 'update')).toBe(true)
      expect(hasPermission(permissions, 'run', 'delete')).toBe(true)
    })

    it('should allow all resources with global wildcard', () => {
      const permissions: Permission[] = ['*']
      expect(hasPermission(permissions, 'run', 'create')).toBe(true)
      expect(hasPermission(permissions, 'tenant', 'delete')).toBe(true)
      expect(hasPermission(permissions, 'billing', 'update')).toBe(true)
    })

    it('should deny access to different resource', () => {
      const permissions: Permission[] = ['run:*']
      expect(hasPermission(permissions, 'tenant', 'read')).toBe(false)
    })
  })

  describe('getPermissionsForRole', () => {
    it('should return permissions for tenant_owner', () => {
      const permissions = getPermissionsForRole('tenant_owner')
      expect(permissions).toContain('*')
    })

    it('should return permissions for operator', () => {
      const permissions = getPermissionsForRole('operator')
      expect(permissions).toContain('run:*')
      expect(permissions).toContain('deployment:*')
      expect(permissions).not.toContain('*')
    })

    it('should return permissions for reviewer', () => {
      const permissions = getPermissionsForRole('reviewer')
      expect(permissions).toContain('approval:*')
      expect(permissions).toContain('run:read')
      expect(permissions).not.toContain('run:*')
    })

    it('should return permissions for viewer', () => {
      const permissions = getPermissionsForRole('viewer')
      expect(permissions).toContain('run:read')
      expect(permissions).not.toContain('run:create')
      expect(permissions).not.toContain('approval:*')
    })
  })

  describe('mergePermissions', () => {
    it('should merge permissions from multiple roles', () => {
      const merged = mergePermissions(['reviewer', 'viewer'])
      expect(merged).toContain('approval:*')
      expect(merged).toContain('run:read')
    })

    it('should deduplicate permissions', () => {
      const merged = mergePermissions(['operator', 'operator'])
      const unique = [...new Set(merged)]
      expect(merged.length).toBe(unique.length)
    })
  })

  describe('ROLE_PERMISSIONS', () => {
    it('should define all required roles', () => {
      const requiredRoles: RoleName[] = ['tenant_owner', 'operator', 'reviewer', 'viewer']
      for (const role of requiredRoles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined()
      }
    })

    it('should have tenant_owner with full access', () => {
      expect(ROLE_PERMISSIONS.tenant_owner).toContain('*')
    })
  })

  describe('ENFORCEMENT_RULES', () => {
    it('should enforce approval before run start', () => {
      expect(ENFORCEMENT_RULES.RUN_REQUIRES_APPROVAL).toBe(true)
    })

    it('should enforce budget on adset', () => {
      expect(ENFORCEMENT_RULES.ADSET_REQUIRES_BUDGET).toBe(true)
    })

    it('should enforce audit logging', () => {
      expect(ENFORCEMENT_RULES.AUDIT_LOG_REQUIRED).toBe(true)
    })
  })
})

describe('Role-based Access Control Scenarios', () => {
  describe('Tenant Owner', () => {
    const ownerPermissions = getPermissionsForRole('tenant_owner')

    it('can manage billing', () => {
      expect(hasPermission(ownerPermissions, 'billing', 'update')).toBe(true)
    })

    it('can view audit logs', () => {
      expect(hasPermission(ownerPermissions, 'audit', 'read')).toBe(true)
    })

    it('can approve runs', () => {
      expect(hasPermission(ownerPermissions, 'approval', 'create')).toBe(true)
    })
  })

  describe('Operator', () => {
    const operatorPermissions = getPermissionsForRole('operator')

    it('can create runs', () => {
      expect(hasPermission(operatorPermissions, 'run', 'create')).toBe(true)
    })

    it('can deploy', () => {
      expect(hasPermission(operatorPermissions, 'deployment', 'create')).toBe(true)
    })

    it('cannot manage billing', () => {
      expect(hasPermission(operatorPermissions, 'billing', 'update')).toBe(false)
    })

    it('cannot view audit logs', () => {
      expect(hasPermission(operatorPermissions, 'audit', 'read')).toBe(false)
    })
  })

  describe('Reviewer', () => {
    const reviewerPermissions = getPermissionsForRole('reviewer')

    it('can approve', () => {
      expect(hasPermission(reviewerPermissions, 'approval', 'create')).toBe(true)
    })

    it('can read runs', () => {
      expect(hasPermission(reviewerPermissions, 'run', 'read')).toBe(true)
    })

    it('cannot create runs', () => {
      expect(hasPermission(reviewerPermissions, 'run', 'create')).toBe(false)
    })

    it('cannot deploy', () => {
      expect(hasPermission(reviewerPermissions, 'deployment', 'create')).toBe(false)
    })
  })

  describe('Viewer', () => {
    const viewerPermissions = getPermissionsForRole('viewer')

    it('can read reports', () => {
      expect(hasPermission(viewerPermissions, 'report', 'read')).toBe(true)
    })

    it('cannot create anything', () => {
      expect(hasPermission(viewerPermissions, 'run', 'create')).toBe(false)
      expect(hasPermission(viewerPermissions, 'variant', 'create')).toBe(false)
    })

    it('cannot approve', () => {
      expect(hasPermission(viewerPermissions, 'approval', 'create')).toBe(false)
    })
  })
})
