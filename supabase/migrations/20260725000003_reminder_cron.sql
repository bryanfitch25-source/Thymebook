-- Schedule the send-reminders Edge Function via pg_cron + pg_net.
--
-- This is Supabase's standard supported pattern for cron-triggered Edge
-- Functions: pg_cron fires a SQL job on a schedule, and that job uses
-- pg_net's `net.http_post` to call the function's HTTPS endpoint
-- asynchronously (pg_net queues the request and returns immediately, so the
-- cron job itself never blocks on the function's execution time).
--
-- NOTE: `create extension` requires elevated privileges. On most Supabase
-- projects both pg_cron and pg_net are available to enable via SQL when run
-- as the postgres user (which the SQL Editor uses), but if this errors with
-- a permissions problem, enable them by hand first: Dashboard -> Database ->
-- Extensions -> search "pg_cron" / "pg_net" -> Enable. Re-running this whole
-- file afterward is safe.
--
-- You MUST replace <PROJECT_REF> below with this project's ref
-- (yqcrilowcauibrmigfbo) and <SERVICE_ROLE_KEY> with the project's actual
-- service_role key (Dashboard -> Project Settings -> API) before running
-- this migration - it is deliberately left as a placeholder rather than a
-- secret committed to the repo. The service_role key is required here (not
-- the anon key) so the function can bypass RLS and read every pending
-- reminder / every device's push subscription regardless of the (single,
-- shared) auth user making the underlying request.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('send-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://yqcrilowcauibrmigfbo.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
