# Facebook Quick Reference - Token-Based

Ultra-quick reference for Facebook integration.

---

## 🚀 3-Step Setup

### Step 1: Generate Token
```
1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app
3. Click "Generate Access Token"
4. Select all your pages
5. Grant permissions
6. Copy token
7. Click "Extend Access Token" (makes it last 60 days)
```

### Step 2: Add to App
```
1. Open app → Facebook tab
2. Click "Add Facebook Pages"
3. Paste token
4. Click "Add Facebook Pages"
```

### Step 3: Upload
```
1. Select page
2. Choose video
3. Add title
4. Click upload
```

---

## 🔑 No Environment Variables Needed!

Token-based approach = **Zero env vars required** ✅

---

## 📁 Files Created

### API (1 file)
- `api/facebook-accounts.js`

### Frontend (2 files)
- `src/services/facebookApi.js`
- `src/components/FacebookUploader.js`

### Updated (2 files)
- `src/App.js`
- `DATABASE_SCHEMA.md`

**Total**: Only 3 new files!

---

## 📊 Database

Uses existing `accounts` table with `type='FACEBOOK'` ✅

No additional tables needed for token-based approach.

---

## 🌐 Important URLs

- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **Access Token Tool**: https://developers.facebook.com/tools/accesstoken/
- **Your App Dashboard**: https://developers.facebook.com/apps/

---

## 📝 Token Permissions Required

```
pages_show_list
pages_read_engagement
pages_manage_posts
pages_manage_metadata
```

---

## 🚀 Deployment

```bash
# No environment variables to set! Just deploy:
git add .
git commit -m "Add Facebook integration (token-based)"
git push
```

---

## 🧪 Testing

```
1. Generate token
2. Add pages in app
3. Upload test video
4. Check Facebook Page
5. ✅ Done!
```

---

## 📏 Video Limits

- **Max Size**: 1GB
- **Max Duration**: 240 minutes
- **Formats**: MP4, MOV, AVI, WMV, FLV, 3GP, WebM

---

## 🔧 Token Maintenance

**Token lasts**: 60 days (if extended)

**To refresh**:
1. Go to Graph API Explorer
2. Generate new token
3. Paste in app
4. Pages automatically update

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No pages found | Select pages when generating token |
| Token expired | Generate new token (every ~60 days) |
| Upload fails | Check video size < 1GB |
| Permission error | Regenerate token with all permissions |

---

## 📞 Documentation Files

- `FACEBOOK_SETUP_GUIDE.md` - Full setup
- `FACEBOOK_INTEGRATION.md` - Technical details
- This file - Quick reference

---

## ✅ Checklist

- [x] Facebook App created
- [x] Token generated from Graph API Explorer
- [x] Token extended to 60 days
- [x] Pages added in app
- [x] Test video uploaded
- [x] Ready to use!

---

## 💡 Pro Tips

- Extend token immediately after generation (60 days vs 1 hour)
- Save your token somewhere safe for refreshing
- Add all pages at once - token fetches them all
- Token is user-specific - each user generates their own

---

## 🎉 Why Token-Based?

✅ Simpler (no OAuth)  
✅ Faster (3 steps vs 10)  
✅ Fewer files (1 API vs 3)  
✅ No env vars needed  
✅ Perfect for Vercel limits

---

**That's it! Simplest Facebook integration possible.** 🚀

---

## 📊 Database Table (Already Created ✅)

```sql
CREATE TABLE IF NOT EXISTS facebook_oauth_states (
    id SERIAL PRIMARY KEY,
    state VARCHAR(255) UNIQUE NOT NULL,
    code_verifier VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    workspace_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facebook_state ON facebook_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_facebook_created_at ON facebook_oauth_states(created_at);
CREATE INDEX IF NOT EXISTS idx_facebook_used ON facebook_oauth_states(used);
```

---

## 📁 New Files Created

### API (3 files)
- `api/facebook-init-oauth.js`
- `api/facebook-oauth-callback.js`
- `api/facebook-accounts.js`

### Frontend (2 files)
- `src/services/facebookApi.js`
- `src/components/FacebookUploader.js`

### Updated (2 files)
- `src/App.js`
- `DATABASE_SCHEMA.md`

