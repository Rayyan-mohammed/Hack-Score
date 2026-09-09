# Supabase setup

The database schema lives in `supabase/migrations/`. Apply them in order.

## Apply the migrations

Easiest: open the **SQL Editor** in your Supabase dashboard and run each file
in order:

1. `0001_init_schema.sql` — tables, enums, indexes
2. `0002_functions.sql` — triggers and RLS helper functions
3. `0003_rls.sql` — row level security policies
4. `0004_event_ops.sql` — round shortlisting, tie-breaks, soft delete,
   forced password change, results publishing + private team tokens
5. `0005_team_leader.sql` — team leader name/email
6. `0006_sponsors.sql` — sponsors table + logo storage bucket
7. `0007_registrations.sql` — problem statements, participant registrations
   (draft + one-hour auto-submit), registration switch and resource links

(Or, with the Supabase CLI linked to your project: `supabase db push`.)

> **Important:** the app code for round progression, tie-breaks, soft
> delete/Trash, forced password change, and results/certificates depends on
> `0004_event_ops.sql`. Apply it **before** deploying that code, or those
> pages will error on the missing columns.

> The registration form (`/register/...`), the admin **Registrations** page and
> the "Registration form" option on the Teams page all depend on
> `0007_registrations.sql`. Apply it before deploying them.

## Config for the new features

- **Password reset emails** (`/forgot-password`) require SMTP configured under
  *Authentication → Email* in Supabase. Add `/reset-password` and
  `/change-password` to *Authentication → URL Configuration → Redirect URLs*.
- Optionally set `NEXT_PUBLIC_SITE_URL` so reset links use the right origin
  (otherwise the request host is used).
- **Registration form** (`/register/<hackathon id>`) is public and reads and
  writes via the service role, so `SUPABASE_SECRET_KEY` must be set. Set
  `NEXT_PUBLIC_SITE_URL` too, so the link the admin copies points at the
  deployed site. The WhatsApp group, PPT template and resources links shown on
  the confirmation page are set per hackathon under **Registrations → Form
  settings & resources**.
- **Results pages** (`/results/<token>`) are public and read via the service
  role, so `SUPABASE_SECRET_KEY` must be set in the deployment environment.

## Create the first admin

New sign-ups default to the `judge` role. To make yourself an admin, sign up
once through the app, then run this in the SQL Editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

After that you can create judge accounts and configure hackathons from the
admin panel.
