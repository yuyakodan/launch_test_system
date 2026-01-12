/**
 * Notification System
 * 通知システム（Slack/Email/Webhook）
 */

// 通知チャンネルタイプ
export type NotificationChannel = 'slack' | 'email' | 'webhook' | 'in_app'

// 通知タイプ
export type NotificationType =
  | 'run_started'
  | 'run_completed'
  | 'run_stopped'
  | 'approval_required'
  | 'approval_completed'
  | 'budget_alert'
  | 'performance_alert'
  | 'auto_stop_triggered'
  | 'winner_declared'
  | 'error'
  | 'info'

// 通知優先度
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

// 通知ステータス
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read'

// 通知
export interface Notification {
  id: string
  tenantId: string
  type: NotificationType
  priority: NotificationPriority
  channel: NotificationChannel
  recipients: NotificationRecipient[]
  subject: string
  message: string
  data?: Record<string, unknown>
  status: NotificationStatus
  sentAt?: string
  readAt?: string
  error?: string
  createdAt: string
}

// 通知受信者
export interface NotificationRecipient {
  type: 'user' | 'channel' | 'webhook'
  target: string // userId, channelId, or webhook URL
  name?: string
}

// Slack設定
export interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
}

// Email設定
export interface EmailConfig {
  from: string
  smtpHost?: string
  smtpPort?: number
}

// Webhook設定
export interface WebhookConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  secret?: string
}

// 通知設定
export interface NotificationPreferences {
  userId: string
  tenantId: string
  channels: ChannelPreference[]
  enabledTypes: NotificationType[]
  quietHours?: QuietHours
}

// チャンネル設定
export interface ChannelPreference {
  channel: NotificationChannel
  enabled: boolean
  config?: SlackConfig | EmailConfig | WebhookConfig
}

// 通知停止時間
export interface QuietHours {
  enabled: boolean
  start: string // HH:mm
  end: string // HH:mm
  timezone: string
}

// 通知テンプレート
export interface NotificationTemplate {
  type: NotificationType
  channel: NotificationChannel
  subject: string
  body: string
  variables: string[]
}

// Slackメッセージ
export interface SlackMessage {
  text: string
  channel?: string
  username?: string
  icon_emoji?: string
  attachments?: SlackAttachment[]
  blocks?: SlackBlock[]
}

// Slack添付
export interface SlackAttachment {
  color?: string
  title?: string
  text?: string
  fields?: SlackField[]
  footer?: string
  ts?: number
}

// Slackフィールド
export interface SlackField {
  title: string
  value: string
  short?: boolean
}

// Slackブロック
export interface SlackBlock {
  type: 'section' | 'divider' | 'actions' | 'context' | 'header'
  text?: {
    type: 'plain_text' | 'mrkdwn'
    text: string
  }
  fields?: {
    type: 'plain_text' | 'mrkdwn'
    text: string
  }[]
  accessory?: unknown
}

// Webhookペイロード
export interface WebhookPayload {
  event: NotificationType
  timestamp: string
  data: Record<string, unknown>
  signature?: string
}

/**
 * 通知IDを生成
 */
export function generateNotificationId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `notif_${timestamp}_${random}`
}

/**
 * 通知を作成
 */
