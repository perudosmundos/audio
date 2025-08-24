-- Check and remove any triggers or functions that reference the removed transcript_data field
-- This script will help resolve the error: "record \"new\" has no field \"transcript_data\""

-- 1. Check for triggers on the transcripts table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'transcripts';

-- 2. Check for functions that might reference transcript_data
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%transcript_data%'
AND routine_schema = 'public';

-- 3. Check for any views that might reference transcript_data
SELECT 
    table_name,
    view_definition
FROM information_schema.views 
WHERE view_definition LIKE '%transcript_data%'
AND table_schema = 'public';

-- 4. Drop any triggers that might be causing issues
-- (Uncomment and run these if you find problematic triggers)

-- DROP TRIGGER IF EXISTS trigger_name ON transcripts;

-- 5. Drop any functions that reference transcript_data
-- (Uncomment and run these if you find problematic functions)

-- DROP FUNCTION IF EXISTS function_name();

-- 6. Check current table structure to confirm transcript_data is gone
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transcripts'
ORDER BY ordinal_position;

-- 7. Verify the table has the correct columns
SELECT 
    'transcripts' as table_name,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'transcripts';
