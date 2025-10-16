-- Step 1: Create tenant table first
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `subdomain` VARCHAR(191) NOT NULL,
  `domain` VARCHAR(191) NULL,
  `plan` VARCHAR(191) NOT NULL DEFAULT 'free',
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `maxUsers` INTEGER NOT NULL DEFAULT 10,
  `maxLeads` INTEGER NOT NULL DEFAULT 10000,
  `settings` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tenants_subdomain_key`(`subdomain`),
  UNIQUE INDEX `tenants_domain_key`(`domain`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Create a default tenant for existing data
INSERT INTO `tenants` (`id`, `name`, `subdomain`, `plan`, `status`, `maxUsers`, `maxLeads`, `createdAt`, `updatedAt`)
VALUES ('default-tenant-000', 'Default Agency', 'default', 'enterprise', 'active', 100, 100000, NOW(), NOW())
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Step 3: Add tenantId columns as NULLABLE first (ignore if exists)
ALTER TABLE `users` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `leads` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `communications` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `clients` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `tasks` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `products` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `campaigns` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `ai_conversations` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `contact_groups` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `campaign_templates` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- Step 4: Assign all existing data to default tenant
UPDATE `users` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL AND `isSuperAdmin` = 0;
UPDATE `leads` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `communications` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `clients` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `tasks` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `products` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `campaigns` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `ai_conversations` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `contact_groups` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;
UPDATE `campaign_templates` SET `tenantId` = 'default-tenant-000' WHERE `tenantId` IS NULL;

-- Step 5: Make tenantId NOT NULL
ALTER TABLE `leads` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `communications` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `clients` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `tasks` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `products` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `campaigns` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `ai_conversations` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `contact_groups` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `campaign_templates` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- Step 6: Add indexes
ALTER TABLE `users` ADD INDEX `users_tenantId_idx` (`tenantId`);
ALTER TABLE `leads` ADD INDEX `leads_tenantId_idx` (`tenantId`);
ALTER TABLE `leads` ADD INDEX `leads_tenantId_status_idx` (`tenantId`, `status`);
ALTER TABLE `leads` ADD INDEX `leads_tenantId_assignedUserId_idx` (`tenantId`, `assignedUserId`);
ALTER TABLE `communications` ADD INDEX `communications_tenantId_idx` (`tenantId`);
ALTER TABLE `clients` ADD INDEX `clients_tenantId_idx` (`tenantId`);
ALTER TABLE `tasks` ADD INDEX `tasks_tenantId_idx` (`tenantId`);
ALTER TABLE `tasks` ADD INDEX `tasks_tenantId_assignedUserId_idx` (`tenantId`, `assignedUserId`);
ALTER TABLE `products` ADD INDEX `products_tenantId_idx` (`tenantId`);
ALTER TABLE `campaigns` ADD INDEX `campaigns_tenantId_idx` (`tenantId`);
ALTER TABLE `ai_conversations` ADD INDEX `ai_conversations_tenantId_idx` (`tenantId`);
ALTER TABLE `contact_groups` ADD INDEX `contact_groups_tenantId_idx` (`tenantId`);
ALTER TABLE `campaign_templates` ADD INDEX `campaign_templates_tenantId_idx` (`tenantId`);

-- Step 7: Add foreign key constraints
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `communications` ADD CONSTRAINT `communications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clients` ADD CONSTRAINT `clients_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `products` ADD CONSTRAINT `products_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contact_groups` ADD CONSTRAINT `contact_groups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_templates` ADD CONSTRAINT `campaign_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
