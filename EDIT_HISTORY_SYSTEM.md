# Edit History & Authentication System

## Overview

This system provides a complete solution for tracking, managing, and rolling back text edits with user authentication. It's designed to allow authorized editors to make changes to content while maintaining a complete audit trail.

## Features

### 1. **Editor Authentication**
- Email and name-based authentication (Latin characters only)
- Persistent login using localStorage
- No passwords required - simple identification system
- Automatic session management

### 2. **Edit History Tracking**
- Complete before/after content recording
- Metadata including file path, line number, column number
- Timestamp for every edit
- Editor information (name, email) stored with each edit
- Support for different edit types (text_edit, translation, transcript, etc.)
- Support for different target types (ui_element, episode, question, segment)

### 3. **Admin Panel** (`/edit`)
- View all edits across the system
- Advanced filtering:
  - By editor
  - By edit type
  - By target type
  - By content (search)
  - Show/hide rolled back edits
- Rollback functionality with reason tracking
- Statistics dashboard showing:
  - Total edits
  - Active edits
  - Rolled back edits
  - Recent activity (24h, 7d)
- Detailed diff view (before/after comparison)

### 4. **User Edit History** (Settings Panel)
- Personal edit history for logged-in editors
- Self-service rollback capability
- Statistics showing active and rolled back edits
- Quick access from settings

## Database Schema

### Tables

#### `user_editors`
Stores editor information:
- `id` - UUID primary key
- `email` - Unique email (Latin characters only)
- `name` - Editor name (Latin characters only)
- `created_at` - Account creation timestamp
- `last_login` - Last authentication timestamp
- `is_active` - Account status

#### `edit_history`
Stores complete edit history:
- `id` - UUID primary key
- `editor_id` - Reference to user_editors
- `editor_email` - Denormalized for quick queries
- `editor_name` - Denormalized for quick queries
- `edit_type` - Type of edit (text_edit, translation, etc.)
- `target_type` - What was edited (episode, question, segment, ui_element)
- `target_id` - ID or slug of edited item
- `file_path` - For UI element edits
- `content_before` - Content before edit
- `content_after` - Content after edit
- `created_at` - Edit timestamp
- `is_rolled_back` - Rollback status
- `rolled_back_at` - Rollback timestamp
- `rolled_back_by` - Reference to editor who rolled back
- `rollback_reason` - Reason for rollback
- `metadata` - JSONB for additional context

### Views

#### `edit_history_with_editor`
Joins edit_history with user_editors to provide complete information including rollback details.

### Functions

#### `get_or_create_editor(p_email, p_name)`
- Gets existing editor or creates new one
- Updates last_login timestamp
- Returns editor ID

#### `rollback_edit(p_edit_id, p_rolled_back_by_email, p_rollback_reason)`
- Marks an edit as rolled back
- Records who performed the rollback and why
- Returns edit data needed for content restoration

## Usage

### 1. Apply Database Migrations

Run the migration file to create the necessary tables:

```bash
# Apply the migration to your Supabase project
supabase migration up
```

Or apply manually through Supabase dashboard:
```sql
-- Execute the contents of:
supabase/migrations/20251019_create_edit_history_system.sql
```

### 2. Authentication

Users can authenticate in two ways:

**From Settings:**
1. Click Settings button (bottom right)
2. Navigate to "Edit History" tab
3. Click "Login as Editor"
4. Enter email and name (Latin characters only)

**From Admin Panel:**
1. Navigate to `/edit`
2. Click "Authenticate" button
3. Enter credentials

### 3. Making Edits

Once authenticated, all edits made through the visual editor will be:
1. Checked for authentication
2. Saved to edit history
3. Trackable and rollbackable

### 4. Admin Panel (`/edit`)

Access the admin panel at `/edit` to:
- View all system edits
- Filter and search edits
- Rollback incorrect edits
- Monitor editor activity
- View statistics

**Key Features:**
- Real-time filtering
- Search across content
- One-click rollback with reason
- Before/after diff view
- Editor activity tracking

### 5. User Edit History (Settings)

Users can view their own edits in Settings:
1. Open Settings
2. Go to "Edit History" tab
3. View personal edit history
4. Rollback own edits if needed

## Integration

### React Components

**EditorAuthProvider**
Wrap your app with this provider:
```jsx
import { EditorAuthProvider } from '@/contexts/EditorAuthContext';

<EditorAuthProvider>
  <YourApp />
</EditorAuthProvider>
```

