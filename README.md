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
2. **AI extraction**: the PDF goes to Gemini, which returns an executive summary and every observation as structured JSON (title, description, department, risk, recommendation, management response, status, owner, due date) plus a citation: the page it was read from and the passage, copied verbatim. Stored in Supabase Postgres; observation embeddings go into a pgvector column.
3. **Dashboard**: KPIs, risk donut, department bar, quarter trend.
4. **Observations**: filterable table (quarter / department / risk / status); audit team and admins can update status inline. Every row opens its **source in the original PDF**: the report slides in from the right, scrolled to the passage the observation came from, with that passage highlighted (see below).
5. **Compare Quarters**: new vs resolved vs repeated observations between any two quarters, with severity escalations flagged.
6. **AI Assistant**: chatbot grounded in all processed reports for the active organization (structured context + pgvector similarity retrieval).
7. **Multi-tenant**: every query is scoped to the logged-in user's organization. The super admin can switch organizations from the top bar.

## Source citations

Every observation can be traced back to the sentence in the PDF it came from.

- On extraction, Gemini returns `source_quote` (verbatim text) and `source_page` for each observation.
- In the browser, `components/source-viewer.tsx` renders the stored PDF with pdf.js in a right-hand panel and highlights the quote.
- The page number is only a hint. `lib/pdf-match.ts` searches the PDF's own text layer for the quote, so the highlight lands even when the model miscounts pages: exact quote first, then the longest verbatim fragment, then a best-page guess. The panel says which of the three it used, so a rough match is never shown as a certain one.
- Observations extracted before this existed (or where the model returned no usable quote) fall back to searching with the observation's own wording. To give them real citations instead, run:

  ```bash
  npm run backfill-sources           # every observation still missing a quote
  npm run backfill-sources -- 3 13   # only these report ids
  npm run backfill-sources -- --all  # redo all of them
  ```

  The script re-reads each report, asks Gemini to find each finding's passage, verifies the quote against the PDF text layer and stores the page it was actually found on.
- The pdf.js worker is copied into `public/` by `scripts/copy-pdf-worker.mjs`, which runs automatically before `npm run dev` and `npm run build`. Nothing is loaded from a CDN.

## Notes

- Roles: `super_admin`, `client_admin` (upload, manage users), `audit_team` (update observation status), `cxo`, `viewer` (read-only).
- The Supabase service role key is server-only; nothing secret is exposed to the browser.
- To swap AI providers later, everything AI lives in `lib/ai.ts`; the schema lives in `supabase/schema.sql`.
