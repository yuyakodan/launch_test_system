import { describe, it, expect } from 'vitest'
import {
  canTransition,
  executeTransition,
  getAvailableTransitions,
  getStateLabel,
  isEditable,
  isDeliverable,
  isTerminal,
  StateTransitionError,
  STATE_TRANSITIONS,
  type RunState,
  type RunTransitionEvent,
} from '../../src/domain/run-state'

describe('Run State Machine', () => {
  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      const result = canTransition('draft', 'start_design', 'operator')
      expect(result).not.toBeNull()
      expect(result?.to).toBe('designing')
    })

    it('should reject invalid event for state', () => {
      const result = canTransition('draft', 'approve', 'tenant_owner')
      expect(result).toBeNull()
    })

    it('should reject transition by unauthorized role', () => {
      // viewer cannot start design
      const result = canTransition('draft', 'start_design', 'viewer')
      expect(result).toBeNull()
    })

    it('should allow tenant_owner to perform any allowed transition', () => {
      const result = canTransition('ready_for_review', 'approve', 'tenant_owner')
      expect(result).not.toBeNull()
    })

    it('should allow reviewer to approve', () => {
      const result = canTransition('ready_for_review', 'approve', 'reviewer')
      expect(result).not.toBeNull()
    })
  })

  describe('executeTransition', () => {
    it('should transition from draft to designing', () => {
      const newState = executeTransition('draft', 'start_design', 'operator')
      expect(newState).toBe('designing')
    })

    it('should follow the full happy path', () => {
      let state: RunState = 'draft'

      state = executeTransition(state, 'start_design', 'operator')
      expect(state).toBe('designing')

      state = executeTransition(state, 'start_generation', 'operator')
      expect(state).toBe('generating')

      state = executeTransition(state, 'submit_for_review', 'operator')
      expect(state).toBe('ready_for_review')

      state = executeTransition(state, 'approve', 'reviewer')
      expect(state).toBe('approved')

      state = executeTransition(state, 'start_publish', 'operator')
      expect(state).toBe('publishing')

      state = executeTransition(state, 'publish_complete', 'operator')
      expect(state).toBe('live')

      state = executeTransition(state, 'start_delivery', 'operator', {
        isApproved: true,
        hasBudget: true,
      })
      expect(state).toBe('running')

      state = executeTransition(state, 'complete', 'operator')
      expect(state).toBe('completed')

      state = executeTransition(state, 'archive', 'operator')
      expect(state).toBe('archived')
    })

    it('should throw error for invalid transition', () => {
      expect(() => {
        executeTransition('draft', 'approve', 'operator')
      }).toThrow(StateTransitionError)
    })

    it('should require approval for delivery', () => {
      expect(() => {
        executeTransition('live', 'start_delivery', 'operator', {
          isApproved: false,
          hasBudget: true,
        })
      }).toThrow(StateTransitionError)

      expect(() => {
        executeTransition('live', 'start_delivery', 'operator', {
          isApproved: false,
          hasBudget: true,
        })
      }).toThrow(/approved/)
    })

    it('should require budget for delivery', () => {
      expect(() => {
        executeTransition('live', 'start_delivery', 'operator', {
          isApproved: true,
          hasBudget: false,
        })
      }).toThrow(StateTransitionError)

      expect(() => {
        executeTransition('live', 'start_delivery', 'operator', {
          isApproved: true,
          hasBudget: false,
        })
      }).toThrow(/Budget/)
    })

    it('should allow delivery with approval and budget', () => {
      const newState = executeTransition('live', 'start_delivery', 'operator', {
        isApproved: true,
        hasBudget: true,
      })
      expect(newState).toBe('running')
    })

    it('should allow pause and resume', () => {
      let state: RunState = 'running'

      state = executeTransition(state, 'pause', 'operator')
      expect(state).toBe('paused')

      state = executeTransition(state, 'resume', 'operator', {
        isApproved: true,
        hasBudget: true,
      })
      expect(state).toBe('running')
    })

    it('should allow rejection back to designing', () => {
      const state = executeTransition('ready_for_review', 'reject', 'reviewer')
      expect(state).toBe('designing')
    })
  })

  describe('getAvailableTransitions', () => {
    it('should return available transitions for operator in draft', () => {
      const transitions = getAvailableTransitions('draft', 'operator')

      expect(transitions.length).toBeGreaterThan(0)
      expect(transitions.some((t) => t.event === 'start_design')).toBe(true)
    })

    it('should return approval transition for reviewer', () => {
      const transitions = getAvailableTransitions('ready_for_review', 'reviewer')

      expect(transitions.some((t) => t.event === 'approve')).toBe(true)
      expect(transitions.some((t) => t.event === 'reject')).toBe(true)
    })

    it('should return no transitions for viewer', () => {
      const transitions = getAvailableTransitions('draft', 'viewer')
      expect(transitions.length).toBe(0)
    })

    it('should return all possible transitions for tenant_owner', () => {
      const transitions = getAvailableTransitions('ready_for_review', 'tenant_owner')
      expect(transitions.some((t) => t.event === 'approve')).toBe(true)
      expect(transitions.some((t) => t.event === 'reject')).toBe(true)
    })

    it('should return no transitions for terminal states', () => {
      const archivedTransitions = getAvailableTransitions('archived', 'tenant_owner')
      expect(archivedTransitions.length).toBe(0)
    })
  })

  describe('getStateLabel', () => {
    it('should return Japanese labels', () => {
      expect(getStateLabel('draft')).toBe('下書き')
      expect(getStateLabel('running')).toBe('配信中')
      expect(getStateLabel('completed')).toBe('完了')
    })
  })

  describe('isEditable', () => {
    it('should return true for draft and designing', () => {
      expect(isEditable('draft')).toBe(true)
      expect(isEditable('designing')).toBe(true)
    })

    it('should return false for other states', () => {
      expect(isEditable('generating')).toBe(false)
      expect(isEditable('running')).toBe(false)
      expect(isEditable('completed')).toBe(false)
    })
  })

  describe('isDeliverable', () => {
    it('should return true for live, running, paused', () => {
      expect(isDeliverable('live')).toBe(true)
      expect(isDeliverable('running')).toBe(true)
      expect(isDeliverable('paused')).toBe(true)
    })

    it('should return false for other states', () => {
      expect(isDeliverable('draft')).toBe(false)
      expect(isDeliverable('approved')).toBe(false)
      expect(isDeliverable('completed')).toBe(false)
    })
  })

  describe('isTerminal', () => {
    it('should return true for completed and archived', () => {
      expect(isTerminal('completed')).toBe(true)
      expect(isTerminal('archived')).toBe(true)
    })

    it('should return false for other states', () => {
      expect(isTerminal('draft')).toBe(false)
      expect(isTerminal('running')).toBe(false)
      expect(isTerminal('paused')).toBe(false)
    })
  })

  describe('StateTransitionError', () => {
    it('should contain transition details', () => {
      const error = new StateTransitionError(
        'draft',
        'approve',
        'Invalid event',
        'approved'
      )

      expect(error.from).toBe('draft')
      expect(error.event).toBe('approve')
      expect(error.to).toBe('approved')
      expect(error.reason).toBe('Invalid event')
      expect(error.message).toContain('draft')
      expect(error.message).toContain('approve')
    })
  })

  describe('STATE_TRANSITIONS coverage', () => {
    it('should have transitions from all non-terminal states', () => {
      const nonTerminalStates: RunState[] = [
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
      ]

      for (const state of nonTerminalStates) {
        const hasTransition = STATE_TRANSITIONS.some((t) => t.from === state)
        expect(hasTransition, `State '${state}' should have at least one transition`).toBe(true)
      }
    })

    it('should not have transitions from archived state', () => {
      const archivedTransitions = STATE_TRANSITIONS.filter((t) => t.from === 'archived')
      expect(archivedTransitions.length).toBe(0)
    })
  })
})

