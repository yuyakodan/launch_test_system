/**
 * Creative Variant Management System
 * クリエイティブの生成・管理・承認
 */

// アスペクト比
export type AspectRatio = '1:1' | '4:5' | '9:16'

// サイズ定義
export interface CreativeSize {
  aspectRatio: AspectRatio
  width: number
  height: number
}

// 標準サイズ
export const STANDARD_SIZES: Record<AspectRatio, CreativeSize> = {
  '1:1': { aspectRatio: '1:1', width: 1080, height: 1080 },
  '4:5': { aspectRatio: '4:5', width: 1080, height: 1350 },
  '9:16': { aspectRatio: '9:16', width: 1080, height: 1920 },
}

// レイヤータイプ
export type LayerType = 'text' | 'image' | 'shape'

// レイヤー
export interface CreativeLayer {
  id: string
  type: LayerType
  content: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: LayerStyle
  visible: boolean
  locked: boolean
}

// レイヤースタイル
export interface LayerStyle {
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  color?: string
  backgroundColor?: string
  borderRadius?: number
  opacity?: number
  textAlign?: 'left' | 'center' | 'right'
}

// クリエイティブバリアント
export interface CreativeVariant {
  id: string
  runId: string
  tenantId: string
  name: string
  aspectRatio: AspectRatio
  width: number
  height: number
  assetUrl: string
  layers: CreativeLayer[]
  version: number
  status: 'draft' | 'submitted' | 'approved' | 'published'
  createdAt: string
  updatedAt: string
}

// 禁則ルール
export interface ProhibitionRule {
  id: string
  pattern: RegExp
  message: string
  severity: 'warning' | 'error'
}

// 禁則チェック結果
export interface ProhibitionCheckResult {
  passed: boolean
  violations: ProhibitionViolation[]
}

export interface ProhibitionViolation {
  ruleId: string
  message: string
  severity: 'warning' | 'error'
  layerId?: string
  matchedText: string
}

// デフォルト禁則ルール
export const DEFAULT_PROHIBITION_RULES: ProhibitionRule[] = [
  {
    id: 'ng_absolute_claims',
    pattern: /絶対|必ず|100%|確実/g,
    message: '断定的な表現は避けてください',
    severity: 'error',
  },
  {
    id: 'ng_superlative',
    pattern: /最高|最強|最安|業界No\.?1|ナンバーワン/g,
    message: '根拠のない最上級表現は避けてください',
    severity: 'error',
  },
  {
    id: 'ng_urgent',
    pattern: /今だけ|期間限定|緊急|急げ|残りわずか/g,
    message: '過度な緊急性を煽る表現は注意が必要です',
    severity: 'warning',
  },
  {
    id: 'ng_free',
    pattern: /無料|タダ|0円/g,
    message: '「無料」表現は条件を明記してください',
    severity: 'warning',
  },
]

/**
 * クリエイティブIDを生成
 */
export function generateCreativeId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `creative_${timestamp}_${random}`
}

/**
 * レイヤーIDを生成
 */
