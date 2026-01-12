import { describe, it, expect } from 'vitest'
import {
  canApprove,
  isChecklistComplete,
  getIncompleteRequiredItems,
  validateChecklist,
  approve,
  reject,
  getDefaultChecklist,
  getRequiredApprovalTargets,
  isFullyApproved,
  getPendingApprovalTargets,
  ApprovalError,
  DEFAULT_CHECKLISTS,
  type ApprovalChecklist,
  type ApprovalRequest,
  type ApprovalResult,
  type ApprovalTargetType,
} from '../../src/domain/approval'

describe('Approval Flow', () => {
  describe('canApprove', () => {
    it('should allow tenant_owner to approve', () => {
      expect(canApprove('tenant_owner')).toBe(true)
    })

    it('should allow reviewer to approve', () => {
      expect(canApprove('reviewer')).toBe(true)
    })

    it('should not allow operator to approve', () => {
      expect(canApprove('operator')).toBe(false)
    })

    it('should not allow viewer to approve', () => {
      expect(canApprove('viewer')).toBe(false)
    })
  })

  describe('isChecklistComplete', () => {
    it('should return true when all required items are checked', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: true, required: true },
          { id: '2', label: 'Item 2', checked: true, required: true },
          { id: '3', label: 'Item 3', checked: false, required: false },
        ],
      }

      expect(isChecklistComplete(checklist)).toBe(true)
    })

    it('should return false when required items are not checked', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: true, required: true },
          { id: '2', label: 'Item 2', checked: false, required: true },
        ],
      }

      expect(isChecklistComplete(checklist)).toBe(false)
    })

    it('should return true for empty checklist', () => {
      const checklist: ApprovalChecklist = { items: [] }
      expect(isChecklistComplete(checklist)).toBe(true)
    })
  })

  describe('getIncompleteRequiredItems', () => {
    it('should return unchecked required items', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: true, required: true },
          { id: '2', label: 'Item 2', checked: false, required: true },
          { id: '3', label: 'Item 3', checked: false, required: false },
        ],
      }

      const incomplete = getIncompleteRequiredItems(checklist)
      expect(incomplete).toHaveLength(1)
      expect(incomplete[0].id).toBe('2')
    })

    it('should return empty array when all required items are checked', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: true, required: true },
          { id: '2', label: 'Item 2', checked: false, required: false },
        ],
      }

      expect(getIncompleteRequiredItems(checklist)).toHaveLength(0)
    })
  })

  describe('validateChecklist', () => {
    it('should not throw for complete checklist', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: true, required: true },
        ],
      }

      expect(() => validateChecklist(checklist)).not.toThrow()
    })

    it('should throw for incomplete checklist', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: '1', label: 'Item 1', checked: false, required: true },
        ],
      }

      expect(() => validateChecklist(checklist)).toThrow(ApprovalError)
    })

    it('should include incomplete item details in error', () => {
      const checklist: ApprovalChecklist = {
        items: [
          { id: 'item_1', label: 'Item 1', checked: false, required: true },
          { id: 'item_2', label: 'Item 2', checked: false, required: true },
        ],
      }

      try {
        validateChecklist(checklist)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApprovalError)
        const approvalError = error as ApprovalError
        expect(approvalError.reason).toBe('CHECKLIST_INCOMPLETE')
        expect(approvalError.details?.incompleteItems).toContain('item_1')
        expect(approvalError.details?.incompleteItems).toContain('item_2')
      }
    })
  })

  describe('approve', () => {
    const createRequest = (): ApprovalRequest => ({
      runId: 'run_123',
      tenantId: 'tenant_456',
      targetType: 'lp',
      targetId: 'lp_789',
      checklist: {
        items: [
          { id: '1', label: 'Check 1', checked: true, required: true },
          { id: '2', label: 'Check 2', checked: true, required: true },
        ],
      },
    })

    it('should approve with valid role and complete checklist', () => {
      const request = createRequest()
      const result = approve(request, 'reviewer', 'user_1', 'Looks good!')

      expect(result.status).toBe('approved')
      expect(result.runId).toBe('run_123')
      expect(result.targetType).toBe('lp')
      expect(result.reviewedBy).toBe('user_1')
      expect(result.comment).toBe('Looks good!')
    })

    it('should throw for unauthorized role', () => {
      const request = createRequest()

      expect(() => approve(request, 'operator', 'user_1')).toThrow(ApprovalError)
      expect(() => approve(request, 'viewer', 'user_1')).toThrow(ApprovalError)
    })

    it('should throw for incomplete checklist', () => {
      const request = createRequest()
      request.checklist.items[0].checked = false

      expect(() => approve(request, 'reviewer', 'user_1')).toThrow(ApprovalError)
    })

    it('should allow approval without comment', () => {
      const request = createRequest()
      const result = approve(request, 'reviewer', 'user_1')

      expect(result.status).toBe('approved')
      expect(result.comment).toBeUndefined()
    })
  })

  describe('reject', () => {
    const createRequest = (): ApprovalRequest => ({
      runId: 'run_123',
      tenantId: 'tenant_456',
      targetType: 'lp',
      targetId: 'lp_789',
      checklist: {
        items: [
          { id: '1', label: 'Check 1', checked: false, required: true },
        ],
      },
    })

    it('should reject with valid role and comment', () => {
      const request = createRequest()
      const result = reject(request, 'reviewer', 'user_1', 'Needs revision')

      expect(result.status).toBe('rejected')
      expect(result.comment).toBe('Needs revision')
    })

    it('should throw for unauthorized role', () => {
      const request = createRequest()

      expect(() => reject(request, 'operator', 'user_1', 'Comment')).toThrow(ApprovalError)
    })

    it('should require comment for rejection', () => {
      const request = createRequest()

      expect(() => reject(request, 'reviewer', 'user_1', '')).toThrow(ApprovalError)
      expect(() => reject(request, 'reviewer', 'user_1', '   ')).toThrow(ApprovalError)
    })
  })

  describe('getDefaultChecklist', () => {
    it('should return checklist for LP', () => {
      const checklist = getDefaultChecklist('lp')

      expect(checklist.items.length).toBeGreaterThan(0)
      expect(checklist.items.some((i) => i.id === 'lp_ng_words')).toBe(true)
    })

    it('should return checklist for creative', () => {
      const checklist = getDefaultChecklist('creative')

      expect(checklist.items.length).toBeGreaterThan(0)
      expect(checklist.items.some((i) => i.id === 'creative_size')).toBe(true)
    })

    it('should return independent copies', () => {
      const checklist1 = getDefaultChecklist('lp')
      const checklist2 = getDefaultChecklist('lp')

      checklist1.items[0].checked = true

      expect(checklist2.items[0].checked).toBe(false)
    })
  })

  describe('DEFAULT_CHECKLISTS', () => {
    it('should have checklists for all target types', () => {
      const targetTypes: ApprovalTargetType[] = [
        'lp',
        'creative',
        'measurement',
        'stop_conditions',
        'budget',
        'url',
      ]

      for (const type of targetTypes) {
        expect(DEFAULT_CHECKLISTS[type]).toBeDefined()
        expect(DEFAULT_CHECKLISTS[type].length).toBeGreaterThan(0)
      }
    })

    it('should have at least one required item per type', () => {
      for (const type in DEFAULT_CHECKLISTS) {
        const items = DEFAULT_CHECKLISTS[type as ApprovalTargetType]
        const hasRequired = items.some((item) => item.required)
        expect(hasRequired, `${type} should have required items`).toBe(true)
      }
    })
  })

  describe('getRequiredApprovalTargets', () => {
    it('should return all required target types', () => {
      const targets = getRequiredApprovalTargets()

      expect(targets).toContain('lp')
      expect(targets).toContain('creative')
      expect(targets).toContain('measurement')
      expect(targets).toContain('stop_conditions')
      expect(targets).toContain('budget')
      expect(targets).toContain('url')
    })
  })

  describe('isFullyApproved', () => {
    const createApproval = (
      targetType: ApprovalTargetType,
      status: 'approved' | 'pending' | 'rejected' = 'approved'
    ): ApprovalResult => ({
      id: `approval_${targetType}`,
      runId: 'run_123',
      tenantId: 'tenant_456',
      targetType,
      targetId: `${targetType}_789`,
      status,
      checklist: { items: [] },
      reviewedBy: 'user_1',
      reviewedAt: new Date().toISOString(),
    })

    it('should return true when all targets are approved', () => {
      const approvals: ApprovalResult[] = [
        createApproval('lp'),
        createApproval('creative'),
        createApproval('measurement'),
        createApproval('stop_conditions'),
        createApproval('budget'),
        createApproval('url'),
      ]

      expect(isFullyApproved(approvals)).toBe(true)
    })

    it('should return false when some targets are missing', () => {
      const approvals: ApprovalResult[] = [
        createApproval('lp'),
        createApproval('creative'),
      ]

      expect(isFullyApproved(approvals)).toBe(false)
    })

    it('should return false when some targets are rejected', () => {
      const approvals: ApprovalResult[] = [
        createApproval('lp'),
        createApproval('creative', 'rejected'),
        createApproval('measurement'),
        createApproval('stop_conditions'),
        createApproval('budget'),
        createApproval('url'),
      ]

      expect(isFullyApproved(approvals)).toBe(false)
    })

    it('should return false for empty approvals', () => {
      expect(isFullyApproved([])).toBe(false)
    })
  })

  describe('getPendingApprovalTargets', () => {
    const createApproval = (targetType: ApprovalTargetType): ApprovalResult => ({
      id: `approval_${targetType}`,
      runId: 'run_123',
      tenantId: 'tenant_456',
      targetType,
      targetId: `${targetType}_789`,
      status: 'approved',
      checklist: { items: [] },
      reviewedBy: 'user_1',
      reviewedAt: new Date().toISOString(),
    })

    it('should return all targets when no approvals exist', () => {
      const pending = getPendingApprovalTargets([])

      expect(pending).toHaveLength(6)
    })

    it('should return remaining targets', () => {
      const approvals: ApprovalResult[] = [
        createApproval('lp'),
        createApproval('creative'),
      ]

      const pending = getPendingApprovalTargets(approvals)

      expect(pending).not.toContain('lp')
      expect(pending).not.toContain('creative')
      expect(pending).toContain('measurement')
      expect(pending).toContain('stop_conditions')
      expect(pending).toContain('budget')
      expect(pending).toContain('url')
    })

    it('should return empty array when all approved', () => {
      const approvals: ApprovalResult[] = [
        createApproval('lp'),
        createApproval('creative'),
        createApproval('measurement'),
        createApproval('stop_conditions'),
        createApproval('budget'),
        createApproval('url'),
      ]

      expect(getPendingApprovalTargets(approvals)).toHaveLength(0)
    })
  })
})

