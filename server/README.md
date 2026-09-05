# Account API

## CV persistence

Signed-in users can create and switch between CVs. The editor autosaves after 1.5 seconds of inactivity, including content, name, theme, layout, text scale, and the latest 10 history snapshots. Guest drafts remain browser-local; **Import browser draft** explicitly copies the saved guest CV and history into the current account. Signed-in data is never written into the shared guest localStorage keys. Switching accounts remounts the workspace and reloads that account's CVs.

`GET /api/documents` lists the authenticated user's CVs. `GET /api/documents/:id` loads one. `PUT /api/documents/:id` accepts `{ revision, draft, history }`; new documents use revision 0. Writes atomically compare the expected revision and return 409 on conflict, preserving the existing database record. The UI keeps the unsaved draft available for backup and retry. IDs alone never grant access; all SQL reads and writes include the verified Clerk user ID.

CVs use a separate SQLite table in the existing per-user Durable Object in Cloudflare, and `.data/accounts.sqlite` in local development. There is a 2 MB payload limit per CV including history and a 50 CV storage limit per account. There is no delete endpoint yet. API keys, uploaded AI attachments, and transient UI state are not included. Local development and Cloudflare use separate databases; cross-device access requires deploying the Worker and configuring Clerk authentication as described below.

The existing API now stores a small account record keyed by the verified Clerk user ID. Clerk remains the source of profile information; this service stores account creation time and monthly AI usage. New accounts use the free plan. There is no paid billing integration or per-user quota yet (`aiRequestsPerMonth: null`). Existing hosted AI rate and daily limits still apply.

| Endpoint | Authentication | Response |
| --- | --- | --- |
| `GET /api/me` | Clerk bearer session token | User ID, creation time, free plan, monthly usage |
| `GET /api/me/usage` | Clerk bearer session token | Plan and monthly usage |
| `GET /api/plans` | Public | Free plan definition |

Get a token with Clerk's `useAuth().getToken()` and send `Authorization: Bearer <token>`. User IDs, plans and counters are never accepted from client input. Account reads create a record on first access. Usage counts successful authenticated `/api/ai/revise` requests, including BYOK, and resets at the start of each UTC calendar month. Anonymous AI requests retain existing behavior and are not attributed to an account. Failed requests do not increment usage. This is an operational counter, not an exactly-once billing ledger: a retry after a lost response can count twice.

## Local development

Run `npm run dev`. The Node API verifies Clerk tokens using the existing root `.env` configuration and persists accounts in ignored `.data/accounts.sqlite`. Restart an already-running API after changing backend files. The default allowed token origins are localhost and 127.0.0.1 on ports 5173 and 8080. Override `CLERK_AUTHORIZED_PARTIES` with a comma-separated origin list if needed.

## Cloudflare

The `USER_ACCOUNTS` binding uses one SQLite Durable Object per Clerk user. Counter updates run inside storage transactions. Wrangler's `exports` configuration provisions the class during deployment, matching the project's existing Durable Object setup.

Set `CLERK_SECRET_KEY` as a Worker secret (or `CLERK_JWT_KEY` to the Clerk PEM public key for offline token verification). Set `CLERK_AUTHORIZED_PARTIES` to your exact frontend origins, separated by commas; without it, only the incoming request's origin is accepted. Never put the secret key in `VITE_*` variables. These production settings are not configured by this code change.

To add paid plans later, introduce trusted server-side subscription state and verified billing event handling. Do not expose a client-writable plan field. Profile synchronization and deletion webhooks can be added when the product needs them; no copied email or name is currently stored here.
