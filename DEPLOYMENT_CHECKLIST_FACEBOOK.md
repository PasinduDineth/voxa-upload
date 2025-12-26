# Facebook Integration - Deployment Checklist

Quick checklist to deploy Facebook integration to production.

---

## ✅ Pre-Deployment Checklist

### 1. Facebook App Setup
- [ ] Facebook App created in Developer Portal
- [ ] App ID and App Secret obtained
- [ ] OAuth Redirect URIs configured (`https://your-app.vercel.app` and `https://your-app.vercel.app/`)
- [ ] Facebook Login product added
- [ ] Valid OAuth Redirect URIs set in Facebook Login settings
- [ ] Privacy Policy URL added (required)
- [ ] Advanced Access requested for permissions:
  - [ ] `pages_show_list`
  - [ ] `pages_read_engagement`
  - [ ] `pages_manage_posts`
  - [ ] `pages_manage_metadata`

### 2. Environment Variables
- [ ] `FACEBOOK_APP_ID` set in Vercel
- [ ] `FACEBOOK_APP_SECRET` set in Vercel
- [ ] `FACEBOOK_REDIRECT_URI` set in Vercel
- [ ] All variables set for Production, Preview, and Development environments

### 3. Database
- [ ] `facebook_oauth_states` table created ✅ (Already done!)
- [ ] Existing `accounts` table supports type='FACEBOOK' ✅

### 4. Code Files
- [ ] `api/facebook-init-oauth.js` created ✅
- [ ] `api/facebook-oauth-callback.js` created ✅
- [ ] `api/facebook-accounts.js` created ✅
- [ ] `src/services/facebookApi.js` created ✅
- [ ] `src/components/FacebookUploader.js` created ✅
- [ ] `src/App.js` updated with Facebook tab ✅

---

## 🚀 Deployment Steps

### Step 1: Commit Changes
```bash
git add .
git commit -m "feat: Add Facebook Page integration for video posting"
git push
```

### Step 2: Set Environment Variables in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following:

| Name | Value | Environments |
|------|-------|--------------|
| `FACEBOOK_APP_ID` | Your Facebook App ID | Production, Preview, Development |
| `FACEBOOK_APP_SECRET` | Your Facebook App Secret | Production, Preview, Development |
| `FACEBOOK_REDIRECT_URI` | https://your-app.vercel.app | Production, Preview, Development |

3. Click **Save** for each variable

### Step 3: Redeploy Application
- Vercel will auto-deploy on git push, OR
- Manually trigger redeploy from Vercel Dashboard → Deployments → Redeploy

### Step 4: Verify Deployment
- [ ] Application builds successfully
- [ ] No build errors in Vercel logs
- [ ] Facebook tab visible in UI
- [ ] OAuth flow works (test in Development mode)

---

## 🧪 Testing Checklist

### Test in Development Mode (Before Live)

1. **Add Test User**
   - [ ] Add yourself as a tester in Facebook App → Roles
   - [ ] Accept tester invitation

2. **Test OAuth Flow**
   - [ ] Click "Connect Facebook Page"
   - [ ] Facebook login works
   - [ ] Page selection works
   - [ ] Redirect back to app works
   - [ ] Page appears in accounts list

3. **Test Account Management**
   - [ ] Can switch between pages
   - [ ] Can add multiple pages
   - [ ] Can remove pages
   - [ ] Active page indicator shows correctly

4. **Test Video Upload**
   - [ ] Can select video file
   - [ ] Form validation works
   - [ ] Upload starts
   - [ ] Upload completes successfully
   - [ ] Video appears on Facebook Page
   - [ ] Error handling works (test with invalid file)

5. **Test Edge Cases**
   - [ ] Try uploading without selecting file
   - [ ] Try uploading file > 1GB
   - [ ] Try uploading non-video file
   - [ ] Test with expired state parameter
   - [ ] Test adding same page twice

---

## 🌐 Going Live Checklist

