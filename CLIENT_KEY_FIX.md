# CLIENT_KEY Error Fix

## ❌ Problem
TikTok OAuth was showing error: "Something went wrong - client_key"

## ✅ Solution
The CLIENT_KEY and REDIRECT_URI are now fetched from the **server** at runtime instead of being hardcoded in the frontend. This ensures they're always properly configured.

## 🔧 Changes Made

### 1. Updated `.env` file
Added server-side environment variables (without `REACT_APP_` prefix):
```env
TIKTOK_CLIENT_KEY=sbaw0lz3d1a0f32yv3
TIKTOK_CLIENT_SECRET=d3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY
TIKTOK_REDIRECT_URI=http://localhost:3000/callback
```

### 2. Updated `api/init-oauth.js`
Now returns `client_key` and `redirect_uri` from server environment variables:
```javascript
{
  state,
  code_challenge,
  code_challenge_method: 'S256',
  code_verifier,
  client_key: process.env.TIKTOK_CLIENT_KEY,
  redirect_uri: process.env.TIKTOK_REDIRECT_URI
}
```

### 3. Updated `src/services/tiktokApi.js`
Uses CLIENT_KEY and REDIRECT_URI from server response:
```javascript
const { client_key, redirect_uri } = response.data.data;

const params = new URLSearchParams({
  client_key: client_key,  // From server
  redirect_uri: redirect_uri,  // From server
  // ... other params
});
```

## 🚀 Local Development

### Step 1: Ensure `.env` file has correct values
```env
TIKTOK_CLIENT_KEY=your_actual_client_key
TIKTOK_CLIENT_SECRET=your_actual_client_secret
TIKTOK_REDIRECT_URI=http://localhost:3000/callback
```

### Step 2: Restart your development server
```bash
npm start
```

The server needs to restart to pick up the new environment variables.

## ☁️ Vercel Deployment

If deploying to Vercel, you MUST set these environment variables:

### Step 1: Go to Vercel Dashboard
1. Go to your project settings
2. Click "Environment Variables"

### Step 2: Add these variables:
```
TIKTOK_CLIENT_KEY = sbaw0lz3d1a0f32yv3
TIKTOK_CLIENT_SECRET = d3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY
TIKTOK_REDIRECT_URI = https://www.pasindu.website/callback
```

**Important:** Change the REDIRECT_URI to your actual production domain!

### Step 3: Redeploy
After adding environment variables, redeploy your app for changes to take effect.

## 🔍 How to Get Your TikTok CLIENT_KEY

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Log in with your TikTok account
3. Create a new app or use existing one
4. Go to "Manage apps" → Your App → "Basic information"
5. Copy the **Client Key** (this is your CLIENT_KEY)
6. Copy the **Client Secret** (keep this secure!)
7. Add your redirect URI in "Redirect URI" section

## ✅ Testing the Fix

1. **Clear browser cache and cookies**
2. **Restart your server** (important!)
3. Click "Connect with TikTok"
4. You should now see TikTok's login screen without the client_key error

## 🐛 Troubleshooting

### Still getting client_key error?
Check console logs:
```javascript
console.log('[OAuth] Building authorize URL with', {
  client_key_length: client_key.length,
  redirect_uri
});
```

### CLIENT_KEY is undefined?
- Restart your server after adding .env variables
- Check that `.env` file is in the project root
- Verify variable names are correct (no typos)

### On Vercel: Still not working?
- Verify environment variables are set in Vercel dashboard
- Make sure you redeployed after adding variables
- Check Vercel function logs for errors

## 📋 Summary

**Before:** CLIENT_KEY was hardcoded in frontend (could be undefined or wrong)
**After:** CLIENT_KEY comes from server environment variables (always correct)

This ensures:
- ✅ No hardcoded values in code
- ✅ Environment-specific configuration
- ✅ Secure secret management
- ✅ Easy deployment to different environments
