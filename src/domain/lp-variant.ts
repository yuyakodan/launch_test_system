/**
 * LP Variant Management System
 * LPの生成・編集・版管理
 */

// LPセクションタイプ
export type LPSectionType =
  | 'hero'
  | 'benefits'
  | 'features'
  | 'testimonials'
  | 'cta'
  | 'faq'
  | 'pricing'
  | 'footer'

// LPセクション
export interface LPSection {
  id: string
  type: LPSectionType
  order: number
  content: Record<string, unknown>
  style?: Record<string, unknown>
}

// LP構成
export interface LPContent {
  sections: LPSection[]
  globalStyle?: Record<string, unknown>
}

// バリアントステータス
export type VariantStatus = 'draft' | 'submitted' | 'approved' | 'published'

// LPバリアント
export interface LPVariant {
  id: string
  runId: string
  tenantId: string
  name: string
  appealAxis: string
  structureType: string
  content: LPContent
  version: number
  status: VariantStatus
  publicUrl: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

// バリアント作成リクエスト
export interface CreateLPVariantRequest {
  runId: string
  tenantId: string
  name: string
  appealAxis: string
  structureType: string
  content?: LPContent
}

// 版管理エントリ
export interface VersionEntry {
  version: number
  content: LPContent
  status: VariantStatus
  createdAt: string
  createdBy: string
  comment?: string
}

/**
 * バリアントIDを生成
 */
export function generateVariantId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `lp_${timestamp}_${random}`
}

/**
 * セクションIDを生成
 */
export function generateSectionId(): string {
  return `section_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
}

/**
 * デフォルトのLP構成を作成
 */
export function createDefaultLPContent(): LPContent {
  return {
    sections: [
      {
        id: generateSectionId(),
        type: 'hero',
        order: 0,
        content: {
          headline: '',
          subheadline: '',
          ctaText: '',
          backgroundImage: '',
        },
      },
      {
        id: generateSectionId(),
        type: 'benefits',
        order: 1,
        content: {
          title: '',
          items: [],
        },
      },
      {
        id: generateSectionId(),
        type: 'cta',
        order: 2,
        content: {
          headline: '',
          buttonText: '',
          buttonUrl: '',
        },
      },
    ],
  }
}

/**
 * LPバリアントを作成
 */
export function createLPVariant(request: CreateLPVariantRequest): LPVariant {
  const now = new Date().toISOString()

  return {
    id: generateVariantId(),
    runId: request.runId,
    tenantId: request.tenantId,
    name: request.name,
    appealAxis: request.appealAxis,
    structureType: request.structureType,
    content: request.content || createDefaultLPContent(),
    version: 1,
    status: 'draft',
    publicUrl: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * セクションを追加
 */
export function addSection(
  content: LPContent,
  section: Omit<LPSection, 'order'>
): LPContent {
  const maxOrder = Math.max(...content.sections.map((s) => s.order), -1)

  return {
    ...content,
    sections: [
      ...content.sections,
      { ...section, order: maxOrder + 1 },
    ],
  }
}

/**
 * セクションを更新
 */
export function updateSection(
  content: LPContent,
  sectionId: string,
  updates: Partial<Omit<LPSection, 'id'>>
): LPContent {
  return {
    ...content,
    sections: content.sections.map((section) =>
      section.id === sectionId
        ? { ...section, ...updates }
        : section
    ),
  }
}

/**
 * セクションを削除
 */
export function removeSection(content: LPContent, sectionId: string): LPContent {
  return {
    ...content,
    sections: content.sections.filter((s) => s.id !== sectionId),
  }
}

/**
 * セクションを並べ替え
 */
export function reorderSections(content: LPContent, sectionIds: string[]): LPContent {
  const sectionMap = new Map(content.sections.map((s) => [s.id, s]))

  return {
    ...content,
    sections: sectionIds
      .map((id, index) => {
        const section = sectionMap.get(id)
        return section ? { ...section, order: index } : null
      })
      .filter((s): s is LPSection => s !== null),
  }
}

/**
 * ステータスを更新可能かチェック
 */
export function canTransitionStatus(
  current: VariantStatus,
  target: VariantStatus
): boolean {
  const transitions: Record<VariantStatus, VariantStatus[]> = {
    draft: ['submitted'],
    submitted: ['approved', 'draft'],
    approved: ['published', 'draft'],
    published: ['draft'],
  }

  return transitions[current]?.includes(target) ?? false
}

/**
 * ステータスを更新
 */
export function updateStatus(
  variant: LPVariant,
  newStatus: VariantStatus
): LPVariant {
  if (!canTransitionStatus(variant.status, newStatus)) {
    throw new Error(
      `Cannot transition from '${variant.status}' to '${newStatus}'`
    )
  }

  return {
    ...variant,
    status: newStatus,
    publishedAt: newStatus === 'published' ? new Date().toISOString() : variant.publishedAt,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 新しいバージョンを作成
 */
export function createNewVersion(
  variant: LPVariant,
  content: LPContent
): LPVariant {
  return {
    ...variant,
    content,
    version: variant.version + 1,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * バリアントをHTMLにエクスポート
 */
export function exportToHTML(variant: LPVariant): string {
  const sections = variant.content.sections
    .sort((a, b) => a.order - b.order)
    .map((section) => renderSection(section))
    .join('\n')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(variant.name)}</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; }
    .section { padding: 40px 20px; }
  </style>
</head>
<body>
${sections}
</body>
</html>`
}

