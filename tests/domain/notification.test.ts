import { describe, it, expect } from 'vitest'
import {
  generateNotificationId,
  createNotification,
  getDefaultPriority,
  markAsSent,
  markAsFailed,
  markAsRead,
  createSlackMessage,
  createSlackBlockMessage,
  getNotificationColor,
  getNotificationEmoji,
  createWebhookPayload,
  generateWebhookSignature,
  verifyWebhookSignature,
  createEmailContent,
  createNotificationPreferences,
  isChannelEnabled,
  isTypeEnabled,
  isQuietHours,
  canSendNotification,
  applyTemplate,
  getDefaultTemplate,
  extractVariables,
  getNotificationTypeLabel,
  getPriorityLabel,
  getChannelLabel,
  getStatusLabel,
  type NotificationRecipient,
  type SlackConfig,
  type NotificationPreferences,
} from '../../src/domain/notification'

describe('Notification System', () => {
  describe('ID Generation', () => {
    describe('generateNotificationId', () => {
      it('should generate unique notification IDs', () => {
        const id1 = generateNotificationId()
        const id2 = generateNotificationId()

        expect(id1).toMatch(/^notif_/)
        expect(id2).toMatch(/^notif_/)
        expect(id1).not.toBe(id2)
      })
    })
  })

  describe('Notification Creation', () => {
    const recipients: NotificationRecipient[] = [
      { type: 'user', target: 'user_1', name: 'Test User' },
    ]

    describe('createNotification', () => {
      it('should create notification with defaults', () => {
        const notification = createNotification(
          'tenant_1',
          'run_started',
          'slack',
          recipients,
          'Run Started',
          'Your run has started'
        )

        expect(notification.id).toMatch(/^notif_/)
        expect(notification.tenantId).toBe('tenant_1')
        expect(notification.type).toBe('run_started')
        expect(notification.channel).toBe('slack')
        expect(notification.priority).toBe('normal')
        expect(notification.status).toBe('pending')
        expect(notification.subject).toBe('Run Started')
      })

      it('should accept custom options', () => {
        const notification = createNotification(
          'tenant_1',
          'error',
          'email',
          recipients,
          'Error',
          'An error occurred',
          {
            priority: 'urgent',
            data: { errorCode: 500 },
          }
        )

        expect(notification.priority).toBe('urgent')
        expect(notification.data).toEqual({ errorCode: 500 })
      })
    })

    describe('getDefaultPriority', () => {
      it('should return correct priorities', () => {
        expect(getDefaultPriority('run_started')).toBe('normal')
        expect(getDefaultPriority('error')).toBe('urgent')
        expect(getDefaultPriority('auto_stop_triggered')).toBe('urgent')
        expect(getDefaultPriority('budget_alert')).toBe('high')
        expect(getDefaultPriority('info')).toBe('low')
      })
    })
  })

  describe('Status Updates', () => {
    const notification = createNotification(
      'tenant_1',
      'run_started',
      'slack',
      [{ type: 'user', target: 'user_1' }],
      'Test',
      'Test message'
    )

    describe('markAsSent', () => {
      it('should mark notification as sent', () => {
        const sent = markAsSent(notification)

        expect(sent.status).toBe('sent')
        expect(sent.sentAt).toBeDefined()
      })
    })

    describe('markAsFailed', () => {
      it('should mark notification as failed', () => {
        const failed = markAsFailed(notification, 'Connection error')

        expect(failed.status).toBe('failed')
        expect(failed.error).toBe('Connection error')
      })
    })

    describe('markAsRead', () => {
      it('should mark notification as read', () => {
        const read = markAsRead(notification)

        expect(read.status).toBe('read')
        expect(read.readAt).toBeDefined()
      })
    })
  })

  describe('Slack Messages', () => {
    const notification = createNotification(
      'tenant_1',
      'run_started',
      'slack',
      [{ type: 'channel', target: '#alerts' }],
      'Run Started',
      'Your run has started',
      { data: { runId: 'run_123' } }
    )

    const config: SlackConfig = {
      webhookUrl: 'https://hooks.slack.com/test',
      channel: '#test',
      username: 'Test Bot',
      iconEmoji: ':robot:',
    }

    describe('createSlackMessage', () => {
      it('should create Slack message', () => {
        const message = createSlackMessage(notification, config)

        expect(message.text).toBe('Run Started')
        expect(message.channel).toBe('#test')
        expect(message.username).toBe('Test Bot')
        expect(message.icon_emoji).toBe(':robot:')
        expect(message.attachments).toHaveLength(1)
        expect(message.attachments?.[0].title).toBe('Run Started')
      })

      it('should include data fields', () => {
        const message = createSlackMessage(notification)

        expect(message.attachments?.[0].fields).toBeDefined()
        expect(message.attachments?.[0].fields?.[0].title).toBe('runId')
      })
    })

    describe('createSlackBlockMessage', () => {
      it('should create block message', () => {
        const message = createSlackBlockMessage(notification, config)

        expect(message.blocks).toBeDefined()
        expect(message.blocks?.length).toBeGreaterThan(0)
        expect(message.blocks?.[0].type).toBe('header')
      })
    })

    describe('getNotificationColor', () => {
      it('should return correct colors', () => {
        expect(getNotificationColor('run_started')).toBe('#36a64f')
        expect(getNotificationColor('error')).toBe('#f44336')
        expect(getNotificationColor('budget_alert')).toBe('#ff9800')
      })
    })

    describe('getNotificationEmoji', () => {
      it('should return correct emojis', () => {
        expect(getNotificationEmoji('run_started')).toBe(':rocket:')
        expect(getNotificationEmoji('error')).toBe(':x:')
        expect(getNotificationEmoji('winner_declared')).toBe(':trophy:')
      })
    })
  })

  describe('Webhook', () => {
    const notification = createNotification(
      'tenant_1',
      'run_completed',
      'webhook',
      [{ type: 'webhook', target: 'https://example.com/webhook' }],
      'Run Completed',
      'Your run has completed',
      { data: { runId: 'run_123' } }
    )

    describe('createWebhookPayload', () => {
      it('should create webhook payload', () => {
        const payload = createWebhookPayload(notification)

        expect(payload.event).toBe('run_completed')
        expect(payload.timestamp).toBeDefined()
        expect(payload.data.id).toBe(notification.id)
        expect(payload.data.tenantId).toBe('tenant_1')
      })

      it('should include signature when secret provided', () => {
        const payload = createWebhookPayload(notification, 'my_secret')

        expect(payload.signature).toBeDefined()
        expect(payload.signature).toMatch(/^sha256=/)
      })
    })

    describe('generateWebhookSignature', () => {
      it('should generate consistent signatures', () => {
        const sig1 = generateWebhookSignature('test payload', 'secret')
        const sig2 = generateWebhookSignature('test payload', 'secret')

        expect(sig1).toBe(sig2)
      })

      it('should generate different signatures for different payloads', () => {
        const sig1 = generateWebhookSignature('payload 1', 'secret')
        const sig2 = generateWebhookSignature('payload 2', 'secret')

        expect(sig1).not.toBe(sig2)
      })
    })

    describe('verifyWebhookSignature', () => {
      it('should verify valid signature', () => {
        const signature = generateWebhookSignature('test', 'secret')
        expect(verifyWebhookSignature('test', signature, 'secret')).toBe(true)
      })

      it('should reject invalid signature', () => {
        expect(verifyWebhookSignature('test', 'invalid', 'secret')).toBe(false)
      })
    })
  })

  describe('Email', () => {
    const notification = createNotification(
      'tenant_1',
      'approval_required',
      'email',
      [{ type: 'user', target: 'user@example.com', name: 'Test User' }],
      'Approval Required',
      'Please review and approve this request',
      { data: { requestId: 'req_123' } }
    )

    describe('createEmailContent', () => {
      it('should create email content', () => {
        const content = createEmailContent(notification)

        expect(content.subject).toBe('Approval Required')
        expect(content.text).toContain('Please review')
        expect(content.html).toContain('<html>')
        expect(content.html).toContain('Approval Required')
      })

      it('should include data in email', () => {
        const content = createEmailContent(notification)

        expect(content.text).toContain('requestId')
        expect(content.html).toContain('req_123')
      })
    })
  })

  describe('Notification Preferences', () => {
    describe('createNotificationPreferences', () => {
      it('should create default preferences', () => {
        const prefs = createNotificationPreferences('user_1', 'tenant_1')

        expect(prefs.userId).toBe('user_1')
        expect(prefs.tenantId).toBe('tenant_1')
        expect(prefs.channels.length).toBe(4)
        expect(prefs.enabledTypes.length).toBeGreaterThan(0)
      })
    })

    describe('isChannelEnabled', () => {
      const prefs = createNotificationPreferences('user_1', 'tenant_1')

      it('should return true for enabled channels', () => {
        expect(isChannelEnabled(prefs, 'in_app')).toBe(true)
        expect(isChannelEnabled(prefs, 'email')).toBe(true)
      })

      it('should return false for disabled channels', () => {
        expect(isChannelEnabled(prefs, 'slack')).toBe(false)
        expect(isChannelEnabled(prefs, 'webhook')).toBe(false)
      })
    })

    describe('isTypeEnabled', () => {
      const prefs = createNotificationPreferences('user_1', 'tenant_1')

      it('should return true for enabled types', () => {
        expect(isTypeEnabled(prefs, 'run_started')).toBe(true)
        expect(isTypeEnabled(prefs, 'error')).toBe(true)
      })

      it('should return false for disabled types', () => {
        expect(isTypeEnabled(prefs, 'info')).toBe(false)
      })
    })

    describe('isQuietHours', () => {
      it('should return false when quiet hours disabled', () => {
        const prefs: NotificationPreferences = {
          userId: 'user_1',
          tenantId: 'tenant_1',
          channels: [],
          enabledTypes: [],
        }

        expect(isQuietHours(prefs)).toBe(false)
      })

      it('should detect same-day quiet hours', () => {
        const prefs: NotificationPreferences = {
          userId: 'user_1',
          tenantId: 'tenant_1',
          channels: [],
          enabledTypes: [],
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
            timezone: 'Asia/Tokyo',
          },
        }

        // 23:00 should be in quiet hours
        const nightTime = new Date()
        nightTime.setHours(23, 0, 0, 0)
        expect(isQuietHours(prefs, nightTime)).toBe(true)

        // 12:00 should not be in quiet hours
        const dayTime = new Date()
        dayTime.setHours(12, 0, 0, 0)
        expect(isQuietHours(prefs, dayTime)).toBe(false)
      })
    })

    describe('canSendNotification', () => {
      const prefs = createNotificationPreferences('user_1', 'tenant_1')

      it('should allow sending for enabled type and channel', () => {
        expect(canSendNotification(prefs, 'run_started', 'email')).toBe(true)
      })

      it('should deny for disabled type', () => {
        expect(canSendNotification(prefs, 'info', 'email')).toBe(false)
      })

      it('should deny for disabled channel', () => {
        expect(canSendNotification(prefs, 'run_started', 'slack')).toBe(false)
      })
    })
  })

  describe('Templates', () => {
    describe('applyTemplate', () => {
      it('should replace variables', () => {
        const template = 'Hello {{name}}, your run {{runId}} has started'
        const result = applyTemplate(template, { name: 'User', runId: 'run_123' })

        expect(result).toBe('Hello User, your run run_123 has started')
      })

      it('should handle multiple occurrences', () => {
        const template = '{{name}} said {{name}}'
        const result = applyTemplate(template, { name: 'Alice' })

        expect(result).toBe('Alice said Alice')
      })
    })

    describe('getDefaultTemplate', () => {
      it('should return template for notification type', () => {
        const template = getDefaultTemplate('run_started', 'slack')

        expect(template.type).toBe('run_started')
        expect(template.subject).toContain('{{runName}}')
        expect(template.variables).toContain('runName')
      })
    })

    describe('extractVariables', () => {
      it('should extract variables from template', () => {
        const variables = extractVariables('Hello {{name}}, your {{item}} is ready')

        expect(variables).toContain('name')
        expect(variables).toContain('item')
        expect(variables).toHaveLength(2)
      })

      it('should return unique variables', () => {
        const variables = extractVariables('{{name}} and {{name}} again')

        expect(variables).toHaveLength(1)
      })
    })
  })

  describe('Labels', () => {
    describe('getNotificationTypeLabel', () => {
      it('should return Japanese labels', () => {
        expect(getNotificationTypeLabel('run_started')).toBe('Run開始')
        expect(getNotificationTypeLabel('approval_required')).toBe('承認依頼')
        expect(getNotificationTypeLabel('error')).toBe('エラー')
      })
    })

    describe('getPriorityLabel', () => {
      it('should return Japanese labels', () => {
        expect(getPriorityLabel('low')).toBe('低')
        expect(getPriorityLabel('normal')).toBe('通常')
        expect(getPriorityLabel('high')).toBe('高')
        expect(getPriorityLabel('urgent')).toBe('緊急')
      })
    })

    describe('getChannelLabel', () => {
      it('should return Japanese labels', () => {
        expect(getChannelLabel('slack')).toBe('Slack')
        expect(getChannelLabel('email')).toBe('メール')
        expect(getChannelLabel('webhook')).toBe('Webhook')
        expect(getChannelLabel('in_app')).toBe('アプリ内')
      })
    })

    describe('getStatusLabel', () => {
      it('should return Japanese labels', () => {
        expect(getStatusLabel('pending')).toBe('送信待ち')
        expect(getStatusLabel('sent')).toBe('送信済み')
        expect(getStatusLabel('failed')).toBe('失敗')
        expect(getStatusLabel('read')).toBe('既読')
      })
    })
  })
})