### Docs (4 files)
- `FACEBOOK_SETUP_GUIDE.md`
- `FACEBOOK_INTEGRATION.md`
- `DEPLOYMENT_CHECKLIST_FACEBOOK.md`
- `README_FACEBOOK.md`

---

## 🚀 Deployment Commands

```bash
# Commit changes
git add .
git commit -m "feat: Add Facebook Page integration"
git push

# Or use Vercel CLI
vercel --prod
```

---

## 🧪 Testing URLs

After deployment, test these endpoints:

```
GET  https://your-app.vercel.app/api/facebook-accounts
POST https://your-app.vercel.app/api/facebook-init-oauth
POST https://your-app.vercel.app/api/facebook-oauth-callback
```

---

## 🔗 Important URLs

- **Facebook Developer:** https://developers.facebook.com/apps/
- **Graph API Explorer:** https://developers.facebook.com/tools/explorer/
- **Graph API Docs:** https://developers.facebook.com/docs/graph-api/
- **Video API Docs:** https://developers.facebook.com/docs/video-api/

---

## 📝 Common Graph API Endpoints

```bash
# Get user's pages
GET /me/accounts?access_token={token}

# Upload video to page
POST /{page-id}/videos
  - source: {video_file}
  - description: {text}
  - access_token: {page_token}

# Get page info
GET /{page-id}?fields=id,name,picture&access_token={token}
```

---

## 🎨 Facebook Brand Colors

```css
Primary Blue: #1877f2
Light Blue: #e7f3ff
Dark Blue: #0c63d4
```

---

## 📏 Video Requirements

- **Max Size:** 1GB (direct upload)
- **Max Duration:** 240 minutes
- **Formats:** MP4, MOV, AVI, WMV, FLV, 3GP, WebM
- **Aspect Ratios:** 16:9, 9:16, 4:5, 1:1

---

## 🔒 Security Checklist

- [x] Use HTTPS for redirect URIs
- [x] Enable "Use Strict Mode for Redirect URIs"
- [x] Never commit App Secret to Git
- [x] Use environment variables
- [x] Implement PKCE flow
- [x] Validate state parameter
- [x] Expire states after 10 minutes

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| OAuth redirect fails | Check redirect URI matches exactly |
| Can't see pages | Verify you're a page admin |
| Upload fails | Check file size (< 1GB) |
| "App Not Set Up" | Add Facebook Login product |
| Environment vars not working | Redeploy after adding them |

---

## 📞 Support Resources

1. **Your Documentation:**
   - `FACEBOOK_SETUP_GUIDE.md` - Full setup
   - `FACEBOOK_INTEGRATION.md` - Technical details
   - `DEPLOYMENT_CHECKLIST_FACEBOOK.md` - Deploy steps

2. **Facebook Resources:**
   - Developer Docs: https://developers.facebook.com/docs/
   - Community Forum: https://developers.facebook.com/community/
   - Bug Reports: https://developers.facebook.com/support/bugs/

---

## ✅ Pre-Launch Checklist

Quick final checks before going live:

- [ ] Environment variables set
- [ ] OAuth redirect URIs configured
- [ ] Permissions requested
- [ ] Facebook Login added
- [ ] App deployed to Vercel
- [ ] OAuth flow tested
- [ ] Video upload tested
- [ ] Privacy Policy URL set
- [ ] App icon uploaded
- [ ] Switched to Live mode

---

## 🎯 Next Steps

1. **Now:** Set environment variables
2. **Now:** Configure Facebook App OAuth settings
3. **Today:** Deploy and test in Development mode
4. **This week:** Request Advanced Access
5. **After approval:** Switch to Live mode

---

## 💡 Pro Tips

- Test with multiple pages before going live
- Use Graph API Explorer for debugging
- Monitor rate limits in Developer Dashboard
- Keep App Secret secure at all times
- Add logging to track issues

---

**Save this file for quick reference!** 📌

---

**Ready to deploy?** Follow `DEPLOYMENT_CHECKLIST_FACEBOOK.md`

**Need detailed setup?** Read `FACEBOOK_SETUP_GUIDE.md`

**Happy coding!** 🚀
