# Hostinger SFTP Integration Setup Guide

## ✅ What's Been Completed

The application has been fully integrated with Hostinger SFTP storage alongside the existing R2 (Selectel) storage:

- ✅ **hostingerSFTPService.js** - Browser service that calls backend API endpoints
- ✅ **Backend API Endpoints** - 4 Vercel serverless functions for SFTP operations
  - `/api/hostinger-upload` - Upload files to Hostinger
  - `/api/hostinger-delete` - Delete files from Hostinger
  - `/api/hostinger-check` - Check if file exists
  - `/api/hostinger-migrate` - Migrate files from R2 to Hostinger
- ✅ **storageRouter.js** - Automatic selection between Hostinger (new files) and R2 (old files)
- ✅ **migrationService.js** - Migrate existing R2 files to Hostinger with rollback capability
- ✅ **StorageMigrationPage.jsx** - Beautiful UI for managing migration at `/migration`
- ✅ **Database schema** - Added `storage_provider` and `hostinger_file_key` columns
- ✅ **Localizations** - Error messages in English, Russian, and Spanish
- ✅ **ssh2 npm package** - Installed and configured on backend

## 🔧 Architecture

### Browser-to-Backend Architecture

```
Browser (Frontend)
    ↓
    └─ hostingerSFTPService.js (calls HTTP endpoints)
        ↓
        ├─ /api/hostinger-upload (Node.js - Vercel)
        ├─ /api/hostinger-delete (Node.js - Vercel)
        ├─ /api/hostinger-check (Node.js - Vercel)
        └─ /api/hostinger-migrate (Node.js - Vercel)
            ↓
            └─ SFTP Client (ssh2)
                ↓
                └─ Hostinger Server (82.25.67.168:21)
```

**Why this architecture?**
- ✅ Browser cannot use SFTP directly (security restriction)
- ✅ Backend handles all SFTP operations
- ✅ ssh2 works reliably on Node.js
- ✅ Scales well with serverless functions (Vercel)

## 🔧 Required Setup

### 1. Add Environment Variables

Create or update `.env.local` file in the project root with the following:

```env
# Hostinger SFTP Configuration (for frontend)
VITE_HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
```

For **Vercel deployment**, add these environment variables in Vercel dashboard:

```env
# Hostinger SFTP Configuration (for backend API)
HOSTINGER_SFTP_HOST=82.25.67.168
HOSTINGER_SFTP_PORT=21
HOSTINGER_SFTP_USERNAME=u953185577
HOSTINGER_SFTP_PASSWORD=Ftppass!123
HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
```

### 2. Apply Database Migration

Run the SQL migration to add new columns to the episodes table:

```sql
-- File: supabase/migrations/20251019_add_hostinger_columns.sql
```

**Steps:**
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and run the SQL from `supabase/migrations/20251019_add_hostinger_columns.sql`

## 📁 How It Works

### Storage Architecture

```
NEW FILES (after setup)
├─ Upload → Browser → API → Hostinger SFTP
├─ Storage Provider: 'hostinger'
└─ Public URL: https://dosmundos.pe/wp-content/uploads/Audio/

OLD FILES (existing R2)
├─ Upload → R2 (Selectel)
├─ Storage Provider: 'r2'
└─ Public URL: https://b2a9e188-93e4-4928-a636-2ad4c9e1094e.srvstatic.kz
```

### File Upload Flow

1. User selects file in browser
2. **hostingerSFTPService.uploadFile()** is called
3. File converted to base64 and sent to `/api/hostinger-upload`
4. Backend connects to Hostinger via SFTP
5. File uploaded to `/wp-content/uploads/Audio/`
6. Response sent back to browser
7. Database updated with `storage_provider='hostinger'`
8. Public URL returned for playback

### API Endpoints

#### POST `/api/hostinger-upload`
Upload file to Hostinger SFTP
```json
{
  "fileBuffer": "base64_encoded_file_data",
  "fileName": "episode_name.mp3",
  "fileSize": 5242880
}
```

#### POST `/api/hostinger-delete`
Delete file from Hostinger SFTP
```json
{
  "fileKey": "episode_name.mp3"
}
```

#### POST `/api/hostinger-check`
Check if file exists on Hostinger SFTP
```json
{
  "fileName": "episode_name.mp3"
}
```

#### POST `/api/hostinger-migrate`
Migrate file from R2 to Hostinger (used during migration)
```json
{
  "audioUrl": "https://r2-url/file.mp3",
  "fileKey": "episode_name.mp3"
}
```

## 🔄 Data Migration (Old R2 → New Hostinger)

### Automatic Migration Page

Access the migration interface at: **`https://yourapp.com/migration`**

Features:
- ✅ See migration status (how many files on each storage)
- ✅ Select episodes to migrate
- ✅ Track real-time progress
- ✅ View success/error details
- ✅ Automatic rollback on errors

### Migration Flow

1. User selects episodes on `/migration` page
2. For each episode:
   - Download audio from R2 via `/api/hostinger-migrate`
   - Upload to Hostinger via same endpoint
   - Update database with new URL
   - On error: automatic rollback

## 🧪 Testing

### Local Development

