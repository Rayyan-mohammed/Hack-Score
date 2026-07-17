# HackScore

Smart hackathon evaluation and judging platform. Admins configure events,
rounds and rubrics; judges score assigned teams; the leaderboard and reports
are computed automatically.

Built with **Next.js (App Router)** and **Supabase** (Postgres, Auth, RLS).

## Features

- Email/password auth with Admin and Judge roles (RBAC enforced by row level security)
- Admin panel: hackathons, rounds, rubric builder, teams (manual + CSV import), judge accounts and round assignment
- Judge dashboard: dynamic scorecards bound to each round's rubric, save draft / submit, scores lock after submit
- Leaderboard with per-round and overall rankings, plus a top-teams chart
- Export results to CSV and a printable PDF report

## Getting started

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL Editor**, run the files in `supabase/migrations/` in
   order (`0001`, `0002`, `0003`). See `supabase/README.md` for details.
3. Copy `.env.example` to `.env.local` and fill in your values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SECRET_KEY=...
   ```

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), sign up, then make
   yourself an admin:

   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```

## Tech stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Recharts

## Deploy

Frontend deploys to Vercel; the database is hosted on Supabase. Set the same
environment variables in your Vercel project settings.
