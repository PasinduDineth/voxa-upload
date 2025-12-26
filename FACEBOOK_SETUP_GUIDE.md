# Facebook Setup Guide - Token-Based Approach

Simple guide to set up Facebook Page posting using access tokens (No OAuth flow needed!)

---

## Why Token-Based Approach?

✅ **Simpler** - No complex OAuth flow  
✅ **Fewer API endpoints** - Only 1 endpoint needed (saves Vercel limits!)  
✅ **Faster setup** - Generate token once and start posting  
✅ **Same functionality** - Post to multiple pages easily

---

## Step 1: Create Facebook App (5 minutes)

### 1.1 Create App

You've already done this! You should have:
- **App ID**: Found in Settings → Basic
- **App Secret**: Found in Settings → Basic (click "Show")

### 1.2 Add Required Products

1. In your app dashboard (https://developers.facebook.com/apps/)
2. Click **Add Product**
3. Find **Facebook Login** and click **Set Up**

---

## Step 2: Generate Page Access Token (3 minutes)

### Option A: Using Graph API Explorer (Recommended)

1. Go to **Graph API Explorer**: https://developers.facebook.com/tools/explorer/

2. Select your Facebook App from the dropdown (top right)

3. Click **Generate Access Token** button

4. In the permission dialog, select **ALL your Facebook Pages** that you want to manage

5. Grant these permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_metadata`

6. Click **Generate Access Token**

7. **Copy the token** - it will look like:
   ```
   EAAx...very long string...xyz
   ```

8. **IMPORTANT:** To make it long-lived (60 days):
   - Click "i" icon next to the token
   - Click "Open in Access Token Tool"
   - Click "Extend Access Token"
   - Copy the new extended token

### Option B: Using Access Token Tool

1. Go to **Access Token Tool**: https://developers.facebook.com/tools/accesstoken/

2. Find your app in the list

3. Click **Generate Token** next to "User Token"

4. Select all your pages and grant permissions

5. Copy the token

---

## Step 3: Use Token in Your App

### 3.1 In Your App Interface

1. Open your app and click the **📘 Facebook** tab

2. Click **Add Facebook Pages**

3. Paste the access token you generated

4. Click **Add Facebook Pages**

5. ✅ Done! All your pages will be added automatically

### 3.2 The token will:
- Fetch all pages you have admin access to
- Get page-specific access tokens automatically
- Store them securely in your database

---

## Step 4: Start Posting! 🎉

1. Select a page from your connected pages
2. Click **Go to Upload**
3. Choose video, add title and description
4. Click **Upload to Facebook Page**
5. Your video will be posted!

---

## Database Setup (Already Done ✅)

You already executed the SQL to create `facebook_oauth_states` table, but we don't actually need it for this approach!

The existing `accounts` table with `type='FACEBOOK'` is all we need.

---

## No Environment Variables Needed! 🎊

Unlike the OAuth approach, the token-based method doesn't require:
- ❌ `FACEBOOK_APP_ID`
- ❌ `FACEBOOK_APP_SECRET`  
- ❌ `FACEBOOK_REDIRECT_URI`

Everything works with just the page access tokens!

---

## Token Management

### Token Expiration
- **Short-lived tokens**: 1-2 hours
- **Long-lived tokens**: 60 days (use "Extend Access Token")
- **Page tokens**: Don't expire automatically

### Refreshing Tokens
When your token expires (after 60 days):
1. Go back to Graph API Explorer
2. Generate a new token
3. Paste it in your app
4. Your pages will be refreshed with new tokens

---

## Troubleshooting

### "No pages found"
**Solution**: Make sure you:
- Selected your pages during token generation
- Have admin access to at least one Facebook Page
- Granted the `pages_show_list` permission

### "Invalid token" error
**Solution**:
- Token might be expired - generate a new one
- Make sure you copied the entire token (no spaces)
- Use the extended/long-lived token

### "Permission denied" on upload
**Solution**:
- Regenerate token with `pages_manage_posts` permission
- Make sure page token was fetched correctly

### Token expires too quickly
**Solution**:
- Use "Extend Access Token" feature in Access Token Tool
- This extends it to 60 days

---

## API File Structure

### Backend (Only 1 file!)
- `api/facebook-accounts.js` - Manages pages and uploads

That's it! No OAuth endpoints needed.

### Frontend (2 files)
- `src/services/facebookApi.js` - Facebook API service
- `src/components/FacebookUploader.js` - Facebook UI

---

## Comparison: OAuth vs Token-Based

| Feature | OAuth Approach | Token Approach |
|---------|---------------|----------------|
| Setup Complexity | High | Low |
| API Endpoints | 3 files | 1 file |
| Environment Variables | 3 required | 0 required |
| User Experience | Click button → Redirect | Paste token → Done |
| Token Management | Automatic | Manual (60 days) |
| Vercel Functions Used | 3 | 1 |

**Winner**: Token-based for this use case! ✅

---

## Video Requirements

- **Max Size:** 1GB (direct upload)
- **Max Duration:** 240 minutes
- **Formats:** MP4, MOV, AVI, WMV, FLV, 3GP, WebM
- **Aspect Ratios:** 16:9, 9:16, 4:5, 1:1

---

## Security Notes

✅ **Secure**: Tokens are stored in your database, not in client  
✅ **Private**: Each user generates their own token  
✅ **Page-specific**: Page tokens are separate from user tokens  
⚠️ **Important**: Never share your access tokens publicly

---

## Summary

1. ✅ Create Facebook App (you've done this!)
2. ✅ Generate Page Access Token from Graph API Explorer
3. ✅ Extend token to 60 days
4. ✅ Paste token in your app
5. ✅ Start posting videos!

**Total time**: ~10 minutes  
**Complexity**: Low  
**Maintenance**: Regenerate token every 60 days

---

## Resources

- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **Access Token Tool**: https://developers.facebook.com/tools/accesstoken/
- **Graph API Docs**: https://developers.facebook.com/docs/graph-api/
- **Video API**: https://developers.facebook.com/docs/video-api/
- **Page Tokens**: https://developers.facebook.com/docs/pages/access-tokens/

---

**Congratulations!** Your Facebook integration is ready with a simple token-based approach! 🎉

---

## Prerequisites

- A Facebook account
- A Facebook Page (create one if you don't have it)
- Access to Facebook Developer Portal
- Vercel or another hosting platform for environment variables

---

## Part 1: Create and Configure Facebook App

### Step 1: Access Facebook Developer Dashboard

You mentioned you've already created a Facebook App. Great! You should see your app in the dashboard at:
- **URL:** https://developers.facebook.com/apps/

### Step 2: Get Your App ID and App Secret

1. In your app dashboard, click on **Settings** → **Basic** in the left sidebar
2. You'll see:
   - **App ID** - Copy this value
   - **App Secret** - Click "Show" and copy this value (keep it secret!)
3. Save these values - you'll need them for environment variables

### Step 3: Configure OAuth Settings

1. In the left sidebar, go to **Settings** → **Basic**
2. Scroll down to find:
   - **App Domains:** Add your domain (e.g., `your-app.vercel.app`)
   - **Privacy Policy URL:** Add your privacy policy URL (required)
   - **Terms of Service URL:** Add your terms URL (optional but recommended)

3. Scroll down to **Platform** section and click **+ Add Platform**
4. Choose **Website**
5. Enter your **Site URL:** `https://your-app.vercel.app`

### Step 4: Add Facebook Login Product

1. In the left sidebar, find **Products** and click the **+** icon
2. Find **Facebook Login** and click **Set Up**
3. Choose **Web** platform
4. You'll see a setup wizard - you can skip it for now

### Step 5: Configure Facebook Login Settings

1. Go to **Facebook Login** → **Settings** in the left sidebar
2. Configure the following:

**Valid OAuth Redirect URIs:**
```
https://your-app.vercel.app
https://your-app.vercel.app/
```

Replace `your-app.vercel.app` with your actual domain.

**Login from Devices:**
- Enable if needed (usually not required for web apps)

**Client OAuth Login:** YES
**Web OAuth Login:** YES
**Use Strict Mode for Redirect URIs:** YES

3. Click **Save Changes**

### Step 6: Request Advanced Access for Permissions

This is CRITICAL - without this, your app will only work in Development Mode with limited users.

1. In the left sidebar, go to **App Review** → **Permissions and Features**
2. Find and request **Advanced Access** for:
   - `pages_show_list` - Required to show pages
   - `pages_read_engagement` - Required to read page data
   - `pages_manage_posts` - Required to post videos
   - `pages_manage_metadata` - Required to manage page metadata

3. For each permission:
   - Click **Request Advanced Access**
   - Fill out the form explaining your use case
   - Facebook will review your request (usually takes 1-3 days)

**Note:** While in Development Mode, you can add test users who can use the app.

### Step 7: Add Test Users (Development Mode)

While waiting for Advanced Access approval:

1. Go to **Roles** → **Roles** in the left sidebar
2. Click **Add Testers**
3. Add Facebook users who need to test the app
4. They must accept the invitation to test your app

### Step 8: Switch App to Live Mode (After Approval)

Once your permissions are approved:

1. Go to **Settings** → **Basic**
2. At the top of the page, toggle the switch from **Development** to **Live**
3. Your app is now available to the public!

---

## Part 2: Environment Variables Setup

### Required Environment Variables

Add these to your Vercel project (or `.env.local` for local development):

```bash
# Facebook App Credentials
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=https://your-app.vercel.app
```

### How to Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** tab
3. Click on **Environment Variables** in the left sidebar
4. Add each variable:
   - **Name:** `FACEBOOK_APP_ID`
   - **Value:** Your App ID from Facebook
   - **Environment:** Production, Preview, Development (select all)
   - Click **Save**
5. Repeat for `FACEBOOK_APP_SECRET` and `FACEBOOK_REDIRECT_URI`
6. **Redeploy** your app for changes to take effect

---

## Part 3: Create a Facebook Page (If You Don't Have One)

1. Go to https://www.facebook.com/pages/create/
2. Choose a **Page Type** (Business/Brand, Community/Public Figure, etc.)
3. Fill in:
   - Page Name
   - Category
   - Bio/Description
4. Add a profile picture and cover photo (recommended)
5. Click **Create Page**

---

## Part 4: Testing the Integration

### Test in Development Mode

1. Make sure you're added as a tester (Part 1, Step 7)
2. Open your app in the browser
3. Click the **Facebook** tab
4. Click **Connect Facebook Page**
5. Log in with your Facebook account
6. Select the page you want to connect
7. Grant the requested permissions
8. You should be redirected back to your app with the page connected

### Upload a Test Video

1. Switch to the Upload view
2. Select a video file (max 1GB)
3. Enter a title and description
4. Click **Upload to Facebook Page**
5. Check your Facebook Page to see the posted video

---

## Part 5: Troubleshooting

### Error: "App Not Set Up"
- Make sure Facebook Login is added as a product
- Check that OAuth Redirect URIs are correctly configured
- Verify your app is in the correct mode (Development/Live)

### Error: "Invalid OAuth Redirect URI"
- Double-check the redirect URI in Facebook settings matches exactly
- Include both `https://your-app.vercel.app` and `https://your-app.vercel.app/`
- No trailing slashes or extra characters

### Error: "Insufficient Permissions"
- In Development Mode: Make sure you're added as a tester
- In Live Mode: Ensure Advanced Access is granted for required permissions
- Check that you've granted all permissions during OAuth flow

### Error: "No Pages Found"
- Make sure you have at least one Facebook Page
- Verify your account is an admin of the page
- Try disconnecting and reconnecting

### Error: "Upload Failed"
- Check video file size (max 1GB for direct upload)
- Verify video format is supported (MP4, MOV, AVI, etc.)
- Ensure page access token is valid
- Check page permissions allow posting

---

## Part 6: API File Structure

Your app now has these Facebook-related files:

### Backend (Serverless Functions)
- `api/facebook-init-oauth.js` - Initializes OAuth flow
- `api/facebook-oauth-callback.js` - Handles OAuth callback
- `api/facebook-accounts.js` - Manages pages (GET, DELETE, POST)

### Frontend
- `src/services/facebookApi.js` - Facebook API service
- `src/components/FacebookUploader.js` - Facebook UI component

---

## Part 7: Important Notes

### Rate Limits
- Facebook has API rate limits per app and per user
- Default: 200 calls per hour per user
- For pages: 4800 calls per day

### Video Requirements
- **Size:** Up to 1GB (for direct upload)
- **Duration:** Up to 240 minutes
- **Formats:** MP4, MOV, AVI, WMV, FLV, 3GP, WebM
- **Aspect Ratios:** 16:9, 9:16, 4:5, 1:1

### Token Expiry
- Page access tokens are long-lived (60 days)
- They're automatically refreshed by Facebook
- No manual refresh required (unlike YouTube)

### Security Best Practices
- Never commit your App Secret to Git
- Use environment variables for all credentials
- Enable "Use Strict Mode for Redirect URIs"
- Regularly review app permissions

---

## Part 8: Going to Production

### Before Launching:

1. ✅ Request and receive Advanced Access for all permissions
2. ✅ Switch app from Development to Live mode
3. ✅ Add Privacy Policy URL
4. ✅ Add App Icon (1024x1024px)
5. ✅ Complete App Review if required
6. ✅ Test with multiple pages
7. ✅ Test video uploads with different formats
8. ✅ Monitor error logs in Vercel

### After Launch:

- Monitor Facebook Developer Dashboard for any issues
- Check API usage and rate limits
- Keep App Secret secure
- Update permissions if you add new features

---

## Resources

- **Facebook Developer Docs:** https://developers.facebook.com/docs/
- **Graph API Reference:** https://developers.facebook.com/docs/graph-api/
- **Pages API:** https://developers.facebook.com/docs/pages/
- **Video API:** https://developers.facebook.com/docs/video-api/
- **App Review Process:** https://developers.facebook.com/docs/app-review/

---

## Need Help?

Common issues and solutions:

**Issue:** OAuth redirect doesn't work
**Solution:** Check redirect URIs match exactly, including protocol (https://)

**Issue:** Can't see pages
**Solution:** Verify `pages_show_list` permission is granted

**Issue:** Can't post videos
**Solution:** Ensure `pages_manage_posts` has Advanced Access

**Issue:** Token expired errors
**Solution:** Reconnect the page to get a fresh token

---

## Summary Checklist

- [x] Created Facebook App in Developer Portal
- [x] Got App ID and App Secret
- [x] Configured OAuth Redirect URIs
- [x] Added Facebook Login product
- [x] Requested Advanced Access for permissions
- [x] Added environment variables to Vercel
- [x] Created/connected Facebook Page
- [x] Tested OAuth flow
- [x] Tested video upload
- [x] Ready to go live!

**Congratulations!** Your Facebook integration is ready. You can now upload videos to multiple Facebook Pages just like TikTok and YouTube! 🎉
