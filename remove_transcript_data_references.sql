-- Remove any remaining references to transcript_data field
-- This script will help resolve the error: "record \"new\" has no field \"transcript_data\""

-- 1. Find and drop any triggers on the transcripts table
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'transcripts'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_rec.trigger_name || ' ON transcripts';
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
    END LOOP;
END $$;

-- 2. Find and drop any functions that reference transcript_data
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    FOR func_rec IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_definition LIKE '%transcript_data%'
        AND routine_schema = 'public'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_rec.routine_name || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', func_rec.routine_name;
    END LOOP;
END $$;

-- 3. Drop any views that reference transcript_data
DO $$
DECLARE
    view_rec RECORD;
BEGIN
    FOR view_rec IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE view_definition LIKE '%transcript_data%'
        AND table_schema = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_rec.table_name || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', view_rec.table_name;
    END LOOP;
END $$;

-- 4. Verify the transcripts table structure is correct
SELECT 
    'Current transcripts table structure:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'transcripts';

-- 5. Recreate the transcript_chunks table if it doesn't exist
-- (This ensures the chunking system is properly set up)
CREATE TABLE IF NOT EXISTS transcript_chunks (
    id BIGSERIAL PRIMARY KEY,
    episode_slug TEXT NOT NULL,
    lang TEXT NOT NULL,
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('text', 'utterances')),
    chunk_index INTEGER NOT NULL,
    chunk_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(episode_slug, lang, chunk_type, chunk_index)
);

-- 6. Add chunking_metadata column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transcripts' 
        AND column_name = 'chunking_metadata'
    ) THEN
        ALTER TABLE transcripts ADD COLUMN chunking_metadata JSONB;
        RAISE NOTICE 'Added chunking_metadata column to transcripts table';
    END IF;
END $$;

-- 7. Final verification
SELECT 
    'Cleanup completed. Current database state:' as status,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'transcripts') as remaining_triggers,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_definition LIKE '%transcript_data%' AND routine_schema = 'public') as remaining_functions,
    (SELECT COUNT(*) FROM information_schema.views WHERE view_definition LIKE '%transcript_data%' AND table_schema = 'public') as remaining_views;
