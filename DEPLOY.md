# Deploying to Vercel + Supabase

Three steps: create the Supabase project, run setup once from your machine, deploy to Vercel.

## 1. Supabase (database + PDF storage)

1. Create a free project at https://supabase.com (pick a region close to your users, e.g. Mumbai).
2. Collect three values:
   - **DATABASE_URL**: click **Connect** in the top bar → copy the **Transaction pooler** string (port 6543) and put your database password into it.
   - **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY**: Project Settings → API. The service role key is secret; it never ships to the browser (it is only read in server code).
3. Paste all three into `.env.local`, along with `GEMINI_API_KEY` and a random `SESSION_SECRET` (`openssl rand -hex 32`).

## 2. One-time setup (from this folder)

```bash
npm run setup
```

This applies `supabase/schema.sql` (tables + pgvector), creates the private `reports` storage bucket, and seeds the platform super admin (`superadmin` / `stair123` — change it before real client use). It is idempotent; re-running is safe. Companies self-register from the login page's "Create company" tab, or the super admin creates them from the Admin page.

Test locally before deploying: `npm run dev` → http://localhost:3000.

## 3. Vercel

1. Push this folder to a GitHub repository and import it at https://vercel.com/new (or run `npx vercel` from this folder).
2. In the Vercel project settings → Environment Variables, add the same five values from `.env.local`:
   `GEMINI_API_KEY`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
3. Deploy. The upload route declares `maxDuration = 300` so AI extraction of long reports fits within Vercel's function limit (Hobby plan allows up to 300s with Fluid Compute, which is on by default for new projects).

## After deploying

- Log in as `superadmin@stair` / `stair123` and **change the seeded passwords before inviting clients** (create fresh users from the Admin page; there is no self-serve password reset yet).
- Each client admin logs in at the same URL and sees only their organization's data.

## Notes

- Local dev and production share the same Supabase database. For a separate staging environment, create a second Supabase project and point a Vercel preview environment at it.
- Uploaded PDFs live in the private `reports` bucket; the app serves them via short-lived signed URLs (1 hour).