export function createNotification(
  tenantId: string,
  type: NotificationType,
  channel: NotificationChannel,
  recipients: NotificationRecipient[],
  subject: string,
  message: string,
  options?: {
    priority?: NotificationPriority
    data?: Record<string, unknown>
  }
): Notification {
  return {
    id: generateNotificationId(),
    tenantId,
    type,
    priority: options?.priority || getDefaultPriority(type),
    channel,
    recipients,
    subject,
    message,
    data: options?.data,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

/**
 * デフォルト優先度を取得
 */
export function getDefaultPriority(type: NotificationType): NotificationPriority {
  const priorityMap: Record<NotificationType, NotificationPriority> = {
    run_started: 'normal',
    run_completed: 'normal',
    run_stopped: 'high',
    approval_required: 'high',
    approval_completed: 'normal',
    budget_alert: 'high',
    performance_alert: 'high',
    auto_stop_triggered: 'urgent',
    winner_declared: 'normal',
    error: 'urgent',
    info: 'low',
  }
  return priorityMap[type]
}

/**
 * 通知を送信済みに更新
 */
export function markAsSent(notification: Notification): Notification {
  return {
    ...notification,
    status: 'sent',
    sentAt: new Date().toISOString(),
  }
}

/**
 * 通知を失敗に更新
 */
export function markAsFailed(notification: Notification, error: string): Notification {
  return {
    ...notification,
    status: 'failed',
    error,
  }
}

/**
 * 通知を既読に更新
 */
export function markAsRead(notification: Notification): Notification {
  return {
    ...notification,
    status: 'read',
    readAt: new Date().toISOString(),
  }
}

/**
 * Slackメッセージを作成
 */
export function createSlackMessage(
  notification: Notification,
  config?: SlackConfig
): SlackMessage {
  const color = getNotificationColor(notification.type)

  return {
    text: notification.subject,
    channel: config?.channel,
    username: config?.username || 'Launch Test System',
    icon_emoji: config?.iconEmoji || getNotificationEmoji(notification.type),
    attachments: [
      {
        color,
        title: notification.subject,
        text: notification.message,
        fields: notification.data
          ? Object.entries(notification.data).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            }))
          : undefined,
        footer: 'Launch Test System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }
}

/**
 * Slackブロックメッセージを作成
 */
export function createSlackBlockMessage(
  notification: Notification,
  config?: SlackConfig
): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${getNotificationEmoji(notification.type)} ${notification.subject}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: notification.message,
      },
    },
  ]

  if (notification.data && Object.keys(notification.data).length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      fields: Object.entries(notification.data).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${key}:*\n${String(value)}`,
      })),
    })
  }

  return {
    text: notification.subject,
    channel: config?.channel,
    username: config?.username || 'Launch Test System',
    icon_emoji: config?.iconEmoji || getNotificationEmoji(notification.type),
    blocks,
  }
}

/**
 * 通知タイプに応じた色を取得
 */
export function getNotificationColor(type: NotificationType): string {
  const colorMap: Record<NotificationType, string> = {
    run_started: '#36a64f', // green
    run_completed: '#36a64f', // green
    run_stopped: '#ff9800', // orange
    approval_required: '#2196f3', // blue
    approval_completed: '#36a64f', // green
    budget_alert: '#ff9800', // orange
    performance_alert: '#ff9800', // orange
    auto_stop_triggered: '#f44336', // red
    winner_declared: '#9c27b0', // purple
    error: '#f44336', // red
    info: '#607d8b', // gray
  }
  return colorMap[type]
}

/**
 * 通知タイプに応じた絵文字を取得
 */
export function getNotificationEmoji(type: NotificationType): string {
  const emojiMap: Record<NotificationType, string> = {
    run_started: ':rocket:',
    run_completed: ':white_check_mark:',
    run_stopped: ':stop_sign:',
    approval_required: ':clipboard:',
    approval_completed: ':thumbsup:',
    budget_alert: ':moneybag:',
    performance_alert: ':chart_with_downwards_trend:',
    auto_stop_triggered: ':rotating_light:',
    winner_declared: ':trophy:',
    error: ':x:',
    info: ':information_source:',
  }
  return emojiMap[type]
}

/**
 * Webhookペイロードを作成
 */
export function createWebhookPayload(
  notification: Notification,
  secret?: string
): WebhookPayload {
  const payload: WebhookPayload = {
    event: notification.type,
    timestamp: new Date().toISOString(),
    data: {
      id: notification.id,
      tenantId: notification.tenantId,
      subject: notification.subject,
      message: notification.message,
      priority: notification.priority,
      ...notification.data,
    },
  }

  if (secret) {
    payload.signature = generateWebhookSignature(JSON.stringify(payload.data), secret)
  }

  return payload
}

/**
 * Webhook署名を生成
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  // Simple HMAC-like signature (in real implementation, use crypto)
  let hash = 0
  const combined = payload + secret
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `sha256=${Math.abs(hash).toString(16).padStart(16, '0')}`
}

/**
 * Webhook署名を検証
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateWebhookSignature(payload, secret)
  return signature === expected
}

/**
 * Emailコンテンツを作成
 */
export function createEmailContent(notification: Notification): {
  subject: string
  text: string
  html: string
} {
  const dataHtml = notification.data
    ? Object.entries(notification.data)
        .map(([key, value]) => `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`)
        .join('')
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background: ${getNotificationColor(notification.type)}; color: white; padding: 20px; }
    .content { padding: 20px; }
    .data-table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    .data-table td { border: 1px solid #ddd; padding: 8px; }
    .footer { background: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${notification.subject}</h2>
  </div>
  <div class="content">
    <p>${notification.message}</p>
    ${dataHtml ? `<table class="data-table">${dataHtml}</table>` : ''}
  </div>
  <div class="footer">
    Launch Test System
  </div>
</body>
</html>`.trim()

  const dataText = notification.data
    ? Object.entries(notification.data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    : ''

  const text = `${notification.subject}\n\n${notification.message}\n\n${dataText}\n\n---\nLaunch Test System`

  return {
    subject: notification.subject,
    text,
    html,
  }
}

/**
 * 通知設定を作成
 */
export function createNotificationPreferences(
  userId: string,
  tenantId: string
): NotificationPreferences {
  return {
    userId,
    tenantId,
    channels: [
      { channel: 'in_app', enabled: true },
      { channel: 'email', enabled: true },
      { channel: 'slack', enabled: false },
      { channel: 'webhook', enabled: false },
    ],
    enabledTypes: [
      'run_started',
      'run_completed',
      'run_stopped',
      'approval_required',
      'approval_completed',
      'budget_alert',
      'performance_alert',
      'auto_stop_triggered',
      'winner_declared',
      'error',
    ],
  }
}

/**
 * チャンネルが有効かチェック
 */
export function isChannelEnabled(
  preferences: NotificationPreferences,
  channel: NotificationChannel
): boolean {
  const pref = preferences.channels.find((c) => c.channel === channel)
  return pref?.enabled ?? false
}

/**
 * 通知タイプが有効かチェック
 */
export function isTypeEnabled(
  preferences: NotificationPreferences,
  type: NotificationType
): boolean {
  return preferences.enabledTypes.includes(type)
}

/**
 * 現在が静粛時間帯かチェック
 */
export function isQuietHours(
  preferences: NotificationPreferences,
  now = new Date()
): boolean {
  if (!preferences.quietHours?.enabled) {
    return false
  }

  const { start, end } = preferences.quietHours
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (start <= end) {
    // Same day range (e.g., 09:00 to 17:00)
    return currentTime >= start && currentTime <= end
  } else {
    // Overnight range (e.g., 22:00 to 06:00)
    return currentTime >= start || currentTime <= end
  }
}

/**
 * 通知を送信可能かチェック
 */
export function canSendNotification(
  preferences: NotificationPreferences,
  type: NotificationType,
  channel: NotificationChannel,
  now = new Date()
): boolean {
  // Check if type is enabled
  if (!isTypeEnabled(preferences, type)) {
    return false
  }

  // Check if channel is enabled
  if (!isChannelEnabled(preferences, channel)) {
    return false
  }

  // Check quiet hours (only for non-urgent notifications)
  const priority = getDefaultPriority(type)
  if (priority !== 'urgent' && isQuietHours(preferences, now)) {
    return false
  }

  return true
}

/**
 * テンプレート変数を置換
 */
export function applyTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }

  return result
}

