# Convention Submission Portal

Membership validation portal for English Honor Societies convention submissions
(Sigma Tau Delta / Sigma Kappa Delta). Students verify their membership —
organization → school → name — and are forwarded to their personal submission
page. Admins manage the roster and bulk-import it by CSV each convention cycle.

Rebuild of the earlier Supabase/Vercel app on Next.js 15 + Neon Postgres +
Drizzle, deployed to Railway under the organization's account.

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS 4
- Neon Postgres via Drizzle ORM
- Signed-cookie admin sessions, scrypt password hashing (no external auth)
- Railway hosting

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and SESSION_SECRET
npm run db:push        # create tables in Neon
SEED_ADMIN_EMAIL=you@example.com npm run db:seed   # seed orgs + first admin
npm run dev
```

`/` is the public portal, `/admin` the dashboard.

## CSV import format

Same as the old app, so existing files keep working:

```csv
organization,school,member_name,submission_url
Sigma Tau Delta,University of Georgia,Jane Smith,https://example.com/submit/jane-smith
```

Import is two-step (preview, then commit). Optional "new cycle" mode archives
active members not present in the file instead of deleting them.

## Deploy

1. `npm run db:push` against the production Neon database first.
2. `railway up` (org Railway account) or push to `main` if GitHub auto-deploy
   is connected.
3. Railway variables: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`.
