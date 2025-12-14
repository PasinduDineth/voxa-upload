# TikTok Video Uploader

A React app for uploading videos to TikTok using the TikTok API with sandbox credentials.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Add the required TikTok credentials to `.env.local` (or your Vercel project settings):
```
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=https://yourapp.com/
```
The redirect URI must exactly match what is configured in the TikTok Developer Portal.

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
3. Add the redirect URI: `http://localhost:3000/` (or your deployed URL)
4. Make sure these scopes are enabled:
   - `video.upload`
   - `user.info.basic`

### Production Deployment

The OAuth flow and token exchange now run entirely on the backend so that client secrets stay on the server.

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
