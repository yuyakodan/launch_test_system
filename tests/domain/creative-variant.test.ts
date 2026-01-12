import { describe, it, expect } from 'vitest'
import {
  STANDARD_SIZES,
  generateCreativeId,
  createCreativeVariant,
  createRequiredVariants,
  createTextLayer,
  createImageLayer,
  addLayer,
  updateLayer,
  removeLayer,
  replaceTextContent,
  checkProhibitions,
  isInSafeArea,
  checkSafeArea,
  duplicateForSize,
  getAspectRatioLabel,
  DEFAULT_PROHIBITION_RULES,
  type CreativeVariant,
  type AspectRatio,
} from '../../src/domain/creative-variant'

describe('Creative Variant Management', () => {
  describe('STANDARD_SIZES', () => {
    it('should have correct dimensions for 1:1', () => {
      expect(STANDARD_SIZES['1:1']).toEqual({
        aspectRatio: '1:1',
        width: 1080,
        height: 1080,
      })
    })

    it('should have correct dimensions for 4:5', () => {
      expect(STANDARD_SIZES['4:5']).toEqual({
        aspectRatio: '4:5',
        width: 1080,
        height: 1350,
      })
    })

    it('should have correct dimensions for 9:16', () => {
      expect(STANDARD_SIZES['9:16']).toEqual({
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
      })
    })
  })

  describe('createCreativeVariant', () => {
    it('should create variant with correct size', () => {
      const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')

      expect(variant.width).toBe(1080)
      expect(variant.height).toBe(1080)
      expect(variant.aspectRatio).toBe('1:1')
      expect(variant.status).toBe('draft')
      expect(variant.layers).toHaveLength(0)
    })
  })

  describe('createRequiredVariants', () => {
    it('should create variants for all required sizes', () => {
      const variants = createRequiredVariants('run_1', 'tenant_1', 'Ad')

      expect(variants).toHaveLength(3)
      expect(variants.map((v) => v.aspectRatio)).toContain('1:1')
      expect(variants.map((v) => v.aspectRatio)).toContain('4:5')
      expect(variants.map((v) => v.aspectRatio)).toContain('9:16')
    })
  })

  describe('Layer Operations', () => {
    const baseVariant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')

    describe('createTextLayer', () => {
      it('should create text layer with defaults', () => {
        const layer = createTextLayer('Hello', 100, 200)

        expect(layer.type).toBe('text')
        expect(layer.content).toBe('Hello')
        expect(layer.position).toEqual({ x: 100, y: 200 })
        expect(layer.style.fontSize).toBe(24)
      })

      it('should apply custom style', () => {
        const layer = createTextLayer('Hello', 100, 200, { fontSize: 48, color: '#FF0000' })

        expect(layer.style.fontSize).toBe(48)
        expect(layer.style.color).toBe('#FF0000')
      })
    })

    describe('createImageLayer', () => {
      it('should create image layer', () => {
        const layer = createImageLayer('https://example.com/img.png', 0, 0, 500, 500)

        expect(layer.type).toBe('image')
        expect(layer.content).toBe('https://example.com/img.png')
        expect(layer.size).toEqual({ width: 500, height: 500 })
      })
    })

    describe('addLayer', () => {
      it('should add layer to variant', () => {
        const layer = createTextLayer('Test', 0, 0)
        const updated = addLayer(baseVariant, layer)

        expect(updated.layers).toHaveLength(1)
        expect(updated.layers[0].content).toBe('Test')
      })
    })

    describe('updateLayer', () => {
      it('should update layer properties', () => {
        const layer = createTextLayer('Test', 0, 0)
        const withLayer = addLayer(baseVariant, layer)
        const updated = updateLayer(withLayer, layer.id, { content: 'Updated' })

        expect(updated.layers[0].content).toBe('Updated')
      })
    })

    describe('removeLayer', () => {
      it('should remove layer', () => {
        const layer = createTextLayer('Test', 0, 0)
        const withLayer = addLayer(baseVariant, layer)
        const updated = removeLayer(withLayer, layer.id)

        expect(updated.layers).toHaveLength(0)
      })
    })

    describe('replaceTextContent', () => {
      it('should replace text content', () => {
        const layer = createTextLayer('Old Text', 0, 0)
        const withLayer = addLayer(baseVariant, layer)
        const updated = replaceTextContent(withLayer, layer.id, 'New Text')

        expect(updated.layers[0].content).toBe('New Text')
      })
    })
  })

  describe('Prohibition Check', () => {
    describe('checkProhibitions', () => {
      it('should pass when no violations', () => {
        const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
        const layer = createTextLayer('普通のテキスト', 0, 0)
        const withLayer = addLayer(variant, layer)

        const result = checkProhibitions(withLayer)

        expect(result.passed).toBe(true)
        expect(result.violations).toHaveLength(0)
      })

      it('should detect absolute claims', () => {
        const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
        const layer = createTextLayer('絶対に痩せる！100%効果あり', 0, 0)
        const withLayer = addLayer(variant, layer)

        const result = checkProhibitions(withLayer)

        expect(result.passed).toBe(false)
        expect(result.violations.some((v) => v.matchedText === '絶対')).toBe(true)
        expect(result.violations.some((v) => v.matchedText === '100%')).toBe(true)
      })

      it('should detect superlative expressions', () => {
        const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
        const layer = createTextLayer('業界No.1の実績', 0, 0)
        const withLayer = addLayer(variant, layer)

        const result = checkProhibitions(withLayer)

        expect(result.violations.some((v) => v.ruleId === 'ng_superlative')).toBe(true)
      })

      it('should warn for urgent expressions', () => {
        const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
        const layer = createTextLayer('今だけ特別価格', 0, 0)
        const withLayer = addLayer(variant, layer)

        const result = checkProhibitions(withLayer)

        // Warning doesn't fail the check
        expect(result.passed).toBe(true)
        expect(result.violations.some((v) => v.severity === 'warning')).toBe(true)
      })
    })
  })

  describe('Safe Area Check', () => {
    describe('isInSafeArea', () => {
      const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')

      it('should return true for centered layer', () => {
        const layer = createTextLayer('Test', 500, 500)
        layer.size = { width: 80, height: 30 }

        expect(isInSafeArea(layer, variant, 50)).toBe(true)
      })

      it('should return false for layer at edge', () => {
        const layer = createTextLayer('Test', 10, 10)
        layer.size = { width: 100, height: 50 }

        expect(isInSafeArea(layer, variant, 50)).toBe(false)
      })
    })

    describe('checkSafeArea', () => {
      it('should identify out of bounds layers', () => {
        const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
        const layer1 = createTextLayer('Edge', 10, 10)
        const layer2 = createTextLayer('Center', 500, 500)
        layer2.size = { width: 80, height: 30 }

        const withLayers = addLayer(addLayer(variant, layer1), layer2)
        const result = checkSafeArea(withLayers, 50)

        expect(result.passed).toBe(false)
        expect(result.outOfBounds).toContain(layer1.id)
        expect(result.outOfBounds).not.toContain(layer2.id)
      })
    })
  })

  describe('duplicateForSize', () => {
    it('should scale layers proportionally', () => {
      const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
      const layer = createTextLayer('Test', 540, 540) // Center of 1080x1080
      layer.size = { width: 200, height: 100 }
      const withLayer = addLayer(variant, layer)

      const duplicated = duplicateForSize(withLayer, '9:16')

      // New variant should be 1080x1920
      expect(duplicated.width).toBe(1080)
      expect(duplicated.height).toBe(1920)
      expect(duplicated.aspectRatio).toBe('9:16')

      // Layer should be scaled
      const newLayer = duplicated.layers[0]
      expect(newLayer.position.x).toBe(540) // Same x (scale = 1)
      expect(newLayer.position.y).toBeCloseTo(960, -1) // Scaled y (1920/1080 * 540)
    })

    it('should create new IDs', () => {
      const variant = createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1')
      const layer = createTextLayer('Test', 100, 100)
      const withLayer = addLayer(variant, layer)

      const duplicated = duplicateForSize(withLayer, '4:5')

      expect(duplicated.id).not.toBe(withLayer.id)
      expect(duplicated.layers[0].id).not.toBe(layer.id)
    })

    it('should reset status to draft', () => {
      const variant: CreativeVariant = {
        ...createCreativeVariant('run_1', 'tenant_1', 'Test', '1:1'),
        status: 'approved',
      }

      const duplicated = duplicateForSize(variant, '4:5')

      expect(duplicated.status).toBe('draft')
      expect(duplicated.version).toBe(1)
    })
  })

  describe('getAspectRatioLabel', () => {
    it('should return Japanese labels', () => {
      expect(getAspectRatioLabel('1:1')).toBe('正方形（1:1）')
      expect(getAspectRatioLabel('4:5')).toBe('縦長（4:5）')
      expect(getAspectRatioLabel('9:16')).toBe('ストーリー（9:16）')
    })
  })
})
