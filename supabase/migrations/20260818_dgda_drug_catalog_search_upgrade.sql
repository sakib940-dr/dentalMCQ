-- DentalMCQ DGDA drug catalog search upgrade
-- Run AFTER:
--   1) 20260818_prescription_autocomplete.sql
--   2) 20260818_prescription_medicine_search.sql
--
-- Then import supabase/data/dgda_drug_master_import.csv into public.drug_master.
-- This file only improves indexing/search. It does not prescribe dose/duration/meal timing.

create extension if not exists pg_trgm;

-- Search indexes for the imported catalog.
-- Trigram indexes make contains/partial searches fast for a ~40k product catalog.
create index if not exists drug_master_display_trgm_idx
  on public.drug_master using gin (lower(display_name) gin_trgm_ops);

create index if not exists drug_master_brand_trgm_idx
  on public.drug_master using gin (lower(coalesce(brand_name, '')) gin_trgm_ops);

create index if not exists drug_master_generic_trgm_idx
  on public.drug_master using gin (lower(coalesce(generic_name, '')) gin_trgm_ops);

create index if not exists drug_master_company_trgm_idx
  on public.drug_master using gin (lower(coalesce(company_name, '')) gin_trgm_ops);

create or replace function public.search_drug_master(
  p_search_term text,
  p_limit integer default 12
)
returns table (
  id uuid,
  display_name text,
  brand_name text,
  generic_name text,
  dosage_form text,
  strength text,
  company_name text,
  registration_no text
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select lower(trim(coalesce(p_search_term, ''))) as q
  ), ranked as (
    select
      d.id,
      d.display_name,
      d.brand_name,
      d.generic_name,
      d.dosage_form,
      d.strength,
      d.company_name,
      d.registration_no,
      row_number() over (
        partition by
          lower(d.display_name),
          lower(coalesce(d.generic_name, '')),
          lower(coalesce(d.company_name, ''))
        order by d.registration_no nulls last, d.id
      ) as duplicate_rank,
      case
        when lower(coalesce(d.dosage_form, '')) like '%tablet%' then 0
        when lower(coalesce(d.dosage_form, '')) like '%capsule%' then 1
        when lower(coalesce(d.dosage_form, '')) in ('syrup', 'suspension', 'powder for suspension') then 2
        when lower(coalesce(d.dosage_form, '')) like '%drops%' then 3
        when lower(coalesce(d.dosage_form, '')) like '%injection%' then 4
        else 5
      end as form_rank,
      case
        when lower(coalesce(d.brand_name, '')) = p.q then 0
        when lower(coalesce(d.brand_name, '')) like p.q || '%' then 1
        when lower(d.display_name) like p.q || '%' then 2
        when lower(coalesce(d.generic_name, '')) like p.q || '%' then 3
        when lower(coalesce(d.brand_name, '')) like '%' || p.q || '%' then 4
        when lower(d.display_name) like '%' || p.q || '%' then 5
        when lower(coalesce(d.generic_name, '')) like '%' || p.q || '%' then 6
        else 7
      end as match_rank
    from public.drug_master d
    cross join params p
    where d.is_active = true
      and p.q <> ''
      and (
        lower(d.display_name) like '%' || p.q || '%'
        or lower(coalesce(d.brand_name, '')) like '%' || p.q || '%'
        or lower(coalesce(d.generic_name, '')) like '%' || p.q || '%'
        or lower(coalesce(d.company_name, '')) like '%' || p.q || '%'
      )
  )
  select
    r.id,
    r.display_name,
    r.brand_name,
    r.generic_name,
    r.dosage_form,
    r.strength,
    r.company_name,
    r.registration_no
  from ranked r
  where r.duplicate_rank = 1
  order by r.match_rank, r.form_rank, lower(r.brand_name), lower(r.display_name), lower(r.company_name)
  limit greatest(1, least(coalesce(p_limit, 12), 25));
$$;

grant execute on function public.search_drug_master(text, integer) to authenticated;
