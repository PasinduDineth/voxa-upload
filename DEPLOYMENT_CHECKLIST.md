# 🚀 Deployment Checklist

Follow these steps to deploy the updated OAuth implementation to Vercel.

## ✅ Pre-Deployment

- [ ] **Review all changes**
  - Check [OAUTH_IMPLEMENTATION.md](OAUTH_IMPLEMENTATION.md) for full documentation
  - Verify all files are committed to git

- [ ] **Environment Variables**
  - [ ] Add `TIKTOK_CLIENT_KEY` in Vercel dashboard (Environment Variables)
  - [ ] Add `TIKTOK_CLIENT_SECRET` in Vercel dashboard (Environment Variables)
  - [ ] Add `TIKTOK_REDIRECT_URI` in Vercel dashboard (Environment Variables)
  - [ ] Add `REACT_APP_TIKTOK_CLIENT_KEY` in Vercel dashboard
  - [ ] Add `REACT_APP_REDIRECT_URI` in Vercel dashboard
  - [ ] Verify Postgres variables are already configured

## 📊 Database Migration

- [ ] **Run SQL Migration**
  ```bash
  # Option 1: Vercel Dashboard
  1. Go to Vercel Dashboard → Storage → Postgres
  2. Click "Query" tab
  3. Paste contents of database-migration.sql
  4. Click "Execute Query"
  
  # Option 2: CLI (if you have psql)
  psql $POSTGRES_URL -f database-migration.sql
  ```

- [ ] **Verify Tables Created**
  ```sql
  -- Run these queries to verify
  SELECT * FROM oauth_states LIMIT 1;
  SELECT * FROM accounts LIMIT 1;
  ```

## 🔧 Code Changes Summary

### New Files Created:
1. ✅ `api/init-oauth.js` - Initializes OAuth with PKCE
2. ✅ `api/oauth-callback.js` - Server-side token exchange
3. ✅ `database-migration.sql` - Database schema
4. ✅ `.env.example` - Environment variables template
5. ✅ `OAUTH_IMPLEMENTATION.md` - Full documentation
6. ✅ `DEPLOYMENT_CHECKLIST.md` - This file

### Modified Files:
1. ✅ `src/services/tiktokApi.js`
   - Removed CLIENT_SECRET (security fix)
   - Implemented PKCE S256
   - Added disable_auto_auth=1 support
   - Moved token exchange to server
   - Added comprehensive logging

2. ✅ `src/components/TikTokUploader.js`
   - Updated to handle async getAuthUrl
   - Improved error handling
   - Simplified "Add Another Account" flow

## 🧪 Testing Before Production

- [ ] **Test on Staging First** (if available)
  - [ ] Add first account
  - [ ] Add second account (should see login screen)
  - [ ] Verify both accounts saved
  - [ ] Switch between accounts
  - [ ] Remove an account
  - [ ] Check browser console for logs

- [ ] **Test Error Cases**
  - [ ] Expired state (wait 10+ minutes in OAuth flow)
  - [ ] Invalid state (manually change state parameter)
  - [ ] Network errors

## 🚢 Deploy to Production

```bash
# 1. Commit all changes
git add .
git commit -m "Implement secure multi-account OAuth with PKCE S256"

# 2. Push to main branch
git push origin main

# 3. Vercel will auto-deploy (or manually trigger)
vercel --prod
```

## ✅ Post-Deployment Verification

- [ ] **Test Production OAuth Flow**
  - [ ] Visit your production URL
  - [ ] Click "Add Your First Account"
  - [ ] Complete TikTok OAuth
  - [ ] Verify account appears in list
  - [ ] Click "+ Add Another Account"
  - [ ] **Verify TikTok shows login screen** (not auto-auth)
  - [ ] Complete OAuth with different account
  - [ ] Verify both accounts shown

- [ ] **Check Logs in Vercel**
  - [ ] Go to Vercel Dashboard → Deployments → Latest → Logs
  - [ ] Look for `[OAuth]` and `[Init OAuth]` logs
  - [ ] Verify no errors

- [ ] **Check Database**
  ```sql
  -- Verify accounts are saved
  SELECT open_id, display_name, created_at FROM accounts;
  
  -- Check oauth_states (should be empty or only recent)
  SELECT state, created_at, used FROM oauth_states;
  ```

## 🔍 Monitoring

- [ ] **Set up Alerts** (optional but recommended)
  - Monitor failed OAuth attempts
  - Track duplicate account attempts
  - Alert on expired states

- [ ] **Regular Cleanup** (set up cron job or manual)
  ```sql
  -- Clean up old oauth_states every day
  DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '1 day';
  ```

## 🐛 Troubleshooting

### Issue: TikTok still auto-authenticates
**Check**: Verify `disable_auto_auth=1` is in the authorize URL  
**Fix**: Look at browser console logs for `[OAuth] Force login enabled`

### Issue: "Invalid state" error
**Check**: State might be expired (>10 minutes)  
**Fix**: Restart OAuth flow, ensure it completes within 10 minutes

### Issue: Database errors
**Check**: Migration might not have run  
**Fix**: Re-run `database-migration.sql`

### Issue: Environment variables not found
**Check**: Vercel dashboard → Settings → Environment Variables  
**Fix**: Add missing variables and redeploy

## 📞 Support

If you encounter issues:
1. Check browser console logs (look for `[OAuth]` prefix)
2. Check Vercel function logs
3. Check database for oauth_states and accounts
4. Review [OAUTH_IMPLEMENTATION.md](OAUTH_IMPLEMENTATION.md)

## 🎉 Success Criteria

✅ OAuth flow completes successfully  
✅ Multiple accounts can be added  
✅ TikTok shows login screen when adding 2nd+ accounts  
✅ Accounts stored in database  
✅ Can switch between accounts  
✅ No CLIENT_SECRET in frontend code  
✅ PKCE S256 working correctly  
✅ State validation prevents CSRF  

---

**Ready to deploy?** Follow the steps above and check them off as you go! 🚀
