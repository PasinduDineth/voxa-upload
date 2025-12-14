# TikTok Video Uploader

A secure React app for uploading videos to TikTok using the TikTok API with multi-account support and production-ready OAuth 2.0 + PKCE implementation.

## 🚀 Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see [.env.example](.env.example))

3. Run database migration (see [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md))

4. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## 🔐 Security Features

✅ **OAuth 2.0 with PKCE S256** - Industry-standard secure authentication  
✅ **Multi-Account Support** - Connect multiple TikTok accounts  
✅ **Server-Side Token Exchange** - CLIENT_SECRET never exposed to frontend  
✅ **CSRF Protection** - State validation prevents cross-site request forgery  
✅ **Comprehensive Logging** - Full audit trail for debugging  

**See [OAUTH_IMPLEMENTATION.md](OAUTH_IMPLEMENTATION.md) for detailed documentation.**

## 📁 Documentation

- **[OAUTH_IMPLEMENTATION.md](OAUTH_IMPLEMENTATION.md)** - Complete OAuth implementation guide
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment instructions
- **[SUMMARY.md](SUMMARY.md)** - Quick summary of changes
- **[database-migration.sql](database-migration.sql)** - Database schema

## 🎯 Features

### Authentication & Accounts
- ✅ Secure OAuth 2.0 login with PKCE
- ✅ Multi-account management (add, switch, remove)
- ✅ Prevents duplicate account linking
- ✅ Automatic token refresh on re-authentication

### Video Upload
- ✅ Video file upload to TikTok (max 4GB)
- ✅ Video title and privacy settings
- ✅ Upload progress tracking
- ✅ Status monitoring
- ✅ Chunked upload for large files (10MB chunks)

## 🔧 Setup

### 1. TikTok Developer Portal

1. Go to [TikTok Developer Portal](https://developers.tiktok.com/)
2. Create or select your app
3. Add redirect URI: `https://www.pasindu.website/callback`
4. Enable these scopes:
   - `video.upload`
   - `video.publish`
   - `user.info.basic`

### 2. Environment Variables

Create `.env.local` for local development or add to Vercel dashboard:

```bash
# Server-side only (NEVER expose in frontend)
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=https://www.pasindu.website/callback

# Frontend (exposed to client)
REACT_APP_TIKTOK_CLIENT_KEY=your_client_key
REACT_APP_REDIRECT_URI=https://www.pasindu.website/callback
```

### 3. Database Setup

Run the migration in your Vercel Postgres database:

```bash
psql $POSTGRES_URL -f database-migration.sql
```

Or use the Vercel dashboard Query tab.

## 🚀 Deployment

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete deployment instructions.

Quick deploy to Vercel:
```bash
vercel --prod
```

## 🎮 Usage

### Adding Your First Account
1. Click "Add Your First Account"
2. Log in with your TikTok credentials
3. Authorize the app
4. Your account will be connected

### Adding Multiple Accounts
1. Click "+ Add Another Account"
2. **TikTok will show login screen** (not auto-authenticate)
3. Log in with a different TikTok account
4. Both accounts will be available

### Uploading a Video
1. Select which account to use
2. Choose a video file (max 4GB)
3. Enter video title (max 150 characters)
4. Click "Upload to TikTok"
5. Wait for upload to complete
6. Check your TikTok profile for the video

## 📊 Tech Stack

- **Frontend**: React 18
- **Backend**: Vercel Serverless Functions
- **Database**: Vercel Postgres
- **Authentication**: OAuth 2.0 + PKCE (S256)
- **API**: TikTok Web API v2
