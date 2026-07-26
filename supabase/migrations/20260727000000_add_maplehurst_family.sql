-- Adds a 5th family: Maplehurst Fitches (single adult: Carmel).
-- Additive only - existing families/data are untouched. Safe to re-run.

insert into public.families (name) values
  ('Maplehurst Fitches')
on conflict (name) do nothing;
