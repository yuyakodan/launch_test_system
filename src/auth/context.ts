/**
 * Authentication Context
 * リクエストごとの認証コンテキスト
 */

import type { Permission, RoleName, Resource, Action } from './permissions'
import { hasPermission, getPermissionsForRole } from './permissions'

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

export interface AuthTenant {
  id: string
  name: string
  plan: string
}

export interface AuthContext {
  user: AuthUser
  tenant: AuthTenant
  role: RoleName
  permissions: Permission[]
}

/**
 * 認証コンテキストを作成
 */
export function createAuthContext(
  user: AuthUser,
  tenant: AuthTenant,
  role: RoleName
): AuthContext {
  return {
    user,
    tenant,
    role,
    permissions: getPermissionsForRole(role),
  }
}

/**
 * 権限チェック関数
 */
export function checkPermission(
  ctx: AuthContext,
  resource: Resource,
  action: Action
): boolean {
  return hasPermission(ctx.permissions, resource, action)
}

/**
 * 権限チェックを行い、不足している場合はエラーをスロー
 */
export function requirePermission(
  ctx: AuthContext,
  resource: Resource,
  action: Action
): void {
  if (!checkPermission(ctx, resource, action)) {
    throw new PermissionDeniedError(
      `Permission denied: ${resource}:${action}`,
      resource,
      action,
      ctx.role
    )
  }
}

/**
 * 権限不足エラー
 */
export class PermissionDeniedError extends Error {
  public readonly resource: Resource
  public readonly action: Action
  public readonly role: RoleName

  constructor(message: string, resource: Resource, action: Action, role: RoleName) {
    super(message)
    this.name = 'PermissionDeniedError'
    this.resource = resource
    this.action = action
    this.role = role
  }
}

/**
 * テナントアクセス権チェック
 * ユーザーが指定されたテナントにアクセスできるかチェック
 */
export function checkTenantAccess(ctx: AuthContext, targetTenantId: string): boolean {
  return ctx.tenant.id === targetTenantId
}

/**
 * テナントアクセス権を要求
 */
export function requireTenantAccess(ctx: AuthContext, targetTenantId: string): void {
  if (!checkTenantAccess(ctx, targetTenantId)) {
    throw new TenantAccessDeniedError(
      `Tenant access denied: ${targetTenantId}`,
      ctx.tenant.id,
      targetTenantId
    )
  }
}

/**
 * テナントアクセス拒否エラー
 */
export class TenantAccessDeniedError extends Error {
  public readonly userTenantId: string
  public readonly targetTenantId: string

  constructor(message: string, userTenantId: string, targetTenantId: string) {
    super(message)
    this.name = 'TenantAccessDeniedError'
    this.userTenantId = userTenantId
    this.targetTenantId = targetTenantId
  }
}
