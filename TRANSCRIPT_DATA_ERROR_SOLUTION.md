# Transcript Data Field Error - Solution Guide

## Problem Description

The error `"record \"new\" has no field \"transcript_data\""` occurs because:

1. **Database Schema Mismatch**: The `transcript_data` column was removed from the `transcripts` table
2. **Remaining Database Objects**: There are likely database triggers, functions, or RLS policies that still reference the removed field
3. **PostgreSQL Trigger Error**: The error message indicates a trigger function is trying to access `new.transcript_data` which no longer exists

## Root Cause

When the `transcript_data` column was removed (as documented in `remove_transcript_data_column.sql`), some database objects were not properly cleaned up:

- **Triggers**: Functions that fire on INSERT/UPDATE/DELETE operations
- **Functions**: Stored procedures that might reference the old field
- **RLS Policies**: Row Level Security policies that check field values
- **Views**: Database views that select from the removed field

## Solution Steps

### Step 1: Run Diagnostic Scripts

Execute these SQL scripts in your Supabase SQL Editor to identify the problem:

1. **`check_and_remove_transcript_data_triggers.sql`** - Identifies problematic database objects
2. **`check_rls_policies.sql`** - Checks for RLS policies that might cause issues

### Step 2: Clean Up Database Objects

Run the cleanup script:

**`remove_transcript_data_references.sql`** - This script will:
- Remove all triggers on the `transcripts` table
- Drop functions that reference `transcript_data`
- Remove views that reference `transcript_data`
- Ensure proper table structure
- Recreate the `transcript_chunks` table if needed

### Step 3: Verify the Fix

After running the cleanup scripts, verify that:

1. The `transcripts` table has the correct structure:
   - ✅ `id`, `episode_slug`, `lang`, `status`
   - ✅ `edited_transcript_data` (compact version)
   - ✅ `chunking_metadata` (for chunking system)
   - ❌ `transcript_data` (should NOT exist)

2. The `transcript_chunks` table exists for storing large transcripts

3. No triggers or functions reference `transcript_data`

## Alternative Solutions

### Option A: Temporary RLS Disable

If the issue persists, temporarily disable Row Level Security:

```sql
ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;
-- Test your application
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
```

### Option B: Manual Trigger Cleanup

If you know which specific trigger is causing the issue:

```sql
-- List all triggers on transcripts table
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'transcripts';

-- Drop specific problematic trigger
DROP TRIGGER IF EXISTS trigger_name ON transcripts;
```

## Prevention

To avoid this issue in the future:

1. **Always drop triggers/functions before removing columns**
2. **Use CASCADE when dropping columns that might be referenced**
3. **Test database changes in a staging environment first**
4. **Keep track of all database objects that reference table columns**

## Current Status

- ✅ **Code Updated**: All JavaScript/React code uses `edited_transcript_data`
- ✅ **Column Removed**: `transcript_data` column removed from database
- ❌ **Database Objects**: Some triggers/functions still reference the old field
- 🔧 **Solution Ready**: Cleanup scripts provided above

## Next Steps

1. Run the diagnostic scripts to identify the exact problem
2. Execute the cleanup script to remove problematic objects
3. Test your application to ensure the error is resolved
4. Monitor logs to confirm no more `transcript_data` errors

## Support

If the issue persists after following these steps:

1. Check the Supabase logs for additional error details
2. Verify that all SQL scripts executed successfully
3. Ensure you have the necessary permissions to modify database objects
4. Consider checking if there are any Supabase-specific triggers or functions
