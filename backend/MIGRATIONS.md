# Database Migrations & Security Decisions

## Migration 001 — Plaintext Token Deprecation & JWT Authentication Overhaul (Phase 0)

### 1. Schema Changes
- **`User` Model:**
  - Removed `token` field (`{ type: String, default: null }`).
  - Authentication tokens are no longer stored in plaintext on the user document.
- **`RefreshToken` Model (New Collection):**
  - Schema:
    - `userId`: ObjectId ref to User (required, indexed)
    - `tokenHash`: SHA-256 hash string (required, indexed)
    - `expiresAt`: Date with TTL index `{ expires: 0 }` for automatic MongoDB deletion
    - `createdAt`: Date (default: Date.now)
    - `revokedAt`: Date (default: null, set on rotation or logout)

### 2. User Migration & Session Invalidation
- All legacy sessions relying on arbitrary hex `user.token` are invalidated upon deployment.
- Users are required to re-authenticate via `/login` to obtain a dual JWT token pair:
  - Short-lived Access Token (15 minutes, signed with `JWT_SECRET`)
  - Long-lived Opaque Refresh Token (30 days, hashed in database, signed with `JWT_REFRESH_SECRET`)

### 3. Security Decisions & Known Tradeoffs
- **Current State (Phase 0):**
  - Both `accessToken` and `refreshToken` are stored in client `localStorage` to preserve SPA simplicity and backward compatibility during initial hardening.
  - *Risk:* `localStorage` is accessible via JavaScript and therefore vulnerable to Cross-Site Scripting (XSS).
- **Roadmap (Pre-Launch Production Hardening):**
  - Refresh tokens will be migrated to `httpOnly`, `SameSite=Strict`, `Secure` HTTP cookies to prevent JavaScript exfiltration.
  - CSRF protection will be enforced on token refresh and session state endpoints.
  - Access tokens will remain strictly in memory within the client application runtime.

### 4. Mandatory Operator Actions (Git Secret Hygiene)
- **Credential Rotation:** The MongoDB Atlas connection string previously committed in `backend/src/app.js` (`silentsyntax7_antarsetu_cluster`) must be immediately rotated in the MongoDB Atlas console.
- **Git History Purge:** To ensure the leaked secret does not persist in git history, run `git filter-repo` or BFG Repo-Cleaner:
  ```bash
  # Example using git filter-repo to scrub the credential
  git filter-repo --replace-text <(echo "mongodb+srv://silentsyntax7_antarsetu_cluster:antarsetu2506@antarsetu-cluster.ughdtod.mongodb.net/==>REDACTED")
  ```
