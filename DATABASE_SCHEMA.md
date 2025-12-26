# Database Schema

Database structure for TikTok, YouTube, and Facebook video uploader application.

---

## Table: `accounts`

Stores authenticated social media accounts (TikTok, YouTube channels, and Facebook Pages).

| Column Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `open_id` | VARCHAR(255) | NOT NULL, UNIQUE | TikTok open_id, YouTube channel_id, or Facebook page_id |
| `access_token` | TEXT | NOT NULL | OAuth access token for API calls |
| `refresh_token` | TEXT | | OAuth refresh token (YouTube only) |
| `display_name` | VARCHAR(255) | | Account display name, channel title, or page name |
| `avatar_url` | TEXT | | Profile picture, thumbnail URL, or page picture |
| `scope` | TEXT | | OAuth scopes granted |
| `expires_at` | TIMESTAMP | | Token expiration timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When account was first added |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last token refresh or update |
| `user_id` | VARCHAR(255) | | User identifier (for multi-user support) |
| `workspace_id` | VARCHAR(255) | | Workspace identifier (for team support) |
| `type` | VARCHAR(50) | NOT NULL | Platform type: 'TIKTOK', 'YOUTUBE', or 'FACEBOOK' |

**Indexes:**
- `idx_accounts_open_id` on `open_id`
- `idx_accounts_user_id` on `user_id`
- `idx_accounts_workspace_id` on `workspace_id`
- `idx_accounts_type` on `type`
- `idx_accounts_unique_open_id` (unique) on `open_id`

---

## Table: `oauth_states`

Temporary OAuth state data for TikTok authentication (PKCE + CSRF protection).

| Column Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `state` | VARCHAR(255) | UNIQUE, NOT NULL | Random state parameter for CSRF protection |
| `code_verifier` | VARCHAR(255) | NOT NULL | PKCE code verifier |
| `code_challenge` | VARCHAR(255) | NOT NULL | PKCE code challenge |
| `user_id` | VARCHAR(255) | | User identifier (optional) |
| `workspace_id` | VARCHAR(255) | | Workspace identifier (optional) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When state was created |
| `used` | BOOLEAN | DEFAULT FALSE | Whether state has been consumed |
| `used_at` | TIMESTAMP | | When state was used |

**Indexes:**
- `idx_state` on `state`
- `idx_created_at` on `created_at`
- `idx_used` on `used`

**Lifecycle:** Valid for 10 minutes, automatically cleaned up after use.

---

## Table: `youtube_oauth_states`

Temporary OAuth state data for YouTube authentication (PKCE + CSRF protection).

| Column Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `state` | VARCHAR(255) | UNIQUE, NOT NULL | Random state parameter (prefixed with 'youtube_') |
| `code_verifier` | VARCHAR(255) | NOT NULL | PKCE code verifier |
| `code_challenge` | VARCHAR(255) | NOT NULL | PKCE code challenge |
| `user_id` | VARCHAR(255) | | User identifier (optional) |
| `workspace_id` | VARCHAR(255) | | Workspace identifier (optional) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When state was created |
| `used` | BOOLEAN | DEFAULT FALSE | Whether state has been consumed |
| `used_at` | TIMESTAMP | | When state was used |

**Indexes:**
- `idx_youtube_state` on `state`
- `idx_youtube_created_at` on `created_at`
- `idx_youtube_used` on `used`

**Lifecycle:** Valid for 10 minutes, state values prefixed with `youtube_`, automatically cleaned up after use.

---

## ~~Table: `facebook_oauth_states`~~ (Not Used - Token-Based Approach)

**Note:** The Facebook integration uses a **token-based approach** instead of OAuth flow, so this table is **not needed**. You can keep it or drop it - it won't be used.

If you want to drop it (optional):
```sql
DROP TABLE IF EXISTS facebook_oauth_states;
```

---

## Platform-Specific Notes

### TikTok
- Uses `oauth_states` table
- Access tokens expire after 24 hours
- No refresh token
- `open_id` = TikTok user identifier
- `type = 'TIKTOK'`

### YouTube
- Uses `youtube_oauth_states` table
- Access tokens expire after 1 hour
- Refresh tokens are long-lived
- `open_id` = YouTube channel ID (starts with 'UC')
- `type = 'YOUTUBE'`
- Multiple channels per Google account supported

### Facebook (Token-Based Approach)
- **No OAuth state table needed**
- Users generate access tokens from Graph API Explorer
- Page access tokens are long-lived (60 days)
- Tokens stored directly in `accounts` table
- `open_id` = Facebook Page ID
- `type = 'FACEBOOK'`
- Multiple pages per Facebook account supported
- **Simplest integration** - no OAuth flow complexity
