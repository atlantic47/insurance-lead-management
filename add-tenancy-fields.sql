-- Add tenantId column to all tenant-specific tables
-- Run this after Prisma migration

ALTER TABLE `communications` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `communications` ADD INDEX `communications_tenantId_idx` (`tenantId`);
ALTER TABLE `communications` ADD CONSTRAINT `communications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `clients` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `clients` ADD INDEX `clients_tenantId_idx` (`tenantId`);
ALTER TABLE `clients` ADD CONSTRAINT `clients_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tasks` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `tasks` ADD INDEX `tasks_tenantId_idx` (`tenantId`);
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `products` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `products` ADD INDEX `products_tenantId_idx` (`tenantId`);
ALTER TABLE `products` ADD CONSTRAINT `products_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campaigns` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `campaigns` ADD INDEX `campaigns_tenantId_idx` (`tenantId`);
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `policies` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `policies` ADD INDEX `policies_tenantId_idx` (`tenantId`);
ALTER TABLE `policies` ADD CONSTRAINT `policies_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_conversations` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `ai_conversations` ADD INDEX `ai_conversations_tenantId_idx` (`tenantId`);
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `contact_groups` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `contact_groups` ADD INDEX `contact_groups_tenantId_idx` (`tenantId`);
ALTER TABLE `contact_groups` ADD CONSTRAINT `contact_groups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campaign_templates` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `campaign_templates` ADD INDEX `campaign_templates_tenantId_idx` (`tenantId`);
ALTER TABLE `campaign_templates` ADD CONSTRAINT `campaign_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create a default tenant for existing data
INSERT INTO `tenants` (`id`, `name`, `subdomain`, `plan`, `status`, `maxUsers`, `maxLeads`, `createdAt`, `updatedAt`)
VALUES ('default-tenant-id', 'Default Agency', 'default', 'enterprise', 'active', 100, 100000, NOW(), NOW());

-- Assign all existing data to default tenant
UPDATE `users` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL AND `isSuperAdmin` = 0;
UPDATE `leads` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `communications` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `clients` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `tasks` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `products` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `campaigns` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `policies` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `ai_conversations` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `contact_groups` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;
UPDATE `campaign_templates` SET `tenantId` = 'default-tenant-id' WHERE `tenantId` IS NULL;

-- Make tenantId required (NOT NULL) after assigning default tenant
ALTER TABLE `communications` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `clients` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `tasks` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `products` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `campaigns` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `policies` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `ai_conversations` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `contact_groups` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
ALTER TABLE `campaign_templates` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;