/**
 * デフォルトテンプレートを取得
 */
export function getDefaultTemplate(
  type: NotificationType,
  channel: NotificationChannel
): NotificationTemplate {
  const templates: Record<NotificationType, { subject: string; body: string }> = {
    run_started: {
      subject: 'Run「{{runName}}」が開始されました',
      body: 'Run「{{runName}}」が{{startedBy}}によって開始されました。',
    },
    run_completed: {
      subject: 'Run「{{runName}}」が完了しました',
      body: 'Run「{{runName}}」が正常に完了しました。結果を確認してください。',
    },
    run_stopped: {
      subject: 'Run「{{runName}}」が停止されました',
      body: 'Run「{{runName}}」が{{stoppedBy}}によって停止されました。理由: {{reason}}',
    },
    approval_required: {
      subject: '承認が必要です: {{targetName}}',
      body: '{{targetName}}の承認が{{requestedBy}}より依頼されています。',
    },
    approval_completed: {
      subject: '承認完了: {{targetName}}',
      body: '{{targetName}}が{{approvedBy}}によって承認されました。',
    },
    budget_alert: {
      subject: '予算アラート: {{runName}}',
      body: 'Run「{{runName}}」の消化率が{{percentage}}%に達しました。',
    },
    performance_alert: {
      subject: 'パフォーマンスアラート: {{runName}}',
      body: 'Run「{{runName}}」の{{metric}}が閾値を{{direction}}しました。現在値: {{value}}',
    },
    auto_stop_triggered: {
      subject: '自動停止: {{runName}}',
      body: 'Run「{{runName}}」が{{condition}}により自動停止されました。',
    },
    winner_declared: {
      subject: '勝者決定: {{runName}}',
      body: 'Run「{{runName}}」でバリアント「{{winnerName}}」が勝者に決定しました。改善率: {{improvement}}%',
    },
    error: {
      subject: 'エラー発生: {{source}}',
      body: '{{source}}でエラーが発生しました: {{errorMessage}}',
    },
    info: {
      subject: '{{title}}',
      body: '{{message}}',
    },
  }

  const template = templates[type]

  return {
    type,
    channel,
    subject: template.subject,
    body: template.body,
    variables: extractVariables(template.subject + template.body),
  }
}