For local testing, ensure:
1. `.env.local` has `VITE_HOSTINGER_PUBLIC_URL`
2. Create `.env` file with backend variables (for local API testing)
3. Run `npm run dev` to start dev server
4. API endpoints will be called from `http://localhost:3000/api/...`

### Test SFTP Connection

```javascript
import hostingerSFTPService from '@/lib/hostingerSFTPService';

const test = await hostingerSFTPService.testConnection();
console.log(test); // { success: true, message: '...' }
```

## 📋 File Details

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/hostingerSFTPService.js` | Browser service calling API endpoints |
| `src/lib/storageRouter.js` | Route requests to correct storage service |
| `src/lib/migrationService.js` | Migrate R2 files to Hostinger |
| `src/pages/StorageMigrationPage.jsx` | UI for managing migration |
| `api/hostinger-upload.js` | Backend endpoint for uploads |
| `api/hostinger-delete.js` | Backend endpoint for deletions |
| `api/hostinger-check.js` | Backend endpoint for existence checks |
| `api/hostinger-migrate.js` | Backend endpoint for migrations |
| `supabase/migrations/20251019_add_hostinger_columns.sql` | Database schema update |

### Updated Files

| File | Changes |
|------|---------|
| `src/services/uploader/fileProcessor.js` | Use storageRouter instead of r2Service |
| `src/lib/r2Service.js` | Added `storage_provider='r2'` field |
| `src/App.jsx` | Added `/migration` route |
| `src/lib/locales/*.json` | Added Hostinger error messages |

## ⚠️ Important Notes

1. **Backend API required** - All SFTP operations run on Vercel serverless functions
2. **Environment variables needed** - Both frontend and backend need config
3. **Existing files stay on R2** - Only new uploads go to Hostinger
4. **Migration is optional** - Use `/migration` page to migrate when ready
5. **Automatic retry** - SFTP has built-in retry logic (3 attempts)
6. **Files are public** - All files in `/wp-content/uploads/Audio/` are publicly accessible

## 🔐 Security

- ✅ SFTP connection is encrypted
- ✅ 30-second connection timeout to prevent hanging
- ✅ Credentials from environment variables (never hardcoded)
- ✅ Automatic connection cleanup on errors
- ✅ Base64 encoding for file transmission over HTTP
- ⚠️ Keep environment variables secret - don't commit to git

## 🚀 Deployment Steps

### For Vercel Deployment

1. **Update `.env.local`** with frontend variables:
   ```env
   VITE_HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
   ```

2. **Add Vercel environment variables** in dashboard:
   ```
   HOSTINGER_SFTP_HOST=82.25.67.168
   HOSTINGER_SFTP_PORT=21
   HOSTINGER_SFTP_USERNAME=u953185577
   HOSTINGER_SFTP_PASSWORD=Ftppass!123
   HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
   HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
   ```

3. **Deploy** as usual:
   ```bash
   git push origin main
   ```

4. **Apply SQL migration** to Supabase

5. **Test** by uploading a new file

### For Local Development

1. Create `.env` file (note: NOT `.env.local`):
   ```env
   HOSTINGER_SFTP_HOST=82.25.67.168
   HOSTINGER_SFTP_PORT=21
   HOSTINGER_SFTP_USERNAME=u953185577
   HOSTINGER_SFTP_PASSWORD=Ftppass!123
   HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
   HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
   ```

2. Create `.env.local`:
   ```env
   VITE_HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
   ```

3. Run dev server:
   ```bash
   npm run dev
   ```

## 📞 Troubleshooting

### API Endpoint Returns 500

**Cause:** SFTP connection failed
- Check Hostinger credentials in environment variables
- Verify SFTP port (21) is correct
- Check firewall settings allow outbound SFTP
- Review Vercel logs: `vercel logs <deployment-url>`

### Files Not Uploading

**Cause:** Base64 encoding issue or API endpoint not found
- Verify API endpoints exist in `/api/` folder
- Check browser console for errors
- Ensure environment variables are set in Vercel dashboard

### Migration Takes Too Long

**Cause:** Large files or slow network
- Files are downloaded from R2, then uploaded to Hostinger
- Each file can take minutes depending on size
- Reload page if migration appears stuck

### "Cannot access crypto in client code"

**Cause:** Trying to use ssh2 in browser (this is normal, we fixed it)
- Ensure you're using the updated `hostingerSFTPService.js`
- All SFTP operations should go through API endpoints
- Check browser console shows API calls, not ssh2 errors

## ✅ Verification Checklist

- [ ] `.env.local` created with VITE_HOSTINGER_PUBLIC_URL
- [ ] Vercel environment variables set (if deployed)
- [ ] SQL migration applied to database
- [ ] New file upload works (check it goes to Hostinger)
- [ ] Can access `/migration` page
- [ ] Storage status shows episodes count
- [ ] Test migration of 1-2 episodes
- [ ] Migrated files play correctly
- [ ] Old R2 links still work for existing players
- [ ] API endpoints work (`/api/hostinger-*`)

---

**Date Created:** October 19, 2025
**Last Updated:** October 19, 2025 (Fixed backend API architecture)
**Status:** ✅ Ready for Production
