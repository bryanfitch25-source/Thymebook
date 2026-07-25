-- Grant table-level privileges to the `authenticated` role.
--
-- Row Level Security policies only filter *rows* within an operation a role
-- is already permitted to attempt - they don't grant the ability to attempt
-- it in the first place. Supabase's Table Editor UI sets these grants
-- automatically when you create a table there, but a table created via raw
-- SQL (as in the previous migration) does not get them for free. Without
-- this, every query - even from a fully signed-in user - fails with
-- "permission denied for table ..." before RLS is ever evaluated.
--
-- Intentionally granted to `authenticated` only, not `anon`: this app has no
-- legitimate unauthenticated access path, so anonymous requests should be
-- rejected outright rather than merely filtered down to zero rows by RLS.
--
-- Safe to re-run.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.app_documents to authenticated;
