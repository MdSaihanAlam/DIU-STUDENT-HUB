# DIU Student Hub

An independent, community-run platform for students, faculty, researchers and alumni of **Dhaka International University (DIU)**: social feed, notes library, housing marketplace, department & faculty directory, research hub, alumni network, careers, events, communities, messaging and a moderation dashboard.

> DIU Student Hub is **not** operated, approved or endorsed by Dhaka International University. All seeded people, publications, listings and opportunities are **fictional sample data** and are labeled as such in the UI.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite 6, React Router 7, Lucide icons, plain CSS design system (tokens, light/dark, Inter + Plus Jakarta Sans) |
| Backend | Node.js (≥20) + Express 4, REST under `/api/v1` |
| Database | MongoDB + Mongoose 8 |
| Auth | HS256-pinned JWT in an HttpOnly `__Host-` cookie, bcrypt (cost 12), double-submit CSRF token, progressive lockout |
| Validation | zod (whitelists fields, so `role`, `owner`, `verified` etc. can never be set by clients) |
| Files | Pluggable storage interface (`server/src/services/storage.js`), local-disk driver included |
| Tests | `node:test` + supertest + mongodb-memory-server |

## Quick start (no MongoDB install needed)

```bash
npm install
npm run dev:mem
```

This starts the API on `http://localhost:5000` with an **in-memory MongoDB** (downloaded automatically on first run, ~600 MB, cached afterwards), seeds demo data, and starts the web app on **http://localhost:5173**. Data resets on every restart.

### With a real MongoDB (local or Atlas)

```bash
cp server/.env.example server/.env      # then edit MONGODB_URI and JWT_SECRET
npm run seed                             # optional: load demo data (refuses to run in production)
npm run dev
```

### Development accounts

Created by the seed script only (it refuses to run when `NODE_ENV=production`). Password for all: `DemoPass123`

| Email | Role |
| --- | --- |
| `admin@demo.diuhub.test` | Administrator |
| `moderator@demo.diuhub.test` | Moderator |
| `student@demo.diuhub.test` | Verified student (has notifications, messages, connections) |
| `faculty@demo.diuhub.test` | Verified faculty (can publish official announcements/events) |
| `alumni@demo.diuhub.test` | Verified alumni (mentor) |
| `pending.faculty@demo.diuhub.test` | Faculty awaiting verification |

Without SMTP configured, password-reset and email-verification links are printed to the API console in development.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) + client, using `server/.env` |
| `npm run dev:mem` | Same, with in-memory MongoDB and auto-seed |
| `npm run seed` | Reset the database to demo data |
| `npm test` | Server integration tests (37 tests: auth, CSRF, permissions, posts, uploads, moderation, privacy, password policy, lockout, sessions, headers) |
| `npm run lint` | ESLint for the client |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API in production mode |

## Project structure

```
client/                 React SPA
  src/components/       ui.jsx (buttons, fields, dialogs, tabs, skeletons, empty/error states, file drop…)
                        common.jsx (save/report buttons, mentions, rich text, department pickers…)
  src/context/          Auth, Theme (light/dark, sidebar), Toasts
  src/features/posts/   Composer, PostCard, Comments
  src/hooks/            useApi, usePaginated, useQueryFilters, useDebounce, useInterval…
  src/layouts/          AppLayout (topbar, collapsible sidebar, right rail, mobile bottom nav), PublicLayout
  src/pages/            one folder per feature (auth, feed, resources, housing, directory, research,
                        alumni, careers, events, communities, social, profile, admin)
  src/services/api.js   fetch wrapper (cookies, CSRF, error normalisation, session-expiry event)
  src/styles/           tokens.css, global.css, layout.css, features.css
server/
  src/config/           env + MongoDB connection (supports in-memory dev DB)
  src/models/           Mongoose schemas
  src/validators/       zod request schemas
  src/middleware/       auth, CSRF/sanitising/rate limits, validation, uploads, errors
  src/controllers/      feature controllers
  src/routes/           feature routers mounted under /api/v1
  src/services/         storage, mail, notifications, audit log, reminder job
  scripts/seed.js       demo data
  tests/                integration tests
docs/API.md             endpoint reference
```

