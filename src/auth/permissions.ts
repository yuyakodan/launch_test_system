/**
 * RBAC Permission System
 * ロールベースアクセス制御の権限定義
 */

// 権限アクション
export type Action = 'create' | 'read' | 'update' | 'delete' | '*'

// リソースタイプ
export type Resource =
  | 'tenant'
  | 'user'
  | 'project'
  | 'run'
  | 'variant'
  | 'approval'
  | 'deployment'
  | 'meta'
  | 'report'
  | 'audit'
  | 'notification'
  | 'billing'

// 権限文字列: "resource:action" 形式
export type Permission = `${Resource}:${Action}` | '*'

// ロール名
export type RoleName = 'tenant_owner' | 'operator' | 'reviewer' | 'viewer'

// ロールごとの権限定義
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  tenant_owner: ['*'], // 全権限

  operator: [
    'project:read',
    'run:*',
    'variant:*',
    'deployment:*',
    'meta:*',
    'report:read',
    'notification:read',
  ],

  reviewer: [
    'project:read',
    'run:read',
    'variant:read',
    'approval:*',
    'report:read',
  ],

  viewer: [
    'project:read',
    'run:read',
    'variant:read',
    'report:read',
  ],
}

/**
 * 権限をパースして resource と action に分解
 */
export function parsePermission(permission: Permission): { resource: Resource | '*'; action: Action } {
  if (permission === '*') {
    return { resource: '*', action: '*' }
  }

  const [resource, action] = permission.split(':') as [Resource, Action]
  return { resource, action }
}

/**
 * 指定された権限が許可されているかチェック
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredResource: Resource,
  requiredAction: Action
): boolean {
  // 全権限を持っている場合
  if (userPermissions.includes('*')) {
    return true
  }

  for (const permission of userPermissions) {
    const { resource, action } = parsePermission(permission)

    // リソースが一致するかワイルドカード
    const resourceMatch = resource === '*' || resource === requiredResource

    // アクションが一致するかワイルドカード
    const actionMatch = action === '*' || action === requiredAction

    if (resourceMatch && actionMatch) {
      return true
    }
  }

  return false
}

/**
 * ロール名から権限リストを取得
 */
export function getPermissionsForRole(roleName: RoleName): Permission[] {
  return ROLE_PERMISSIONS[roleName] || []
}

/**
 * 複数のロールの権限をマージ
 */
export function mergePermissions(roleNames: RoleName[]): Permission[] {
  const permissions = new Set<Permission>()

  for (const roleName of roleNames) {
    const rolePermissions = getPermissionsForRole(roleName)
    for (const permission of rolePermissions) {
      permissions.add(permission)
    }
  }

  return Array.from(permissions)
}

// 強制ルール: 承認なしRunの配信禁止
export const ENFORCEMENT_RULES = {
  // Runを配信開始するには approved 状態が必要
  RUN_REQUIRES_APPROVAL: true,

  // Adsetには予算上限が必須
  ADSET_REQUIRES_BUDGET: true,

  // 全操作は監査ログ必須
  AUDIT_LOG_REQUIRED: true,
} as const