**Use Editor Auth Hook**
```jsx
import { useEditorAuth } from '@/contexts/EditorAuthContext';

function MyComponent() {
  const { editor, isAuthenticated, login, logout } = useEditorAuth();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <EditorAuthModal />;
  }
  
  // Use editor info
  console.log(editor.name, editor.email);
}
```

**Save Edit to History**
```jsx
import { saveEditToHistory } from '@/services/editHistoryService';

await saveEditToHistory({
  editorId: editor.id,
  editorEmail: editor.email,
  editorName: editor.name,
  editType: 'text_edit',
  targetType: 'ui_element',
  targetId: 'unique-id',
  contentBefore: 'old text',
  contentAfter: 'new text',
  filePath: 'src/components/Example.jsx',
  metadata: {
    line: 42,
    column: 10,
    language: 'en'
  }
});
```

### Service Functions

**Edit History Service** (`src/services/editHistoryService.js`):

- `saveEditToHistory(params)` - Save an edit to history
- `getEditorHistory(email, limit, offset)` - Get edits for a specific editor
- `getAllEditHistory(filters, limit, offset)` - Get all edits with filtering
- `rollbackEdit(editId, email, reason)` - Rollback an edit
- `applyRollback(edit)` - Apply the rollback to restore content
- `getTargetHistory(targetType, targetId)` - Get history for a specific target
- `getEditStats(email)` - Get statistics
- `getAllEditors()` - Get all editors

## Security Considerations

1. **No Password Authentication**: This system uses email + name only. It's designed for internal use where trust is assumed.

2. **Latin Characters Only**: Email and name validation ensures only Latin characters, spaces, and hyphens.

3. **Client-Side Storage**: Editor credentials are stored in localStorage for convenience.

4. **Audit Trail**: Complete edit history provides accountability.

## Validation Rules

### Email
- Must be valid email format
- Only Latin characters allowed: `A-Za-z0-9._%-@`
- Example: `john.doe@example.com`

### Name
- Only Latin characters, spaces, and hyphens
- Pattern: `^[A-Za-z\s\-]+$`
- Example: `John Doe`, `Mary-Jane Smith`

## API Endpoints

The system integrates with existing endpoints:

- `/api/apply-edit` - Apply visual editor edits (enhanced with auth checking)

## Rollback Process

### For UI Elements (Visual Editor):
1. Admin/User clicks "Rollback"
2. System marks edit as rolled back in database
3. System calls `/api/apply-edit` with `content_before`
4. File is updated with previous content
5. Success confirmation shown

### For Other Content Types:
Currently logged but not automatically applied. Future enhancements can add:
- Transcript segment rollback
- Episode metadata rollback
- Question rollback

## Future Enhancements

1. **Role-Based Access Control**
   - Admin vs Editor roles
   - Permissions system

2. **Email Notifications**
   - Notify when edits are rolled back
   - Daily/weekly edit summaries

3. **Advanced Rollback**
   - Batch rollback
   - Rollback preview
   - Automatic content restoration for all target types

4. **Analytics**
   - Editor performance metrics
   - Content quality tracking
   - Edit patterns analysis

5. **Review Workflow**
   - Require review before edits go live
   - Multi-stage approval process

## Troubleshooting

### Authentication Issues
- Clear localStorage: `localStorage.removeItem('editor_auth')`
- Check browser console for errors
- Verify Supabase connection

### Edit History Not Saving
- Check Supabase table permissions
- Verify editor ID exists in user_editors table
- Check browser console for errors

### Rollback Not Working
- Verify edit exists and is not already rolled back
- Check file permissions for UI element rollbacks
- Review error logs in browser console

## Support

For issues or questions, check:
1. Browser console for error messages
2. Supabase dashboard for database errors
3. Network tab for API call failures

## Files Created

### Database
- `supabase/migrations/20251019_create_edit_history_system.sql`

### Contexts
- `src/contexts/EditorAuthContext.jsx`

### Services
- `src/services/editHistoryService.js`
- `src/lib/enhancedEditMode.js`

### Components
- `src/components/EditorAuthModal.jsx`
- `src/components/UserEditHistory.jsx`

### Pages
- `src/pages/EditHistoryAdminPage.jsx`

### Updated Files
- `src/App.jsx` - Added EditorAuthProvider and /edit route
- `src/components/SettingsButton.jsx` - Added Edit History tab