## Architecture notes

**Roles.** Two separate concepts: *affiliation* (`student` / `faculty` / `alumni`, self-declared, trusted only after a moderator approves a `VerificationRequest`) and *platform role* (`member` / `moderator` / `admin`, set only by admins). Every permission is checked on the server; the React UI only hides buttons for convenience.

**Data model (main relationships).**
- `User` 1—1 `AlumniProfile`; `User` 0..1—1 `FacultyProfile` (directory entries are admin-managed and can exist without an account).
- `Post` → author `User`, optional `Community`, optional `sharedFrom` `Post`; `Comment` → `Post` (+ one level of replies); `Reaction` unique per (post, user).
- `Community` ↔ `User` through `CommunityMembership` (role + pending/active).
- `AcademicResource`, `HousingListing`, `ResearchProject`, `CareerOpportunity`, `Event` each have an owner field and a review/status field.
- Polymorphic `Bookmark` and `Report` (`targetType` + `targetId`); `Notification`, `Connection` (connection or mentorship), `Conversation` + `Message`, `VerificationRequest`, `AuditLog`.
- Counters (`reactionCount`, `commentCount`, `memberCount`, `downloads`) are denormalised and updated atomically with `$inc`.

**Deletion strategy.** Content is soft-deleted (`status: removed`) so reports and audit history stay consistent. Account deletion deactivates immediately; an admin "Erase now" (or a scheduled job you add) anonymises the user, removes their posts, listings, uploads and sent messages, and deletes stored files.

**Messaging.** REST + polling (5 s in an open thread, 30 s for badges). Conversations with non-connections start as requests; recipients can accept, decline or block. No websockets are required for hosting; add Socket.IO later if needed. Messages are not end-to-end encrypted.

**Reminders.** An hourly in-process job creates notifications for saved events starting within 24 h and saved opportunities closing within 3 days (dedupe keys prevent repeats). On multi-instance deployments, run it in one instance only or move it to a cron worker.

## Security measures

