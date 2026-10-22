# Deploy DIU Student Hub for free (Vercel + MongoDB Atlas)

The whole app — website **and** API — runs on one free Vercel project. Data and uploaded files live in a free MongoDB Atlas cluster. No server sleeps, nothing expires.

Time needed: about 15 minutes.

---

## 1. Create the database (MongoDB Atlas)

1. Sign up at **https://www.mongodb.com/cloud/atlas/register** (Google sign-in works).
2. Create a cluster → choose **M0 Free** → provider AWS, region **Mumbai (ap-south-1)** or **Singapore** (closest to Bangladesh) → *Create*.
3. **Database user:** *Security → Database Access → Add New Database User*
   - Authentication: Password. Pick a username (e.g. `hubapp`) and click *Autogenerate Secure Password*. Copy the password somewhere safe.
   - Role: *Read and write to any database* → *Add User*.
4. **Network access:** *Security → Network Access → Add IP Address → Allow access from anywhere* (`0.0.0.0/0`) → *Confirm*.
   Vercel's servers use changing IP addresses, so this is required. Your data is still protected by the username and password.
5. **Connection string:** *Database → Connect → Drivers* → copy the string. It looks like:
   ```
   mongodb+srv://hubapp:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
   Replace `<db_password>` with your password, and add the database name `diu_student_hub` after `.net/`:
   ```
   mongodb+srv://hubapp:YOUR_PASSWORD@cluster0.abcde.mongodb.net/diu_student_hub?retryWrites=true&w=majority&appName=Cluster0
   ```
   If the password contains special characters such as `@ : / ? #`, URL-encode them (or regenerate one without them).

## 2. Generate two secrets

Run this twice on your computer and keep both outputs:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

One is your `JWT_SECRET` (signs sign-in sessions), the other is your `CRON_SECRET` (protects the daily reminder job).

## 3. Deploy on Vercel

1. Sign up at **https://vercel.com/signup** with your GitHub account.
2. *Add New… → Project* → import **DIU-STUDENT-HUB**.
3. Leave **Root Directory** as the repository root (`./`). Vercel reads all build settings from `vercel.json`.
4. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | your Atlas connection string from step 1 |
   | `JWT_SECRET` | first secret from step 2 |
   | `CRON_SECRET` | second secret from step 2 |
   | `ADMIN_EMAILS` | the email you will register with (becomes the first admin) |

5. Click **Deploy**. When it finishes you get a URL like `https://diu-student-hub.vercel.app`.

## 4. First run

1. Open your site → **Join free** → register with the email you put in `ADMIN_EMAILS`. You are now the administrator (look for *Admin & moderation* in the sidebar).
2. Ten starter departments are created automatically. Check names in *Admin → Directory* and fix anything that doesn't match DIU's official list.
3. Optional clean-up: once you have your admin account, you can remove `ADMIN_EMAILS` in Vercel (*Settings → Environment Variables*) and redeploy. Promote other moderators from *Admin → Users*.

## 5. Optional

- **Email (password reset & verification):** without email settings, reset links cannot be delivered in production. Add an SMTP provider — e.g. a free Brevo or Resend account — with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, then redeploy.
- **Custom domain:** *Vercel → Project → Settings → Domains*.
- **Every `git push` to `main` redeploys automatically.**

## Free-tier limits to know

| Limit | Value | What it means |
| --- | --- | --- |
| Atlas M0 storage | 512 MB | Holds all data **and** uploaded files. Plenty to start; watch it if many PDFs are uploaded. |
| Upload size | 4 MB per request | Vercel's request limit. Larger PDFs must be compressed or split. |
| Reminders | once a day (03:00 UTC = 9 AM Dhaka) | Vercel's free cron schedule. |
| Rate limits / sign-in lockout | per function instance | Good protection, but not shared across instances. Move to Redis (e.g. Upstash free tier) if you get attacked. |

## Troubleshooting

- **"The database is unavailable right now"** → check `MONGODB_URI` (password, database name) and that Atlas Network Access allows `0.0.0.0/0`. See *Vercel → Project → Logs* for the exact error.
- **Signed out immediately after signing in** → make sure you open the site over `https://` (production cookies are Secure-only).
- **Build fails installing packages** → in Vercel *Settings → General*, set Node.js version to 20 or newer.
