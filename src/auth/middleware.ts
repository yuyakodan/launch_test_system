/**
 * Authentication Middleware
 * Hono用の認証ミドルウェア
 */

import type { Context, Next } from 'hono'
import type { AuthContext, AuthUser, AuthTenant } from './context'
import type { RoleName, Resource, Action } from './permissions'
import {
  createAuthContext,
  requirePermission,
  requireTenantAccess,
  PermissionDeniedError,
  TenantAccessDeniedError,
} from './context'

// 認証コンテキストを持つHonoコンテキスト
declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext
  }
}

/**
 * 認証ミドルウェア
 * JWTやセッションからユーザー情報を取得してコンテキストに設定
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    // Authorization ヘッダーからトークンを取得
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      // トークンを検証してユーザー情報を取得
      // TODO: 実際のJWT検証実装
      const decoded = await verifyToken(token)

      if (!decoded) {
        return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401)
      }

      // 認証コンテキストを作成
      const authContext = createAuthContext(
        decoded.user,
        decoded.tenant,
        decoded.role
      )

      // コンテキストに設定
      c.set('auth', authContext)

      await next()
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return c.json({ error: 'Unauthorized', message: 'Token expired' }, 401)
      }
      throw error
    }
  }
}

/**
 * 権限チェックミドルウェア
 */
export function requirePermissionMiddleware(resource: Resource, action: Action) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth) {
      return c.json({ error: 'Unauthorized', message: 'Not authenticated' }, 401)
    }

    try {
      requirePermission(auth, resource, action)
      await next()
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return c.json({
          error: 'Forbidden',
          message: error.message,
          resource: error.resource,
          action: error.action,
        }, 403)
      }
      throw error
    }
  }
}

/**
 * テナントアクセスチェックミドルウェア
 * パスパラメータからtenantIdを取得してチェック
 */
export function requireTenantAccessMiddleware(tenantIdParam = 'tenantId') {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth) {
      return c.json({ error: 'Unauthorized', message: 'Not authenticated' }, 401)
    }

    const targetTenantId = c.req.param(tenantIdParam)

    if (!targetTenantId) {
      return c.json({ error: 'Bad Request', message: `Missing ${tenantIdParam} parameter` }, 400)
    }

    try {
      requireTenantAccess(auth, targetTenantId)
      await next()
    } catch (error) {
      if (error instanceof TenantAccessDeniedError) {
        return c.json({
          error: 'Forbidden',
          message: 'Tenant access denied',
        }, 403)
      }
      throw error
    }
  }
}

/**
 * ロール制限ミドルウェア
 * 指定されたロールのみアクセスを許可
 */
export function requireRoleMiddleware(...allowedRoles: RoleName[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth) {
      return c.json({ error: 'Unauthorized', message: 'Not authenticated' }, 401)
    }

    if (!allowedRoles.includes(auth.role)) {
      return c.json({
        error: 'Forbidden',
        message: `Role '${auth.role}' is not allowed. Required: ${allowedRoles.join(', ')}`,
      }, 403)
    }

    await next()
  }
}

// ============================================
// Token Verification (Placeholder)
// ============================================

interface DecodedToken {
  user: AuthUser
  tenant: AuthTenant
  role: RoleName
  exp: number
}

class TokenExpiredError extends Error {
  constructor() {
    super('Token expired')
    this.name = 'TokenExpiredError'
  }
}

/**
 * トークンを検証（プレースホルダー実装）
 * TODO: 実際のJWT検証ロジックを実装
 */
async function verifyToken(token: string): Promise<DecodedToken | null> {
  // 開発用のモックトークン検証
  if (token.startsWith('dev_')) {
    const [, userId, tenantId, role] = token.split('_')

    return {
      user: {
        id: userId || 'user_1',
        email: 'dev@example.com',
        name: 'Dev User',
      },
      tenant: {
        id: tenantId || 'tenant_1',
        name: 'Dev Tenant',
        plan: 'standard',
      },
      role: (role as RoleName) || 'operator',
      exp: Date.now() + 3600000,
    }
  }

  // 本番ではJWT検証を行う
  // const payload = await jwt.verify(token, secret)
  // ...

  return null
}