### Before Switching to Live Mode

1. **App Review**
   - [ ] Advanced Access approved for all required permissions
   - [ ] No outstanding review requests

2. **App Settings**
   - [ ] App icon uploaded (1024x1024px)
   - [ ] Privacy Policy URL set and accessible
   - [ ] Terms of Service URL set (optional)
   - [ ] App Domains configured
   - [ ] Platform (Website) configured with Site URL

3. **Testing Complete**
   - [ ] All features tested in Development mode
   - [ ] No critical bugs found
   - [ ] Error handling verified
   - [ ] Multiple pages tested
   - [ ] Different video formats tested

4. **Switch to Live**
   - [ ] Go to Settings → Basic
   - [ ] Toggle from Development to Live
   - [ ] Confirm the switch

5. **Post-Launch Testing**
   - [ ] Test OAuth with non-tester account
   - [ ] Test full upload flow
   - [ ] Monitor Vercel logs for errors
   - [ ] Monitor Facebook App Dashboard for issues

---

## 🔍 Verification Commands

### Check Environment Variables
In Vercel Dashboard, verify all variables show up:
```
FACEBOOK_APP_ID: ••••••••
FACEBOOK_APP_SECRET: ••••••••
FACEBOOK_REDIRECT_URI: https://your-app.vercel.app
```

### Check API Endpoints
After deployment, verify endpoints are accessible:
- `https://your-app.vercel.app/api/facebook-init-oauth`
- `https://your-app.vercel.app/api/facebook-oauth-callback`
- `https://your-app.vercel.app/api/facebook-accounts`

### Check Database
Verify table exists:
```sql
SELECT * FROM facebook_oauth_states LIMIT 1;
SELECT * FROM accounts WHERE type = 'FACEBOOK' LIMIT 5;
```

---

## 📊 Monitoring

### What to Monitor

1. **Vercel Logs**
   - Watch for errors during OAuth flow
   - Monitor upload success/failure rates
   - Check API response times

2. **Facebook Developer Dashboard**
   - Monitor API usage and rate limits
   - Check for any app alerts or warnings
   - Review error logs

3. **Database**
   - Monitor `facebook_oauth_states` table for cleanup
   - Check `accounts` table for new Facebook pages
   - Verify no orphaned states (older than 10 minutes)

---

## 🐛 Common Issues & Solutions

### Issue: "App Not Set Up" Error
**Solution:** Ensure Facebook Login product is added and OAuth Redirect URIs are configured

### Issue: "Invalid OAuth Redirect URI"
**Solution:** Double-check the URI in Facebook settings matches exactly (including https://)

### Issue: Environment Variables Not Working
**Solution:** Redeploy after adding environment variables in Vercel

### Issue: "No Pages Found"
**Solution:** Verify user has admin access to at least one Facebook Page

### Issue: Upload Fails with 500 Error
**Solution:** Check Vercel logs for detailed error, verify page token is valid

---

## 📈 Success Metrics

After deployment, you should see:
- ✅ Users can connect Facebook Pages
- ✅ Users can upload videos to their pages
- ✅ Videos appear on Facebook within minutes
- ✅ Multiple pages can be managed per user
- ✅ OAuth flow completes without errors
- ✅ No API rate limit errors

---

## 🎉 You're Done!

Once all checkboxes are complete, your Facebook integration is live and ready for users!

### Quick Stats:
- **3** new API endpoints
- **2** new frontend files
- **0** new dependencies
- **1** new platform integrated

**Total Integration:** TikTok + YouTube + Facebook = All-in-one video uploader! 🚀

---

## 📞 Need Help?

Refer to:
- `FACEBOOK_SETUP_GUIDE.md` - Detailed Facebook App setup
- `FACEBOOK_INTEGRATION.md` - Technical integration details
- `DATABASE_SCHEMA.md` - Database structure
- Facebook Developer Docs: https://developers.facebook.com/docs/

---

**Happy Deploying! 🎊**
