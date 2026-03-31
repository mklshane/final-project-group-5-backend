# Auth Workflow

## Overview

Authentication is fully delegated to Supabase. The backend does **not** handle sign-up, login, or token issuance — it only validates tokens issued by Supabase.

---

## Sign-Up / Login (Frontend)

All auth flows are initiated from the mobile app using the Supabase client SDK.

Supported methods (configured in Supabase dashboard):
- **Email + Password** — manual registration and login
- **SSO (Google, etc.)** — OAuth via Supabase providers

On successful auth, Supabase returns a JWT `access_token` to the frontend.

### Auto Profile Creation

When a new user signs up (by any method), the `on_auth_user_created` database trigger fires automatically:

```sql
INSERT INTO profiles (id, email, full_name)
VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
```

No manual profile creation step is needed.

---

## Authenticated API Requests (Frontend → Backend)

Every request to a protected backend endpoint must include the JWT in the header:

```
Authorization: Bearer <access_token>
```

---

## Token Validation (Backend)

All protected routes pass through `src/middleware/auth.js`:

1. Extracts the Bearer token from the `Authorization` header
2. Calls `supabase.auth.getUser(token)` using the **service role key** to validate the token with Supabase
3. Loads the matching row from the `profiles` table
4. Attaches `req.user` (Supabase auth user) and `req.userProfile` (profiles row) to the request
5. Calls `next()` — or returns `401` if any step fails

```
Request
  └── auth middleware
        ├── supabase.auth.getUser(token)   → validates JWT
        ├── profiles.select(...).eq('id')  → loads user profile
        └── next()                         → proceeds to route handler
```

---

## Token Refresh

Token refresh is handled entirely on the frontend by the Supabase SDK. The backend is stateless — it does not store sessions or refresh tokens.

---

## Supabase Clients (Backend)

Two clients are initialized in `src/config/supabase.js`:

| Client | Key Used | Purpose |
|--------|----------|---------|
| `supabase` | `SUPABASE_SERVICE_ROLE_KEY` | General DB queries (bypasses RLS) |
| `supabaseAuth` | `SUPABASE_ANON_KEY` | Auth operations respecting RLS |

---

## Flow Diagram

```
[Mobile App]
    │
    ├── Sign up / Log in via Supabase SDK
    │       └── Supabase creates user + triggers profile insert
    │
    ├── Receives access_token (JWT)
    │
    └── API call with Authorization: Bearer <token>
            │
            ▼
    [Backend: auth middleware]
            │
            ├── Validate token → supabase.auth.getUser()
            ├── Load profile   → profiles table
            └── Attach to req  → next()
                    │
                    ▼
            [Route Handler]
```