/**
 * テンプレートから変数を抽出
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/{{(\w+)}}/g) || []
  return [...new Set(matches.map((m) => m.replace(/{{|}}/g, '')))]
}

/**
 * 通知タイプのラベルを取得
 */
export function getNotificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    run_started: 'Run開始',
    run_completed: 'Run完了',
    run_stopped: 'Run停止',
    approval_required: '承認依頼',
    approval_completed: '承認完了',
    budget_alert: '予算アラート',
    performance_alert: 'パフォーマンスアラート',
    auto_stop_triggered: '自動停止',
    winner_declared: '勝者決定',
    error: 'エラー',
    info: '情報',
  }
  return labels[type]
}

/**
 * 優先度のラベルを取得
 */
export function getPriorityLabel(priority: NotificationPriority): string {
  const labels: Record<NotificationPriority, string> = {
    low: '低',
    normal: '通常',
    high: '高',
    urgent: '緊急',
  }
  return labels[priority]
}

/**
 * チャンネルのラベルを取得
 */
export function getChannelLabel(channel: NotificationChannel): string {
  const labels: Record<NotificationChannel, string> = {
    slack: 'Slack',
    email: 'メール',
    webhook: 'Webhook',
    in_app: 'アプリ内',
  }
  return labels[channel]
}

/**
 * 通知ステータスのラベルを取得
 */
export function getStatusLabel(status: NotificationStatus): string {
  const labels: Record<NotificationStatus, string> = {
    pending: '送信待ち',
    sent: '送信済み',
    failed: '失敗',
    read: '既読',
  }
  return labels[status]
}
