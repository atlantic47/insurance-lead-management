-- AlterTable ChatMessage: Add tenantId column and foreign key
-- Step 1: Add tenantId column (nullable first to avoid errors on existing data)
ALTER TABLE `chat_messages` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- Step 2: Set a default tenantId for existing records (use the first tenant or create a default)
-- WARNING: This assumes you have at least one tenant. Adjust the query based on your data.
UPDATE `chat_messages` cm
LEFT JOIN `ai_conversations` ac ON cm.conversationId = ac.id
SET cm.tenantId = COALESCE(ac.tenantId, (SELECT id FROM tenants LIMIT 1))
WHERE cm.tenantId IS NULL;

-- Step 3: Make tenantId NOT NULL
ALTER TABLE `chat_messages` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add index for performance
CREATE INDEX `chat_messages_tenantId_idx` ON `chat_messages`(`tenantId`);


-- AlterTable EmailMessage: Add tenantId column and foreign key
-- Step 1: Add tenantId column (nullable first)
ALTER TABLE `email_messages` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- Step 2: Set a default tenantId for existing records based on linked leads
UPDATE `email_messages` em
LEFT JOIN `leads` l ON em.leadId = l.id
SET em.tenantId = COALESCE(l.tenantId, (SELECT id FROM tenants LIMIT 1))
WHERE em.tenantId IS NULL;

-- Step 3: Make tenantId NOT NULL
ALTER TABLE `email_messages` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add index for performance
CREATE INDEX `email_messages_tenantId_idx` ON `email_messages`(`tenantId`);
