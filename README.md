# Internal Audit AI Dashboard

Multi-client platform that turns quarterly internal audit PDF reports into an interactive dashboard with an AI assistant. Upload a report, Gemini extracts every audit observation (department, risk, recommendation, status), and the platform gives you executive KPIs, quarter-over-quarter comparison, an action tracker, and a chatbot grounded in the reports.

**Stack:** Next.js (Vercel) · Supabase Postgres + pgvector (data + embeddings) · Supabase Storage (PDFs) · Gemini API (extraction, embeddings, chat).

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Fill in `.env.local` (each key is explained inline in that file):
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project
   - `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)

3. One-time setup (applies schema, creates the storage bucket, seeds the super admin):

   ```bash
   npm run setup
   ```

4. Run locally:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. For production deployment, see **DEPLOY.md**.

## Getting started (the intended flow)

The platform starts empty with a single login:

| Login | Password | Role |
|---|---|---|
| superadmin | stair123 | Platform super admin |

Change this password before real client use.

1. **Sign in as `superadmin`** → Admin page → **Create a new client organization** (e.g. "Gaja Capital").
2. **Upload** that company's quarterly audit PDF (Admin → Upload). The AI extracts the observations and the company's dashboard comes alive.
3. **Create employee logins** for that company (Admin → Create login): client admin, audit team, CXO, or read-only viewer. A company's client admin can also sign in and create their own employees.
4. Employees log in and see only their company's dashboard, observations, comparisons, and AI assistant.

If you upgraded from the demo-seeded version, run `npx tsx scripts/reset-demo-data.ts` once to wipe the demo companies and start clean.

## How it works

1. **Upload** (Admin page): pick quarter + fiscal year, upload the audit PDF. The PDF is stored in a private Supabase Storage bucket and served back via short-lived signed URLs.
2. **AI extraction**: the PDF goes to Gemini, which returns an executive summary and every observation as structured JSON (title, description, department, risk, recommendation, management response, status, owner, due date). Stored in Supabase Postgres; observation embeddings go into a pgvector column.
3. **Dashboard**: KPIs, risk donut, department bar, quarter trend.
4. **Observations**: filterable table (quarter / department / risk / status); audit team and admins can update status inline.
5. **Compare Quarters**: new vs resolved vs repeated observations between any two quarters, with severity escalations flagged.
6. **AI Assistant**: chatbot grounded in all processed reports for the active organization (structured context + pgvector similarity retrieval).
7. **Multi-tenant**: every query is scoped to the logged-in user's organization. The super admin can switch organizations from the top bar.

## Notes

- Roles: `super_admin`, `client_admin` (upload, manage users), `audit_team` (update observation status), `cxo`, `viewer` (read-only).
- The Supabase service role key is server-only; nothing secret is exposed to the browser.
- To swap AI providers later, everything AI lives in `lib/ai.ts`; the schema lives in `supabase/schema.sql`.