describe('Enforcement Rules', () => {
  describe('Approval Gate', () => {
    it('should prevent unapproved run from starting delivery', () => {
      expect(() => {
        executeTransition('live', 'start_delivery', 'operator')
      }).toThrow(StateTransitionError)
    })

    it('should prevent unapproved run from resuming', () => {
      expect(() => {
        executeTransition('paused', 'resume', 'operator')
      }).toThrow(StateTransitionError)
    })
  })

  describe('Budget Gate', () => {
    it('should prevent delivery without budget', () => {
      expect(() => {
        executeTransition('live', 'start_delivery', 'operator', {
          isApproved: true,
          hasBudget: false,
        })
      }).toThrow(StateTransitionError)
    })
  })

  describe('Role Restrictions', () => {
    it('should prevent viewer from any state change', () => {
      const allEvents: RunTransitionEvent[] = [
        'start_design',
        'start_generation',
        'submit_for_review',
        'approve',
        'reject',
        'start_publish',
        'publish_complete',
        'start_delivery',
        'pause',
        'resume',
        'complete',
        'archive',
        'cancel',
      ]

      for (const event of allEvents) {
        // Try all states for each event
        const transition = STATE_TRANSITIONS.find((t) => t.event === event)
        if (transition) {
          const result = canTransition(transition.from, event, 'viewer')
          expect(result, `Viewer should not be able to '${event}'`).toBeNull()
        }
      }
    })

    it('should only allow reviewer/owner to approve', () => {
      const operatorResult = canTransition('ready_for_review', 'approve', 'operator')
      expect(operatorResult).toBeNull()

      const reviewerResult = canTransition('ready_for_review', 'approve', 'reviewer')
      expect(reviewerResult).not.toBeNull()

      const ownerResult = canTransition('ready_for_review', 'approve', 'tenant_owner')
      expect(ownerResult).not.toBeNull()
    })
  })
})
