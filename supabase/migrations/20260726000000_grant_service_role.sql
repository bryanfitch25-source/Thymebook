-- Grant table-level privileges to the `service_role` role.
--
-- Discovered via the send-reminders Edge Function, which authenticates as
-- service_role (confirmed via diagnostic logging - Postgres's own error
-- hint named the role explicitly) but still hit "permission denied", with
-- the hint literally suggesting this exact grant. On most Supabase
-- projects service_role gets blanket privileges automatically, but that
-- isn't true here (same underlying reason `authenticated` needed explicit
-- grants in 20260725000001_grant_authenticated.sql - this project didn't
-- get the classic default-privilege bootstrapping).
--
-- service_role already bypasses Row Level Security entirely (that's its
-- purpose - the send-reminders function needs to read/write reminders and
-- push_subscriptions regardless of which row belongs to "whom", since
-- there's no per-row ownership concept in this single-household app). This
-- migration only adds the base table-level grant RLS-bypass alone doesn't
-- replace, matching the same lesson as the `authenticated` grants.
--
-- Safe to re-run.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.recipes to service_role;
grant select, insert, update, delete on public.app_documents to service_role;
grant select, insert, update, delete on public.reminders to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
