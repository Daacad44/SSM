# Semester & Study Manager (SSM)

Mobile-first web app for tracking semesters, courses, activities, alarms, and weekly reports. Frontend is React + Tailwind (Vite) targeting Vercel. Backend is Supabase (Postgres, Auth, Storage, Edge Functions).

## Stack
- React (Vite, TypeScript), Tailwind CSS, Zustand, React Router
- Supabase Postgres + Auth + Storage, Edge Functions (Deno) for reminders and reports
- Offline cache via IndexedDB + Service Worker for notifications

## Quickstart (local)
1. `cd web && cp .env.example .env` then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. `npm install`
3. `npm run dev`
4. Visit http://localhost:5173. Press “Sync to Supabase” after adding data to push queued items.

## Supabase setup
1. Create project in Supabase and fetch the project URL and keys.
2. Run migrations: `supabase db push` or paste `db/migrations/0001_init.sql` in the SQL editor.
3. Seed sample data: run `infra/supabase/seed.sql`.
4. Create storage buckets `attachments`, `ringtones`, `reports` (private) from SQL or dashboard.
5. Deploy edge functions:
   - `supabase functions deploy email-reminders`
   - `supabase functions deploy generate-report`
   - Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_WEBHOOK` (SMTP bridge/SendGrid/etc), `REPORT_BUCKET=reports`.
6. Configure Supabase scheduled job (or Vercel Cron) to call `email-reminders` every 15 minutes.

## Vercel deployment
1. In Vercel, import `web` folder as project.
2. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Add cron job (see `infra/vercel.json`) if using Vercel serverless instead of Supabase Cron.

## Frontend notes
- Offline queue stored in IndexedDB (`localCache.ts`) and synced with Supabase via `syncNow`.
- Service worker (`public/sw.js`) provides push + notification click handling. Browser alarms show notifications and play ringtone (audio user gesture required once).
- UI components live in `src/App.tsx`; state in `src/store/useSSMStore.ts`.
- Auth: Supabase email/password registration (verification email required), email OTP login flow, and password reset email. Use a Gmail address to receive codes quickly. Env must include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Lessons library: subjects + uploads for PDF/PPT/Word/Excel. Uses Supabase Storage bucket (default `attachments`, override with `VITE_SUPABASE_BUCKET`). Files stored under `<userId>/<subjectId>/filename` with view/delete from the dashboard.

## Reports
- Edge function `generate-report` fetches weekly data, creates PDF (pdf-lib) + XLSX (exceljs), uploads to Supabase Storage, and returns signed URLs.

## Files of interest
- `db/migrations/0001_init.sql` – schema with RLS policies.
- `infra/supabase/seed.sql` – demo rows.
- `functions/email-reminders` – scheduled email reminders.
- `functions/generate-report` – weekly export to PDF/XLSX.
- `web/src` – React client, offline cache, notification helpers.

## Environment reference
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=             # for edge functions
EMAIL_WEBHOOK=                         # provider endpoint
REPORT_BUCKET=reports
```

## Acceptance checklist
- Add/Archive semesters and import past semesters (UI supports CRUD; import can re-use state add).
- Manage courses + activities with due dates and priorities.
- Browser alarm notification + ringtone; server email reminders via cron + edge function.
- Weekly reports downloadable as PDF/XLSX and stored in Storage.
- Document uploads via Supabase Storage (bucket scaffolding ready).
- RLS prevents cross-user access.
- Deployed on Vercel; cron jobs scheduled either in Vercel or Supabase Cron.