/**
 * セクションをHTMLに変換
 */
function renderSection(section: LPSection): string {
  const content = section.content as Record<string, string>

  switch (section.type) {
    case 'hero':
      return `<section class="section hero">
  <h1>${escapeHtml(content.headline || '')}</h1>
  <p>${escapeHtml(content.subheadline || '')}</p>
  <a href="#">${escapeHtml(content.ctaText || '')}</a>
</section>`

    case 'benefits':
      return `<section class="section benefits">
  <h2>${escapeHtml(content.title || '')}</h2>
</section>`

    case 'cta':
      return `<section class="section cta">
  <h2>${escapeHtml(content.headline || '')}</h2>
  <a href="${escapeHtml(content.buttonUrl || '#')}">${escapeHtml(content.buttonText || '')}</a>
</section>`

    default:
      return `<section class="section ${section.type}"></section>`
  }
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * バリアントをJSONにエクスポート
 */
export function exportToJSON(variant: LPVariant): string {
  return JSON.stringify({
    id: variant.id,
    name: variant.name,
    appealAxis: variant.appealAxis,
    structureType: variant.structureType,
    content: variant.content,
    version: variant.version,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

/**
 * バリアントを比較して差分を取得
 */
export function compareVariants(
  v1: LPVariant,
  v2: LPVariant
): { added: string[]; removed: string[]; modified: string[] } {
  const s1Ids = new Set(v1.content.sections.map((s) => s.id))
  const s2Ids = new Set(v2.content.sections.map((s) => s.id))

  const added = [...s2Ids].filter((id) => !s1Ids.has(id))
  const removed = [...s1Ids].filter((id) => !s2Ids.has(id))

  const modified: string[] = []
  for (const id of s1Ids) {
    if (s2Ids.has(id)) {
      const section1 = v1.content.sections.find((s) => s.id === id)
      const section2 = v2.content.sections.find((s) => s.id === id)
      if (JSON.stringify(section1) !== JSON.stringify(section2)) {
        modified.push(id)
      }
    }
  }

  return { added, removed, modified }
}

/**
 * ステータスのラベルを取得
 */
export function getStatusLabel(status: VariantStatus): string {
  const labels: Record<VariantStatus, string> = {
    draft: '下書き',
    submitted: '提出済み',
    approved: '承認済み',
    published: '公開済み',
  }
  return labels[status]
}
