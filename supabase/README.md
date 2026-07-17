# Supabase setup

The database schema lives in `supabase/migrations/`. Apply them in order.

## Apply the migrations

Easiest: open the **SQL Editor** in your Supabase dashboard and run each file
in order:

1. `0001_init_schema.sql` — tables, enums, indexes
2. `0002_functions.sql` — triggers and RLS helper functions
3. `0003_rls.sql` — row level security policies

(Or, with the Supabase CLI linked to your project: `supabase db push`.)

## Create the first admin

New sign-ups default to the `judge` role. To make yourself an admin, sign up
once through the app, then run this in the SQL Editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

After that you can create judge accounts and configure hackathons from the
admin panel.
