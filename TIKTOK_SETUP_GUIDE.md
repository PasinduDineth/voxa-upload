# TikTok Developer Portal Configuration Guide

## 🚨 Current Error
```
unauthorized_client
error_type: client_key
```

This means your CLIENT_KEY is invalid or not properly configured in TikTok Developer Portal.

## ✅ Step-by-Step Fix

### Step 1: Go to TikTok Developer Portal
1. Go to: https://developers.tiktok.com/
2. Log in with your TikTok account
3. Click "Manage apps" at the top

### Step 2: Check Your App Configuration

#### A. Verify Client Key
1. Click on your app name
2. Go to "Basic information" tab
3. Look for **Client Key** - it should match what's in your .env file
4. Current CLIENT_KEY in your .env: `sbaw0lz3d1a0f32yv3`

**ACTION:** If this doesn't match, copy the correct Client Key and update your .env file

#### B. Verify Redirect URI (CRITICAL!)
1. Still in your app, go to "Login Kit" section
2. Look for "Redirect domain" or "Redirect URI"
3. Your current REDIRECT_URI: `https://www.pasindu.website/callback`

**MUST EXACTLY MATCH!** Even a trailing slash matters:
- ❌ `https://www.pasindu.website` (missing /callback)
- ❌ `http://www.pasindu.website/callback` (http instead of https)
- ✅ `https://www.pasindu.website/callback` (exact match)

**ACTION:** Add this EXACT URL to your allowed redirect URIs:
```
https://www.pasindu.website/callback
```

### Step 3: Check App Status

#### Is your app in SANDBOX mode?
TikTok apps start in "Development" or "Sandbox" mode with limitations:

1. In Developer Portal, check app status (top of the page)
2. If it says "In Development" or "Sandbox":
   - You can only test with accounts that are added as test users
   - You need to add your TikTok account as a test user

**ACTION:** Add test users:
1. Go to "Test users" section in your app
2. Click "Add test user"
3. Add your TikTok username/email

#### Is your app LIVE/Published?
1. Check if app status shows "Live" or "In Production"
2. If not, you may need to submit for review
3. Some APIs require app approval before working

### Step 4: Verify Required Scopes

1. In Developer Portal, go to "Products" or "APIs" section
2. Make sure these are enabled:
   - ✅ Login Kit (required for OAuth)
   - ✅ Video Kit or Content Posting API (for video upload)
   - ✅ User Info (for basic user data)

3. Check that your app has permissions for:
   - `user.info.basic`
   - `video.upload`
   - `video.publish`

### Step 5: Common Issues

#### Issue 1: Brand New App
- New apps may take a few minutes to become active
- Wait 5-10 minutes after creating the app

#### Issue 2: Wrong Region
- Make sure you're using the right TikTok Developer Portal
- Global: https://developers.tiktok.com/
- Some regions have separate portals

#### Issue 3: App Suspended
- Check for any notifications in Developer Portal
- Your app may have been suspended for policy violations

### Step 6: Update Your Configuration

Once you have the correct values from TikTok Developer Portal:

#### Update `.env` file:
```env
# Replace with YOUR actual values from TikTok Developer Portal
TIKTOK_CLIENT_KEY=your_actual_client_key_from_portal
TIKTOK_CLIENT_SECRET=your_actual_client_secret_from_portal
TIKTOK_REDIRECT_URI=https://www.pasindu.website/callback
```

#### Update Vercel Environment Variables (if deployed):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update:
   - `TIKTOK_CLIENT_KEY` = your actual client key
   - `TIKTOK_CLIENT_SECRET` = your actual client secret
   - `TIKTOK_REDIRECT_URI` = https://www.pasindu.website/callback

#### Restart your development server:
```bash
npm start
```

## 🔍 How to Get Correct Values

### Getting Client Key and Secret:
1. TikTok Developer Portal → Your App → Basic Information
2. **Client Key**: Copy this value (publicly visible)
3. **Client Secret**: Click "Show" → Copy (keep secure!)

### Example Format:
```
Client Key: awbx8g8abc4kcd72
Client Secret: a5c3d9e1f2g4h5i6j7k8l9m0n1o2p3q4
```

## ⚠️ Important Notes

1. **Client Key vs App ID**: These are DIFFERENT
   - Use Client Key (for OAuth/Login Kit)
   - Not App ID (for other TikTok APIs)

2. **Redirect URI Must Be HTTPS** (for production)
   - Local dev can use: `http://localhost:3000/callback`
   - Production MUST use: `https://www.pasindu.website/callback`

3. **No Trailing Slash Issues**:
   - If TikTok has: `https://www.pasindu.website/callback`
   - Your .env MUST have: `https://www.pasindu.website/callback`
   - They must match EXACTLY

4. **Test Users** (if in sandbox):
   - Add your TikTok account as a test user
   - Only test users can authenticate in sandbox mode

## 🧪 Testing After Configuration

1. Clear browser cache and cookies
2. Restart your server
3. Click "Connect with TikTok"
4. Should redirect to TikTok login WITHOUT errors

## 📞 Still Not Working?

### Check Console Logs:
The client_key being sent is: `sbaw0lz3d1a0f32yv3`
The redirect_uri being sent is: `https://www.pasindu.website/callback`

### Verify These Match Exactly:
- TikTok Developer Portal → Your App → Client Key
- TikTok Developer Portal → Your App → Redirect URI

### If They Don't Match:
Update your `.env` file with the correct values from TikTok Developer Portal.

## 📋 Quick Checklist

- [ ] Client Key matches TikTok Developer Portal exactly
- [ ] Client Secret is correct
- [ ] Redirect URI is added to allowed URIs in TikTok Portal
- [ ] Redirect URI matches exactly (including https://, trailing slashes)
- [ ] App is active (not suspended)
- [ ] Required APIs are enabled (Login Kit, Video Kit)
- [ ] Scopes are approved (user.info.basic, video.upload, video.publish)
- [ ] Test users added (if in sandbox mode)
- [ ] .env file updated with correct values
- [ ] Server restarted after .env changes
- [ ] Browser cache cleared
