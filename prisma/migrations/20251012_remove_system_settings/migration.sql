-- Drop SystemSettings table - no longer needed
-- All settings now stored in tenant.settings (tenant-specific)
DROP TABLE IF EXISTS `system_settings`;
