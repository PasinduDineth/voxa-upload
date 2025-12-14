# TikTok Multi-Account OAuth Implementation Guide

This document explains the OAuth 2.0 + PKCE implementation for multi-account TikTok authentication.

## 🔐 Security Features Implemented

### 1. **PKCE (Proof Key for Code Exchange) with S256**
- ✅ Server generates cryptographically secure `code_verifier` (43+ characters)
- ✅ Server generates `code_challenge` using SHA-256: `base64url(SHA256(code_verifier))`
- ✅ Client receives both and stores temporarily in `sessionStorage`
- ✅ TikTok validates the code_challenge during authorization
- ✅ Server validates the code_verifier during token exchange

### 2. **State Parameter for CSRF Protection**
- ✅ Server generates cryptographically secure random state (256-bit)
- ✅ State is stored in database with code_verifier
- ✅ State is validated in callback before token exchange
- ✅ State is marked as "used" after validation to prevent replay attacks
- ✅ State expires after 10 minutes

### 3. **Client Secret Protection**
- ✅ `CLIENT_SECRET` is NEVER exposed to frontend
- ✅ Token exchange happens entirely on server-side API endpoint
- ✅ Only `CLIENT_KEY` is in frontend (it's meant to be public)

### 4. **Multi-Account Support**
- ✅ `disable_auto_auth=1` parameter added when adding 2nd+ accounts
- ✅ Each account has unique `open_id` in database
- ✅ Database prevents duplicate accounts via unique constraint
- ✅ Supports multiple accounts per user/workspace

### 5. **Comprehensive Logging**
- ✅ All OAuth steps logged with context
- ✅ Error tracking with detailed messages
- ✅ Token exchange success/failure logged
- ✅ User actions logged (account switch, removal, etc.)

## 🔄 OAuth Flow

```
┌─────────────┐                                           ┌──────────────┐
│   Browser   │                                           │   TikTok     │
└──────┬──────┘                                           └──────┬───────┘
       │                                                          │
       │ 1. Click "Add Account"                                  │
       │────────────────────────────────────────────────────────►│
       │                                                          │
       │ 2. POST /api/init-oauth                                 │
       │────────────────────────────────────────────────────────►│
       │    - Server generates state + code_verifier             │
       │    - Server generates code_challenge = SHA256(verifier) │
       │    - Server stores state+verifier in DB                 │
       │    - Returns: state, code_challenge, code_verifier      │
       │                                                          │
       │ 3. Redirect to TikTok authorize URL                     │
       │    ?client_key=XXX                                      │
       │    &state=XXX                                           │
       │    &code_challenge=XXX                                  │
       │    &code_challenge_method=S256                          │
       │    &disable_auto_auth=1  ← Forces login screen          │
       │────────────────────────────────────────────────────────►│
       │                                                          │
       │                    4. User logs in / authorizes          │
       │◄─────────────────────────────────────────────────────────│
       │                                                          │
       │ 5. Redirect to callback URL                             │
       │    ?code=XXX&state=XXX                                  │
       │◄─────────────────────────────────────────────────────────│
       │                                                          │
       │ 6. POST /api/oauth-callback                             │
       │    { code, state, code_verifier }                       │
       │────────────────────────────────────────────────────────►│
       │    - Server validates state from DB                     │
       │    - Server exchanges code for access_token             │
       │    - Server fetches user info                           │
       │    - Server saves account to DB (keyed by open_id)      │
       │    - Returns: { open_id, display_name, avatar_url }     │
       │                                                          │
       │ 7. Account connected successfully!                      │
       │◄─────────────────────────────────────────────────────────│
       │                                                          │
```

## 📁 File Structure

```
api/
  ├── init-oauth.js          # Generates state + PKCE parameters
  ├── oauth-callback.js      # Server-side token exchange + validation
  ├── get-accounts.js        # Fetch all accounts from DB
  ├── save-account-to-db.js  # Save/update account
  └── delete-account.js      # Remove account

src/
  ├── services/
  │   └── tiktokApi.js       # OAuth client-side logic (NO secrets!)
  └── components/
      └── TikTokUploader.js  # UI component

database-migration.sql       # Database schema for oauth_states table
```

## 🗄️ Database Schema

### `oauth_states` Table
```sql
CREATE TABLE oauth_states (
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
```

### `accounts` Table
```sql
CREATE TABLE accounts (
  open_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  display_name VARCHAR(255),
  avatar_url TEXT,
  scope TEXT,
  user_id VARCHAR(255),
  workspace_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create `.env.local` (for local development) or set in Vercel dashboard:

```bash
# Server-side only (NEVER expose in frontend)
TIKTOK_CLIENT_KEY=your_client_key_here
TIKTOK_CLIENT_SECRET=your_client_secret_here
TIKTOK_REDIRECT_URI=https://www.pasindu.website/callback

# Frontend (exposed to client)
REACT_APP_TIKTOK_CLIENT_KEY=your_client_key_here
REACT_APP_REDIRECT_URI=https://www.pasindu.website/callback
```

### 3. Run Database Migration
Run the SQL in `database-migration.sql` in your Vercel Postgres database:

```bash
# Option 1: Using Vercel dashboard
1. Go to Vercel Dashboard → Storage → Your Postgres DB
2. Click "Query" tab
3. Paste contents of database-migration.sql
4. Execute

# Option 2: Using psql command line
psql $POSTGRES_URL -f database-migration.sql
```

### 4. Deploy to Vercel
```bash
vercel --prod
```

## 🧪 Testing Multi-Account Flow

### Test Case 1: Add First Account
1. Click "Add Your First Account"
2. Should redirect to TikTok authorization
3. Log in with Account A
4. Should redirect back and save Account A
5. ✅ Success: Account A shown in account list

### Test Case 2: Add Second Account (Different TikTok User)
1. Click "+ Add Another Account"
2. Should redirect to TikTok with `disable_auto_auth=1`
3. **Expected**: TikTok shows login screen (not auto-auth)
4. Log in with Account B (different from Account A)
5. Should redirect back and save Account B
6. ✅ Success: Both Account A and B shown in account list

### Test Case 3: Re-authenticate Existing Account
1. Click "+ Add Another Account"
2. Log in with Account A (already connected)
3. **Expected**: Tokens updated, but no duplicate created
4. ✅ Success: Still only 2 accounts (A and B)

### Test Case 4: State Validation
1. Start OAuth flow (note the state parameter in URL)
2. Wait 11 minutes
3. Try to complete the flow
4. ✅ Success: Should reject with "Invalid or expired state"

### Test Case 5: CSRF Attack Prevention
1. Start OAuth flow with state=ABC123
2. Manually change URL to state=XYZ789
3. Try to complete the flow
4. ✅ Success: Should reject with "Invalid state"

## 🔍 Debugging

### Enable Console Logs
All OAuth steps are logged with `[OAuth]` prefix:
```javascript
console.log('[OAuth] Initializing OAuth flow', { forceLogin });
console.log('[OAuth] Token exchange successful', { open_id });
```

### Common Issues

#### Issue 1: TikTok Auto-Authenticates Previous Account
**Cause**: `disable_auto_auth=1` not included in authorize URL  
**Fix**: Ensure `forceLogin=true` is passed when adding 2nd+ accounts

#### Issue 2: "Invalid state" Error
**Cause**: State expired or CSRF attack  
**Fix**: Restart OAuth flow, ensure state is fresh (<10 minutes)

#### Issue 3: "Code verifier mismatch"
**Cause**: code_verifier in sessionStorage doesn't match DB  
**Fix**: Clear sessionStorage and restart OAuth flow

#### Issue 4: Duplicate Accounts
**Cause**: Unique constraint not enforced  
**Fix**: Run database migration to add unique index on `open_id`

## 🔐 Security Best Practices

1. ✅ **Never expose CLIENT_SECRET** - It's server-side only
2. ✅ **Use sessionStorage** - For temporary OAuth data (not localStorage)
3. ✅ **Validate state** - Always validate state parameter in callback
4. ✅ **Use HTTPS** - All OAuth endpoints must use HTTPS in production
5. ✅ **Expire states** - Auto-delete states older than 10 minutes
6. ✅ **Mark states as used** - Prevent replay attacks
7. ✅ **Use S256 for PKCE** - SHA-256 is more secure than "plain"
8. ✅ **Log everything** - Track OAuth flow for debugging and security

## 📝 API Endpoints

### `POST /api/init-oauth`
Initialize OAuth flow
```json
Request:  { "user_id": "user123", "workspace_id": "workspace456" }
Response: { 
  "success": true,
  "data": {
    "state": "abc123...",
    "code_challenge": "xyz789...",
    "code_challenge_method": "S256",
    "code_verifier": "def456..."
  }
}
```

### `POST /api/oauth-callback`
Exchange authorization code for access token
```json
Request:  { 
  "code": "auth_code_from_tiktok",
  "state": "abc123...",
  "code_verifier": "def456..."
}
Response: { 
  "success": true,
  "data": {
    "open_id": "tiktok_user_open_id",
    "display_name": "John Doe",
    "avatar_url": "https://...",
    "is_new": true
  }
}
```

### `GET /api/get-accounts`
Fetch all connected accounts
```json
Response: {
  "success": true,
  "accounts": [
    {
      "open_id": "user1",
      "display_name": "Account 1",
      "avatar_url": "https://...",
      "access_token": "token1"
    }
  ]
}
```

## 📚 References

- [TikTok OAuth 2.0 Documentation](https://developers.tiktok.com/doc/login-kit-web)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## ✅ Implementation Checklist

- [x] PKCE with S256 implemented
- [x] State parameter validated
- [x] Token exchange on server-side only
- [x] CLIENT_SECRET removed from frontend
- [x] disable_auto_auth=1 added for multi-account
- [x] Comprehensive logging added
- [x] Database schema updated
- [x] Duplicate account prevention
- [x] State expiration (10 minutes)
- [x] State replay attack prevention
- [x] Error handling throughout flow

## 🎉 Done!

Your TikTok multi-account OAuth flow is now secure and production-ready!
