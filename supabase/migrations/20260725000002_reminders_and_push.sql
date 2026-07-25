-- Thaw reminders + Web Push subscriptions
--
-- Same conventions as the initial schema migration: idempotent, safe to
-- paste into the SQL Editor and re-run, RLS enabled with a single
-- authenticated policy per action, plus the explicit grants Postgres
-- requires beyond RLS (see 20260725000001_grant_authenticated.sql for why).
--
-- Design:
--   - `reminders` is a real relational table, one row per scheduled
--     reminder (either linked to a meal-planner assignment or created
--     standalone). `remind_at` is the absolute moment to fire, already
--     resolved client-side from "lead hours before an assumed cook time on
--     a given weekday" - the server doesn't need to know about weekdays at
--     all, it just polls for `remind_at <= now()`.
--   - `push_subscriptions` is one row per browser/device that has opted
--     in to notifications. There is only one shared login for this app, so
--     subscriptions are keyed by push endpoint (unique), not by user - a
--     phone and a laptop are two independent rows and both get notified.

-- ============================================================================
-- reminders
-- ============================================================================

create table if not exists public.reminders (
  id         text primary key,
  recipe_id  text,
  label      text not null default '',
  remind_at  timestamptz not null,
  lead_hours integer not null default 24,
  source     text not null default 'manual',
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

do $$ begin
  create policy "reminders_select_authenticated" on public.reminders
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reminders_insert_authenticated" on public.reminders
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reminders_update_authenticated" on public.reminders
    for update using (auth.uid() is not null) with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reminders_delete_authenticated" on public.reminders
    for delete using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- push_subscriptions
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

do $$ begin
  create policy "push_subscriptions_select_authenticated" on public.push_subscriptions
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "push_subscriptions_insert_authenticated" on public.push_subscriptions
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "push_subscriptions_update_authenticated" on public.push_subscriptions
    for update using (auth.uid() is not null) with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "push_subscriptions_delete_authenticated" on public.push_subscriptions
    for delete using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- Grants (see 20260725000001_grant_authenticated.sql - RLS alone is not
-- enough, Postgres requires the table-level grant too).
-- ============================================================================

grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- The send-reminders Edge Function runs with the service_role key, which
-- bypasses RLS entirely, so it needs no extra grant here.

-- ============================================================================
-- Realtime
-- ============================================================================

do $$ begin
  alter publication supabase_realtime add table public.reminders;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.push_subscriptions;
exception when duplicate_object then null;
end $$;
