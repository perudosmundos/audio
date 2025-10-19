-- Add Hostinger storage columns to episodes table
-- Migration: Add storage provider tracking and Hostinger file keys

-- Add storage_provider column
ALTER TABLE episodes
ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) DEFAULT 'r2';

-- Add hostinger_file_key column for tracking Hostinger file names
ALTER TABLE episodes
ADD COLUMN IF NOT EXISTS hostinger_file_key VARCHAR(255);

-- Create index for storage_provider for faster queries
CREATE INDEX IF NOT EXISTS idx_episodes_storage_provider 
ON episodes(storage_provider);

-- Add comment to document the migration
COMMENT ON COLUMN episodes.storage_provider IS 'Storage provider: r2 (old) or hostinger (new)';
COMMENT ON COLUMN episodes.hostinger_file_key IS 'File name on Hostinger SFTP server';