export function generateLayerId(): string {
  return `layer_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
}

/**
 * クリエイティブバリアントを作成
 */
export function createCreativeVariant(
  runId: string,
  tenantId: string,
  name: string,
  aspectRatio: AspectRatio
): CreativeVariant {
  const size = STANDARD_SIZES[aspectRatio]
  const now = new Date().toISOString()

  return {
    id: generateCreativeId(),
    runId,
    tenantId,
    name,
    aspectRatio,
    width: size.width,
    height: size.height,
    assetUrl: '',
    layers: [],
    version: 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 必須サイズのバリアントを一括作成
 */
export function createRequiredVariants(
  runId: string,
  tenantId: string,
  baseName: string
): CreativeVariant[] {
  const requiredRatios: AspectRatio[] = ['1:1', '4:5', '9:16']

  return requiredRatios.map((ratio) =>
    createCreativeVariant(runId, tenantId, `${baseName} (${ratio})`, ratio)
  )
}

/**
 * テキストレイヤーを作成
 */
export function createTextLayer(
  content: string,
  x: number,
  y: number,
  style?: Partial<LayerStyle>
): CreativeLayer {
  return {
    id: generateLayerId(),
    type: 'text',
    content,
    position: { x, y },
    size: { width: 200, height: 50 },
    style: {
      fontSize: 24,
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
      color: '#000000',
      textAlign: 'left',
      ...style,
    },
    visible: true,
    locked: false,
  }
}

/**
 * 画像レイヤーを作成
 */
export function createImageLayer(
  assetUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): CreativeLayer {
  return {
    id: generateLayerId(),
    type: 'image',
    content: assetUrl,
    position: { x, y },
    size: { width, height },
    style: {},
    visible: true,
    locked: false,
  }
}

/**
 * レイヤーを追加
 */
export function addLayer(
  variant: CreativeVariant,
  layer: CreativeLayer
): CreativeVariant {
  return {
    ...variant,
    layers: [...variant.layers, layer],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * レイヤーを更新
 */
export function updateLayer(
  variant: CreativeVariant,
  layerId: string,
  updates: Partial<Omit<CreativeLayer, 'id' | 'type'>>
): CreativeVariant {
  return {
    ...variant,
    layers: variant.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    ),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * レイヤーを削除
 */
export function removeLayer(
  variant: CreativeVariant,
  layerId: string
): CreativeVariant {
  return {
    ...variant,
    layers: variant.layers.filter((layer) => layer.id !== layerId),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * テキストレイヤーの内容を差し替え
 */
export function replaceTextContent(
  variant: CreativeVariant,
  layerId: string,
  newContent: string
): CreativeVariant {
  return updateLayer(variant, layerId, { content: newContent })
}

/**
 * 禁則チェックを実行
 */
export function checkProhibitions(
  variant: CreativeVariant,
  rules: ProhibitionRule[] = DEFAULT_PROHIBITION_RULES
): ProhibitionCheckResult {
  const violations: ProhibitionViolation[] = []

  // テキストレイヤーをチェック
  for (const layer of variant.layers) {
    if (layer.type !== 'text') continue

    for (const rule of rules) {
      const matches = layer.content.match(rule.pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            ruleId: rule.id,
            message: rule.message,
            severity: rule.severity,
            layerId: layer.id,
            matchedText: match,
          })
        }
      }
    }
  }

  return {
    passed: violations.filter((v) => v.severity === 'error').length === 0,
    violations,
  }
}

/**
 * セーフエリア内かチェック
 */
export function isInSafeArea(
  layer: CreativeLayer,
  variant: CreativeVariant,
  safeMargin = 50
): boolean {
  const minX = safeMargin
  const minY = safeMargin
  const maxX = variant.width - safeMargin - layer.size.width
  const maxY = variant.height - safeMargin - layer.size.height

  return (
    layer.position.x >= minX &&
    layer.position.x <= maxX &&
    layer.position.y >= minY &&
    layer.position.y <= maxY
  )
}

/**
 * 全レイヤーがセーフエリア内かチェック
 */
export function checkSafeArea(
  variant: CreativeVariant,
  safeMargin = 50
): { passed: boolean; outOfBounds: string[] } {
  const outOfBounds: string[] = []

  for (const layer of variant.layers) {
    if (!isInSafeArea(layer, variant, safeMargin)) {
      outOfBounds.push(layer.id)
    }
  }

  return {
    passed: outOfBounds.length === 0,
    outOfBounds,
  }
}

/**
 * バリアントを複製（サイズ変更用）
 */
export function duplicateForSize(
  variant: CreativeVariant,
  targetRatio: AspectRatio
): CreativeVariant {
  const targetSize = STANDARD_SIZES[targetRatio]
  const scaleX = targetSize.width / variant.width
  const scaleY = targetSize.height / variant.height

  return {
    ...variant,
    id: generateCreativeId(),
    aspectRatio: targetRatio,
    width: targetSize.width,
    height: targetSize.height,
    layers: variant.layers.map((layer) => ({
      ...layer,
      id: generateLayerId(),
      position: {
        x: Math.round(layer.position.x * scaleX),
        y: Math.round(layer.position.y * scaleY),
      },
      size: {
        width: Math.round(layer.size.width * scaleX),
        height: Math.round(layer.size.height * scaleY),
      },
    })),
    version: 1,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * アスペクト比のラベルを取得
 */
export function getAspectRatioLabel(ratio: AspectRatio): string {
  const labels: Record<AspectRatio, string> = {
    '1:1': '正方形（1:1）',
    '4:5': '縦長（4:5）',
    '9:16': 'ストーリー（9:16）',
  }
  return labels[ratio]
}
