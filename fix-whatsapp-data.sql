-- Fix WhatsApp Data Migration Script
-- This script fixes the database inconsistencies in WhatsApp conversations

USE insurance_lead_db;

-- 1. Update existing conversations to be WHATSAPP_CHAT type
UPDATE ai_conversations 
SET 
    type = 'WHATSAPP_CHAT',
    metadata = JSON_OBJECT(
        'phoneNumber', '+15550935798',
        'customerName', 'WhatsApp Customer',
        'status', 'active',
        'platform', 'WHATSAPP',
        'createdBy', 'webhook'
    )
WHERE id IN (
    SELECT DISTINCT conversationId 
    FROM chat_messages 
    WHERE platform = 'WHATSAPP' 
    AND conversationId IS NOT NULL
);

-- 2. Create a main WhatsApp conversation for orphaned messages
INSERT INTO ai_conversations (id, type, input, output, confidence, metadata, isEscalated)
VALUES (
    'whatsapp-main-conversation-2025',
    'WHATSAPP_CHAT',
    'WhatsApp conversation started',
    'AI Assistant initialized',
    1.0,
    JSON_OBJECT(
        'phoneNumber', '+15550935798',
        'customerName', 'WhatsApp User', 
        'status', 'active',
        'platform', 'WHATSAPP',
        'createdBy', 'migration'
    ),
    false
) ON DUPLICATE KEY UPDATE metadata = VALUES(metadata);

-- 3. Link all orphaned WhatsApp messages to the main conversation
UPDATE chat_messages 
SET conversationId = 'whatsapp-main-conversation-2025'
WHERE platform = 'WHATSAPP' 
AND conversationId IS NULL;

-- 4. Create Lead records for WhatsApp conversations if they don't exist
INSERT IGNORE INTO leads (
    id,
    firstName,
    lastName,
    phone,
    email,
    source,
    status,
    insuranceType,
    notes
)
SELECT 
    CONCAT('whatsapp-lead-', UUID()),
    'WhatsApp',
    'Customer',
    '+15550935798',
    'whatsapp_customer@temp.com',
    'WHATSAPP',
    'NEW',
    'AUTO',
    'Auto-created from WhatsApp conversation'
FROM ai_conversations 
WHERE type = 'WHATSAPP_CHAT'
AND NOT EXISTS (
    SELECT 1 FROM leads WHERE phone = '+15550935798' OR phone = '15550935798'
);

-- 5. Show final status
SELECT 'WhatsApp Conversations' as table_name, COUNT(*) as count 
FROM ai_conversations WHERE type = 'WHATSAPP_CHAT'
UNION ALL
SELECT 'WhatsApp Messages', COUNT(*) 
FROM chat_messages WHERE platform = 'WHATSAPP'
UNION ALL
SELECT 'WhatsApp Messages with Conversation', COUNT(*) 
FROM chat_messages WHERE platform = 'WHATSAPP' AND conversationId IS NOT NULL
UNION ALL
SELECT 'WhatsApp Leads', COUNT(*) 
FROM leads WHERE source = 'WHATSAPP';