-- Thymebook initial schema
--
-- This file lives at the Supabase CLI migration path/format
-- (supabase/migrations/<timestamp>_<description>.sql) so that if this repo's
-- Supabase GitHub integration is configured to auto-apply migrations on
-- push, it can pick this up automatically. Whether or not that happened,
-- this script is also safe to paste into the Supabase SQL Editor and run
-- by hand - it is idempotent and can be re-run any number of times without
-- error or data loss.
--
-- Design:
--   - `recipes` is a real relational table, one row per recipe, mirroring
--     the app's existing localStorage Recipe shape column-for-column. This
--     is what lets "Import backup" upsert by id.
--   - Every other piece of app state (shopping list, staples, meal plan,
--     saved meals) is small, single-user-household data that today lives as
--     one JSON blob in localStorage. Rather than fully normalizing each of
--     those into many tables (a bigger rewrite for little benefit at this
--     scale), we mirror that shape closely: one `app_documents` table,
--     keyed by document name, holding the same JSON shape the app already
--     uses. The app subscribes to realtime UPDATE events per key so both
--     devices stay in sync.
--
-- Security:
--   Row Level Security is enabled on every table. There is exactly one
--   policy per table/action: any authenticated user may select/insert/
--   update/delete. This is intentionally simple and is correct here
--   specifically because this app only ever has a single shared household
--   Supabase Auth user - there is no multi-tenant boundary to enforce.

-- ============================================================================
-- recipes
-- ============================================================================

create table if not exists public.recipes (
  id           text primary key,
  title        text not null default '',
  tags         text[] not null default '{}',
  prep_time    text not null default '',
  cook_time    text not null default '',
  servings     text not null default '',
  source       text not null default '',
  ingredients  text not null default '',
  instructions text not null default '',
  notes        text not null default '',
  photo        text,
  favorite     boolean not null default false,
  location     text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.recipes enable row level security;

do $$ begin
  create policy "recipes_select_authenticated" on public.recipes
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "recipes_insert_authenticated" on public.recipes
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "recipes_update_authenticated" on public.recipes
    for update using (auth.uid() is not null) with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "recipes_delete_authenticated" on public.recipes
    for delete using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- app_documents - one JSON blob per named piece of shared app state
-- ============================================================================

create table if not exists public.app_documents (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_documents enable row level security;

do $$ begin
  create policy "app_documents_select_authenticated" on public.app_documents
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "app_documents_insert_authenticated" on public.app_documents
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "app_documents_update_authenticated" on public.app_documents
    for update using (auth.uid() is not null) with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "app_documents_delete_authenticated" on public.app_documents
    for delete using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- Seed the four documents the app expects, matching each module's existing
-- localStorage default shape exactly. `on conflict do nothing` makes this
-- safe to re-run.
insert into public.app_documents (key, data) values
  ('shopping_list', '{"recipeEntries": [], "manualItems": [], "checked": {}, "staplesOverride": {}}'::jsonb),
  ('staples', '{"items": ["salt", "pepper", "olive oil", "vegetable oil", "flour", "sugar", "water", "baking powder", "baking soda", "cooking spray"]}'::jsonb),
  ('meal_plan', '{"days": {"Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []}}'::jsonb),
  ('meals', '{"items": []}'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- Realtime
-- ============================================================================
-- Add both tables to the supabase_realtime publication so postgres_changes
-- subscriptions fire. Guarded so re-running this script doesn't error if a
-- table is already a member.
do $$ begin
  alter publication supabase_realtime add table public.recipes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.app_documents;
exception when duplicate_object then null;
end $$;
