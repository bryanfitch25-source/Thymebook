-- Multi-family support.
--
-- Thymebook is moving from "one shared household login" to 4 separate
-- families (2 adults each, 8 accounts total), sharing the same instance:
--   - `recipes` stays fully shared - every family can see and edit every
--     recipe, unchanged from before.
--   - Everything else that used to be one global blob (shopping list,
--     staples, meal plan, saved meals, thaw reminders, push subscriptions,
--     recipe favorites) becomes private per-family: each family only ever
--     sees and edits their own.
--   - Recipe favorites move off the `recipes.favorite` column (which was a
--     single shared flag) into a per-family `recipe_favorites` join table,
--     plus a `recipes_favorited_by_any()` function so the app can still show
--     an aggregate "favorited by any family" view without exposing *which*
--     family favorited what to everyone.
--
-- Idempotent and safe to re-run, matching the convention of every prior
-- migration in this project.

-- ============================================================================
-- families / family_members
-- ============================================================================

create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;

do $$ begin
  create policy "families_select_authenticated" on public.families
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- Membership is admin-provisioned (see supabase/functions/provision-families),
-- not self-service, so authenticated users get select on their own row only
-- and no insert/update/delete policy at all.
create table if not exists public.family_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.family_members enable row level security;

do $$ begin
  create policy "family_members_select_own" on public.family_members
    for select using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Seed the 4 families. Safe to re-run (unique name conflict is a no-op).
insert into public.families (name) values
  ('Summerside Fitches'),
  ('Phillips Family'),
  ('Morningside Fitches'),
  ('Ashley Fitches')
on conflict (name) do nothing;

-- Resolves the calling user's family_id. security definer + fixed
-- search_path so it works regardless of the caller's RLS visibility into
-- family_members (they can only see their own row anyway, which is all
-- this needs) and can't be tricked via search_path hijacking.
create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

grant execute on function public.current_family_id() to authenticated;

-- ============================================================================
-- app_documents: scope each named document per-family instead of globally
-- ============================================================================

alter table public.app_documents add column if not exists family_id uuid references public.families(id);

update public.app_documents
  set family_id = (select id from public.families where name = 'Morningside Fitches')
  where family_id is null;

alter table public.app_documents alter column family_id set not null;

alter table public.app_documents drop constraint if exists app_documents_pkey;
do $$ begin
  alter table public.app_documents add constraint app_documents_pkey primary key (key, family_id);
exception when duplicate_object then null;
end $$;

drop policy if exists "app_documents_select_authenticated" on public.app_documents;
drop policy if exists "app_documents_insert_authenticated" on public.app_documents;
drop policy if exists "app_documents_update_authenticated" on public.app_documents;
drop policy if exists "app_documents_delete_authenticated" on public.app_documents;

create policy "app_documents_select_own_family" on public.app_documents
  for select using (family_id = public.current_family_id());
create policy "app_documents_insert_own_family" on public.app_documents
  for insert with check (family_id = public.current_family_id());
create policy "app_documents_update_own_family" on public.app_documents
  for update using (family_id = public.current_family_id()) with check (family_id = public.current_family_id());
create policy "app_documents_delete_own_family" on public.app_documents
  for delete using (family_id = public.current_family_id());

-- ============================================================================
-- reminders: scope per-family
-- ============================================================================

alter table public.reminders add column if not exists family_id uuid references public.families(id);

update public.reminders
  set family_id = (select id from public.families where name = 'Morningside Fitches')
  where family_id is null;

alter table public.reminders alter column family_id set not null;

drop policy if exists "reminders_select_authenticated" on public.reminders;
drop policy if exists "reminders_insert_authenticated" on public.reminders;
drop policy if exists "reminders_update_authenticated" on public.reminders;
drop policy if exists "reminders_delete_authenticated" on public.reminders;

create policy "reminders_select_own_family" on public.reminders
  for select using (family_id = public.current_family_id());
create policy "reminders_insert_own_family" on public.reminders
  for insert with check (family_id = public.current_family_id());
create policy "reminders_update_own_family" on public.reminders
  for update using (family_id = public.current_family_id()) with check (family_id = public.current_family_id());
create policy "reminders_delete_own_family" on public.reminders
  for delete using (family_id = public.current_family_id());

-- ============================================================================
-- push_subscriptions: scope per-family (a device belongs to whichever
-- family logged in on it)
-- ============================================================================

alter table public.push_subscriptions add column if not exists family_id uuid references public.families(id);

update public.push_subscriptions
  set family_id = (select id from public.families where name = 'Morningside Fitches')
  where family_id is null;

alter table public.push_subscriptions alter column family_id set not null;

drop policy if exists "push_subscriptions_select_authenticated" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_authenticated" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_authenticated" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_authenticated" on public.push_subscriptions;

create policy "push_subscriptions_select_own_family" on public.push_subscriptions
  for select using (family_id = public.current_family_id());
create policy "push_subscriptions_insert_own_family" on public.push_subscriptions
  for insert with check (family_id = public.current_family_id());
create policy "push_subscriptions_update_own_family" on public.push_subscriptions
  for update using (family_id = public.current_family_id()) with check (family_id = public.current_family_id());
create policy "push_subscriptions_delete_own_family" on public.push_subscriptions
  for delete using (family_id = public.current_family_id());

-- ============================================================================
-- recipe_favorites: per-family favoriting, replacing recipes.favorite
-- ============================================================================

create table if not exists public.recipe_favorites (
  recipe_id    text not null references public.recipes(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  favorited_at timestamptz not null default now(),
  primary key (recipe_id, family_id)
);

alter table public.recipe_favorites enable row level security;

do $$ begin
  create policy "recipe_favorites_select_own_family" on public.recipe_favorites
    for select using (family_id = public.current_family_id());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "recipe_favorites_insert_own_family" on public.recipe_favorites
    for insert with check (family_id = public.current_family_id());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "recipe_favorites_delete_own_family" on public.recipe_favorites
    for delete using (family_id = public.current_family_id());
exception when duplicate_object then null;
end $$;

-- Carry forward any recipes that were starred under the old single-login
-- model, attributing them to Morningside Fitches (the original account).
insert into public.recipe_favorites (recipe_id, family_id)
  select id, (select id from public.families where name = 'Morningside Fitches')
  from public.recipes
  where favorite = true
on conflict (recipe_id, family_id) do nothing;

alter table public.recipes drop column if exists favorite;

-- Returns the ids of every recipe favorited by at least one family, without
-- exposing *which* family - used for the "favorited by any family" list.
-- security definer so it can read across all families' recipe_favorites
-- rows despite the per-family RLS policies above.
create or replace function public.recipes_favorited_by_any()
returns table(recipe_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct recipe_id from public.recipe_favorites;
$$;

grant execute on function public.recipes_favorited_by_any() to authenticated;

-- ============================================================================
-- Grants (RLS alone is not enough - see 20260725000001_grant_authenticated.sql)
-- ============================================================================

grant select on public.families to authenticated;
grant select on public.family_members to authenticated;
grant select, insert, delete on public.recipe_favorites to authenticated;

-- The provisioning Edge Function runs as service_role, which (on this
-- project) still needs explicit grants - see
-- 20260726000000_grant_service_role.sql for why.
grant select, insert, update, delete on public.families to service_role;
grant select, insert, update, delete on public.family_members to service_role;
grant select, insert, update, delete on public.recipe_favorites to service_role;

-- ============================================================================
-- Realtime
-- ============================================================================

do $$ begin
  alter publication supabase_realtime add table public.recipe_favorites;
exception when duplicate_object then null;
end $$;
