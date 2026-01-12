import { describe, it, expect } from 'vitest'
import type {
  Tenant,
  User,
  Role,
  Membership,
  Project,
  Run,
  RunState,
  VariantLP,
  VariantCreative,
  Approval,
  MetaConnection,
  MetaEntity,
  StopEvent,
  AuditLog,
} from '../../src/db/schema'

describe('Database Schema Types', () => {
  describe('Tenant', () => {
    it('should have correct structure', () => {
      const tenant: Tenant = {
        id: 'tenant_123',
        name: 'Test Tenant',
        plan: 'standard',
        settings: {
          notification_slack_webhook: 'https://hooks.slack.com/xxx',
        },
        created_at: '2026-01-13T00:00:00Z',
        updated_at: '2026-01-13T00:00:00Z',
      }

      expect(tenant.id).toBe('tenant_123')
      expect(tenant.plan).toBe('standard')
    })

    it('should allow all plan types', () => {
      const plans: Tenant['plan'][] = ['lite', 'standard', 'pro', 'growth']
      expect(plans).toHaveLength(4)
    })
  })

  describe('Run', () => {
    it('should have correct state transitions', () => {
      const validStates: RunState[] = [
        'draft',
        'designing',
        'generating',
        'ready_for_review',
        'approved',
        'publishing',
        'live',
        'running',
        'paused',
        'completed',
        'archived',
      ]

      expect(validStates).toHaveLength(11)
    })

    it('should validate stop conditions structure', () => {
      const run: Partial<Run> = {
        id: 'run_123',
        stop_conditions: {
          budget_total_enabled: true,
          budget_daily_enabled: true,
          cpa_limit_enabled: true,
          cpa_limit: 5000,
          cpa_min_sample: 100,
          cv_zero_hours_enabled: true,
          cv_zero_hours: 24,
          error_consecutive_enabled: true,
          error_consecutive_count: 3,
        },
        budget_total: 100000,
        budget_daily: 10000,
      }

      expect(run.stop_conditions?.cpa_limit).toBe(5000)
      expect(run.budget_total).toBe(100000)
    })
  })

  describe('Approval', () => {
    it('should have correct target types', () => {
      const targetTypes = [
        'lp',
        'creative',
        'measurement',
        'stop_conditions',
        'budget',
        'url',
      ]

      const approval: Partial<Approval> = {
        target_type: 'lp',
        status: 'pending',
      }

      expect(targetTypes).toContain(approval.target_type)
    })

    it('should validate checklist structure', () => {
      const approval: Partial<Approval> = {
        checklist_json: {
          items: [
            { id: '1', label: 'NGワードチェック', checked: true, required: true },
            { id: '2', label: 'URL確認', checked: false, required: true },
          ],
        },
      }

      expect(approval.checklist_json?.items).toHaveLength(2)
      expect(approval.checklist_json?.items[0].required).toBe(true)
    })
  })

  describe('MetaEntity', () => {
    it('should support hierarchy', () => {
      const campaign: Partial<MetaEntity> = {
        id: 'entity_1',
        entity_type: 'campaign',
        parent_id: null,
      }

      const adset: Partial<MetaEntity> = {
        id: 'entity_2',
        entity_type: 'adset',
        parent_id: 'entity_1',
        budget_daily: 10000,
      }

      const ad: Partial<MetaEntity> = {
        id: 'entity_3',
        entity_type: 'ad',
        parent_id: 'entity_2',
      }

      expect(campaign.parent_id).toBeNull()
      expect(adset.parent_id).toBe('entity_1')
      expect(ad.parent_id).toBe('entity_2')
    })
  })

  describe('StopEvent', () => {
    it('should have correct stop reasons', () => {
      const reasons = [
        'budget_total',
        'budget_daily',
        'cpa_limit',
        'cv_zero',
        'error_consecutive',
        'manual',
      ]

      expect(reasons).toHaveLength(6)
    })
  })

  describe('AuditLog', () => {
    it('should capture before and after states', () => {
      const log: Partial<AuditLog> = {
        action: 'update',
        target_type: 'run',
        target_id: 'run_123',
        before_state: { state: 'draft' },
        after_state: { state: 'designing' },
      }

      expect(log.before_state).toEqual({ state: 'draft' })
      expect(log.after_state).toEqual({ state: 'designing' })
    })
  })
})
