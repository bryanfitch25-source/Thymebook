-- Adds the "needs thaw" flag to recipes: a manual toggle for recipes that
-- contain a frozen protein, so the app can offer to set a thaw reminder
-- when that recipe is planned. Follows the same pattern as the earlier
-- `location` column addition - idempotent, safe to re-run.

alter table public.recipes
  add column if not exists needs_thaw boolean not null default false;
