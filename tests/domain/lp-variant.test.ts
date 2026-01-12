import { describe, it, expect } from 'vitest'
import {
  generateVariantId,
  generateSectionId,
  createDefaultLPContent,
  createLPVariant,
  addSection,
  updateSection,
  removeSection,
  reorderSections,
  canTransitionStatus,
  updateStatus,
  createNewVersion,
  exportToHTML,
  exportToJSON,
  compareVariants,
  getStatusLabel,
  type LPVariant,
  type LPContent,
  type CreateLPVariantRequest,
} from '../../src/domain/lp-variant'

describe('LP Variant Management', () => {
  describe('generateVariantId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateVariantId()
      const id2 = generateVariantId()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^lp_/)
    })
  })

  describe('createDefaultLPContent', () => {
    it('should create content with default sections', () => {
      const content = createDefaultLPContent()
      expect(content.sections).toHaveLength(3)
      expect(content.sections.map((s) => s.type)).toContain('hero')
      expect(content.sections.map((s) => s.type)).toContain('benefits')
      expect(content.sections.map((s) => s.type)).toContain('cta')
    })
  })

  describe('createLPVariant', () => {
    it('should create variant with default content', () => {
      const request: CreateLPVariantRequest = {
        runId: 'run_123',
        tenantId: 'tenant_456',
        name: 'Test LP',
        appealAxis: '価格訴求',
        structureType: 'standard',
      }

      const variant = createLPVariant(request)

      expect(variant.id).toMatch(/^lp_/)
      expect(variant.runId).toBe('run_123')
      expect(variant.name).toBe('Test LP')
      expect(variant.version).toBe(1)
      expect(variant.status).toBe('draft')
      expect(variant.content.sections).toHaveLength(3)
    })

    it('should create variant with custom content', () => {
      const customContent: LPContent = {
        sections: [
          { id: 'sec_1', type: 'hero', order: 0, content: { headline: 'Test' } },
        ],
      }

      const request: CreateLPVariantRequest = {
        runId: 'run_123',
        tenantId: 'tenant_456',
        name: 'Custom LP',
        appealAxis: '機能訴求',
        structureType: 'minimal',
        content: customContent,
      }

      const variant = createLPVariant(request)

      expect(variant.content.sections).toHaveLength(1)
      expect(variant.content.sections[0].content).toEqual({ headline: 'Test' })
    })
  })

  describe('Section Operations', () => {
    const baseContent: LPContent = {
      sections: [
        { id: 'sec_1', type: 'hero', order: 0, content: {} },
        { id: 'sec_2', type: 'cta', order: 1, content: {} },
      ],
    }

    describe('addSection', () => {
      it('should add section with correct order', () => {
        const newSection = { id: 'sec_3', type: 'benefits' as const, content: {} }
        const updated = addSection(baseContent, newSection)

        expect(updated.sections).toHaveLength(3)
        expect(updated.sections[2].order).toBe(2)
      })
    })

    describe('updateSection', () => {
      it('should update section content', () => {
        const updated = updateSection(baseContent, 'sec_1', {
          content: { headline: 'Updated' },
        })

        expect(updated.sections[0].content).toEqual({ headline: 'Updated' })
        expect(updated.sections[1]).toEqual(baseContent.sections[1])
      })
    })

    describe('removeSection', () => {
      it('should remove section by id', () => {
        const updated = removeSection(baseContent, 'sec_1')

        expect(updated.sections).toHaveLength(1)
        expect(updated.sections[0].id).toBe('sec_2')
      })
    })

    describe('reorderSections', () => {
      it('should reorder sections', () => {
        const updated = reorderSections(baseContent, ['sec_2', 'sec_1'])

        expect(updated.sections[0].id).toBe('sec_2')
        expect(updated.sections[0].order).toBe(0)
        expect(updated.sections[1].id).toBe('sec_1')
        expect(updated.sections[1].order).toBe(1)
      })
    })
  })

  describe('Status Transitions', () => {
    describe('canTransitionStatus', () => {
      it('should allow valid transitions', () => {
        expect(canTransitionStatus('draft', 'submitted')).toBe(true)
        expect(canTransitionStatus('submitted', 'approved')).toBe(true)
        expect(canTransitionStatus('approved', 'published')).toBe(true)
      })

      it('should reject invalid transitions', () => {
        expect(canTransitionStatus('draft', 'approved')).toBe(false)
        expect(canTransitionStatus('draft', 'published')).toBe(false)
      })

      it('should allow rollback to draft', () => {
        expect(canTransitionStatus('submitted', 'draft')).toBe(true)
        expect(canTransitionStatus('approved', 'draft')).toBe(true)
        expect(canTransitionStatus('published', 'draft')).toBe(true)
      })
    })

    describe('updateStatus', () => {
      const createVariant = (): LPVariant => ({
        id: 'lp_1',
        runId: 'run_1',
        tenantId: 'tenant_1',
        name: 'Test',
        appealAxis: 'test',
        structureType: 'standard',
        content: { sections: [] },
        version: 1,
        status: 'draft',
        publicUrl: null,
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      it('should update status', () => {
        const variant = createVariant()
        const updated = updateStatus(variant, 'submitted')

        expect(updated.status).toBe('submitted')
      })

      it('should set publishedAt when published', () => {
        const variant = { ...createVariant(), status: 'approved' as const }
        const updated = updateStatus(variant, 'published')

        expect(updated.status).toBe('published')
        expect(updated.publishedAt).not.toBeNull()
      })

      it('should throw for invalid transition', () => {
        const variant = createVariant()

        expect(() => updateStatus(variant, 'published')).toThrow()
      })
    })
  })

  describe('createNewVersion', () => {
    it('should increment version', () => {
      const variant: LPVariant = {
        id: 'lp_1',
        runId: 'run_1',
        tenantId: 'tenant_1',
        name: 'Test',
        appealAxis: 'test',
        structureType: 'standard',
        content: { sections: [] },
        version: 3,
        status: 'published',
        publicUrl: 'https://example.com',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const newContent: LPContent = {
        sections: [{ id: 'sec_new', type: 'hero', order: 0, content: {} }],
      }

      const newVersion = createNewVersion(variant, newContent)

      expect(newVersion.version).toBe(4)
      expect(newVersion.status).toBe('draft')
      expect(newVersion.content).toEqual(newContent)
    })
  })

  describe('Export Functions', () => {
    const variant: LPVariant = {
      id: 'lp_1',
      runId: 'run_1',
      tenantId: 'tenant_1',
      name: 'Test LP',
      appealAxis: 'test',
      structureType: 'standard',
      content: {
        sections: [
          {
            id: 'sec_1',
            type: 'hero',
            order: 0,
            content: { headline: 'Hello World', subheadline: 'Test', ctaText: 'Click' },
          },
        ],
      },
      version: 1,
      status: 'published',
      publicUrl: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    describe('exportToHTML', () => {
      it('should generate valid HTML', () => {
        const html = exportToHTML(variant)

        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<title>Test LP</title>')
        expect(html).toContain('Hello World')
      })

      it('should escape HTML characters', () => {
        const variantWithHtml: LPVariant = {
          ...variant,
          content: {
            sections: [
              {
                id: 'sec_1',
                type: 'hero',
                order: 0,
                content: { headline: '<script>alert("xss")</script>' },
              },
            ],
          },
        }

        const html = exportToHTML(variantWithHtml)

        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;script&gt;')
      })
    })

    describe('exportToJSON', () => {
      it('should generate valid JSON', () => {
        const json = exportToJSON(variant)
        const parsed = JSON.parse(json)

        expect(parsed.id).toBe('lp_1')
        expect(parsed.name).toBe('Test LP')
        expect(parsed.exportedAt).toBeDefined()
      })
    })
  })

  describe('compareVariants', () => {
    it('should detect added sections', () => {
      const v1: LPVariant = {
        id: 'lp_1', runId: 'run_1', tenantId: 'tenant_1', name: 'Test',
        appealAxis: 'test', structureType: 'standard', version: 1, status: 'draft',
        publicUrl: null, publishedAt: null, createdAt: '', updatedAt: '',
        content: { sections: [{ id: 'sec_1', type: 'hero', order: 0, content: {} }] },
      }

      const v2: LPVariant = {
        ...v1,
        content: {
          sections: [
            { id: 'sec_1', type: 'hero', order: 0, content: {} },
            { id: 'sec_2', type: 'cta', order: 1, content: {} },
          ],
        },
      }

      const diff = compareVariants(v1, v2)

      expect(diff.added).toContain('sec_2')
      expect(diff.removed).toHaveLength(0)
    })

    it('should detect removed sections', () => {
      const v1: LPVariant = {
        id: 'lp_1', runId: 'run_1', tenantId: 'tenant_1', name: 'Test',
        appealAxis: 'test', structureType: 'standard', version: 1, status: 'draft',
        publicUrl: null, publishedAt: null, createdAt: '', updatedAt: '',
        content: {
          sections: [
            { id: 'sec_1', type: 'hero', order: 0, content: {} },
            { id: 'sec_2', type: 'cta', order: 1, content: {} },
          ],
        },
      }

      const v2: LPVariant = {
        ...v1,
        content: { sections: [{ id: 'sec_1', type: 'hero', order: 0, content: {} }] },
      }

      const diff = compareVariants(v1, v2)

      expect(diff.removed).toContain('sec_2')
    })

    it('should detect modified sections', () => {
      const v1: LPVariant = {
        id: 'lp_1', runId: 'run_1', tenantId: 'tenant_1', name: 'Test',
        appealAxis: 'test', structureType: 'standard', version: 1, status: 'draft',
        publicUrl: null, publishedAt: null, createdAt: '', updatedAt: '',
        content: { sections: [{ id: 'sec_1', type: 'hero', order: 0, content: { headline: 'Old' } }] },
      }

      const v2: LPVariant = {
        ...v1,
        content: { sections: [{ id: 'sec_1', type: 'hero', order: 0, content: { headline: 'New' } }] },
      }

      const diff = compareVariants(v1, v2)

      expect(diff.modified).toContain('sec_1')
    })
  })

  describe('getStatusLabel', () => {
    it('should return Japanese labels', () => {
      expect(getStatusLabel('draft')).toBe('下書き')
      expect(getStatusLabel('submitted')).toBe('提出済み')
      expect(getStatusLabel('approved')).toBe('承認済み')
      expect(getStatusLabel('published')).toBe('公開済み')
    })
  })
})
