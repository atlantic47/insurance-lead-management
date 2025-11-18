/**
 * Automation Enums - Types for WhatsApp automation rules and campaigns
 */

export enum AutomationTriggerType {
  CONVERSATION_WINDOW_EXPIRED = 'CONVERSATION_WINDOW_EXPIRED',
  LABEL_ASSIGNED = 'LABEL_ASSIGNED',
  TIME_DELAY = 'TIME_DELAY',
  MANUAL = 'MANUAL',
}

export enum SendingFrequency {
  ONCE = 'ONCE',
  EVERY_WINDOW = 'EVERY_WINDOW',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum CampaignTargetType {
  ALL_CONTACTS = 'ALL_CONTACTS',
  CONTACT_GROUP = 'CONTACT_GROUP',
  CUSTOM_FILTER = 'CUSTOM_FILTER',
  CSV_UPLOAD = 'CSV_UPLOAD',
  SPECIFIC_CONTACTS = 'SPECIFIC_CONTACTS',
}

export enum SendingSpeed {
  SLOW = 'SLOW',       // 1 message per 5 seconds
  NORMAL = 'NORMAL',   // 1 message per 2 seconds
  FAST = 'FAST',       // 1 message per second
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}
