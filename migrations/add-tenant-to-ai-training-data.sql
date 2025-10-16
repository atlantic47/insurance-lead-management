-- Migration: Add tenantId to ai_training_data table
-- Date: 2025-10-16
-- Description: Adds tenant isolation to AI training data

-- Step 1: Add tenantId column (nullable first to allow existing data)
ALTER TABLE `ai_training_data`
ADD COLUMN `tenantId` VARCHAR(191) NULL AFTER `processedAt`;

-- Step 2: Add index on tenantId for performance
ALTER TABLE `ai_training_data`
ADD INDEX `ai_training_data_tenantId_idx` (`tenantId`);

-- Step 3: Add foreign key constraint
ALTER TABLE `ai_training_data`
ADD CONSTRAINT `ai_training_data_tenantId_fkey`
FOREIGN KEY (`tenantId`)
REFERENCES `tenants`(`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Step 4: IMPORTANT - Update existing records
-- You must manually set tenantId for existing records before making it NOT NULL
-- Example: UPDATE ai_training_data SET tenantId = 'your-tenant-id' WHERE tenantId IS NULL;

-- Step 5: After updating all records, make tenantId NOT NULL
-- Uncomment and run after updating existing data:
-- ALTER TABLE `ai_training_data` MODIFY COLUMN `tenantId` VARCHAR(191) NOT NULL;

-- Verification query
SELECT
  COUNT(*) as total_records,
  COUNT(tenantId) as records_with_tenant,
  COUNT(*) - COUNT(tenantId) as records_without_tenant
FROM ai_training_data;
