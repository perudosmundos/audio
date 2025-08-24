-- Check for Row Level Security (RLS) policies that might reference transcript_data
-- RLS policies can sometimes cause the "record \"new\" has no field" error

-- 1. Check if RLS is enabled on the transcripts table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'transcripts';

-- 2. Check for RLS policies on the transcripts table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'transcripts';

-- 3. Check for any policies that might reference transcript_data
SELECT 
    p.policyname,
    p.cmd,
    p.qual,
    p.with_check
FROM pg_policies p
WHERE p.tablename = 'transcripts'
AND (
    p.qual::text LIKE '%transcript_data%' 
    OR p.with_check::text LIKE '%transcript_data%'
);

-- 4. If problematic policies are found, drop them
-- (Uncomment and run these if you find problematic policies)

-- DROP POLICY IF EXISTS policy_name ON transcripts;

-- 5. Check for any default RLS policies
SELECT 
    'Default RLS policies on transcripts table:' as info,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'transcripts') as total_policies;

-- 6. Disable RLS temporarily if needed for testing
-- ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;

-- 7. Re-enable RLS after cleanup if needed
-- ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
