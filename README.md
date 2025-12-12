# TikTok Video Uploader

A React app for uploading videos to TikTok using the TikTok API with sandbox credentials.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure the `.env` file contains your TikTok API credentials (already configured)

3. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Important Notes

### TikTok Developer Portal Setup

Before using this app, you need to configure your TikTok Developer Portal:

1. Go to [TikTok Developer Portal](https://developers.tiktok.com/)
2. Navigate to your app settings
3. Add the redirect URI: `http://localhost:3000/callback`
4. Make sure these scopes are enabled:
   - `video.upload`
   - `user.info.basic`

### Production Deployment

⚠️ **SECURITY WARNING**: This app includes the client secret in the frontend code for development purposes only.

For production:
- Move the OAuth token exchange to a backend server
- Never expose your client secret in frontend code
- Use environment variables on your backend
- Implement proper security measures

When deploying to Vercel, make sure serverless functions bundle the Postgres client:

```json
{
  "functions": {
    "api/**/*.js": {
      "includeFiles": "node_modules/@vercel/postgres/**"
    }
  }
}
```

This mirrors the `vercel.json` in the repo and prevents missing-module errors at runtime.

## Features

- TikTok OAuth authentication
- Video file upload
- Video title and privacy settings
- Upload progress tracking
- Status monitoring

## Usage

1. Click "Connect TikTok Account" to authenticate
2. Select a video file (max 4GB)
3. Enter video title
4. Choose privacy level
5. Click "Upload to TikTok"

## Privacy Levels

- **Private (Only Me)**: Only you can see the video
- **Friends**: Only your friends can see the video
- **Public**: Everyone can see the video