describe('Approval Flow Integration', () => {
  it('should complete full approval workflow', () => {
    // 1. LPの承認リクエスト作成
    const lpChecklist = getDefaultChecklist('lp')

    // 2. チェックリストを完了
    lpChecklist.items.forEach((item) => {
      item.checked = true
    })

    // 3. 承認実行
    const request: ApprovalRequest = {
      runId: 'run_123',
      tenantId: 'tenant_456',
      targetType: 'lp',
      targetId: 'lp_789',
      checklist: lpChecklist,
    }

    const result = approve(request, 'reviewer', 'user_1', '問題なし')

    expect(result.status).toBe('approved')
  })

  it('should enforce approval gate for delivery', () => {
    // 部分的な承認のみ
    const approvals: ApprovalResult[] = [
      {
        id: '1',
        runId: 'run_123',
        tenantId: 'tenant_456',
        targetType: 'lp',
        targetId: 'lp_1',
        status: 'approved',
        checklist: { items: [] },
        reviewedBy: 'user_1',
        reviewedAt: new Date().toISOString(),
      },
    ]

    // 全承認完了していないので配信不可
    expect(isFullyApproved(approvals)).toBe(false)

    // 未承認項目を取得
    const pending = getPendingApprovalTargets(approvals)
    expect(pending).toContain('creative')
    expect(pending).toContain('measurement')
  })
})