**Accounts & sessions**
- Passwords: bcrypt (cost 12); minimum 10 characters, maximum 72 bytes (bcrypt's limit, so nothing is silently truncated); common/breached passwords and passwords containing the user's name or email are rejected. No arbitrary composition rules (NIST SP 800-63B guidance) — the UI shows a strength meter instead.
- Brute-force protection: per-IP rate limits plus a per-email progressive lockout (5 free attempts, then 1 → 2 → 4 … 30 min). Unknown emails get identical treatment and timing, so sign-in never reveals which accounts exist.
- Sessions: HS256-pinned JWT (issuer + audience checked; `alg: none` and foreign keys rejected) in an HttpOnly, `Secure`, `__Host-`-prefixed cookie in production. A token version on the user revokes every session on password change/reset, suspension or "Sign out of all devices".
- Sensitive actions re-authenticate: changing the password needs the current one; deleting the account needs the password. Password changes trigger an email notice. Settings show the last sign-in time.

**Requests**
- Double-submit CSRF token (also `__Host-` prefixed) on every non-GET request; strict CORS allowlist (`CLIENT_ORIGINS`).
- zod validation and whitelisting on every write (clients can never set `role`, `owner`, `verified`…); `$`/dotted keys stripped; query strings parsed flat — repeated parameters collapse to one string (blocks parameter pollution and operator smuggling); search terms regex-escaped and length-capped.
- Rate limits on auth, writes and the whole API.

**Responses & headers**
- API: `default-src 'none'` CSP, `frame-ancestors 'none'`, HSTS (production), `no-referrer`, `nosniff`, Permissions-Policy, and `Cache-Control: no-store` on all personal-data responses. Errors never leak stack traces in production; request bodies are never logged.
- Frontend (`client/vercel.json`): strict CSP with `script-src 'self'` (the theme bootstrap script is an external file so no inline script is needed), HSTS, `X-Frame-Options: DENY`, COOP, Permissions-Policy.
- Open-redirect protection on `?next=` after sign-in (rejects `//`, `/\` and encoded variants).

**Files & privacy**
- Uploads: size-limited, extension + MIME + magic-byte checks, random server-generated names, never executed, served with `nosniff` and a sandboxing CSP; course files only through permission-checked download routes.
- Contact details private by default (emails, housing contacts, alumni contact are opt-in). No secrets in the repo.
- Dependencies: `npm audit --omit=dev` reports 0 known vulnerabilities (nodemailer and react-router were upgraded to patched versions).

**Remaining risks / to do before production:** no antivirus scanning of uploads; no image re-encoding (EXIF metadata is preserved); rate limits and sign-in lockout counters live in process memory (use a shared store such as Redis behind multiple instances); no two-factor authentication yet; email verification is tracked but not required; no automated purge job for the 14-day deletion grace period; the common-password list is short (swap in a larger breached-password list or the HIBP range API); the app has not had an external security review or penetration test.

## Deployment

1. **Database:** create a MongoDB Atlas cluster, a database user, and allow your API host's IPs. Copy the connection string to `MONGODB_URI`.
2. **API (e.g. Render, Railway, Fly.io):** root `server`, build `npm install`, start `npm start`, health check `/api/v1/health`. Set environment variables:
   - `NODE_ENV=production`, `PORT`, `MONGODB_URI`
   - `JWT_SECRET` (≥32 random characters)
   - `CLIENT_ORIGINS=https://your-frontend.example` and `CLIENT_URL=https://your-frontend.example`
   - `COOKIE_SAMESITE=none` if the frontend and API are on different sites (requires HTTPS), otherwise `lax`
   - `TRUST_PROXY=1` behind a proxy/load balancer
   - `SMTP_*` and `MAIL_FROM` for password reset and verification emails
   - Storage: the local driver needs a **persistent disk** (`UPLOAD_DIR` pointing at it). For S3/R2/B2, implement the four-method driver in `server/src/services/storage.js` and set `STORAGE_DRIVER`.
3. **Frontend on Vercel:** import the repo with root directory `client` (framework: Vite). In `client/vercel.json`, replace `REPLACE-WITH-YOUR-API-HOST` with your API's host (e.g. `diu-hub-api.onrender.com`). Vercel then proxies `/api/*` to the API, so the browser sees one site: cookies stay first-party, keep `COOKIE_SAMESITE=lax`, and leave `VITE_API_URL` empty. `vercel.json` also adds the SPA fallback and all security headers. (If you instead call the API cross-site via `VITE_API_URL`, set `COOKIE_SAMESITE=none` and add the API origin to the CSP `connect-src`/`img-src`.)
4. Create the first admin: register normally, then in MongoDB set `role: "admin"` on that user (there is intentionally no way to self-promote).

Never commit `.env` files, uploaded files (`server/uploads/`) or build output.

## Feature status

**Complete:** registration/login/logout, forgot/reset password, email verification (console or SMTP), onboarding with optional photo, protected routes, session expiry handling; feed with latest/relevant/department/communities/connections filters, search, hashtags, infinite scroll, posts with images/documents, questions, announcements (official vs community), research updates, polls, reactions, threaded comments, @mentions, internal sharing, edit/delete, bookmarks, reports, trending; notes library with filters, upload review, preview, download counts, ratings, copyright takedown reports; housing with filters, photos, private contact, in-app enquiry, rented/expiry; departments & faculty directory with admin management; research hub with review/verification, follow, updates, files, collaboration requests, featuring; alumni directory, mentorship requests, success stories; careers with verified/community labels and deadline reminders; events with calendar view, iCal export, reminders; communities with public/private join, moderators, pinned resources, pinned posts; connections; direct messages with requests and blocking; notifications with read/unread; global search across 9 content types; profile, privacy, notification, password, verification and account-deletion settings; admin dashboard (stats, verification, reports, review queues, users/roles/suspension/erasure, featured content, directory, audit log); light/dark mode; responsive desktop/tablet/mobile layouts.

**Partial:** messaging is polling-based (no live typing/presence); file preview supports PDF, images and text (Office files download only); the "relevant" feed is a simple engagement and recency score; account erasure after the grace period is a manual admin action.

**Not implemented:** object-storage driver (interface ready), push/email notifications (in-app only), image resizing, Bangla UI translation, OAuth sign-in, two-factor authentication, client unit tests.
