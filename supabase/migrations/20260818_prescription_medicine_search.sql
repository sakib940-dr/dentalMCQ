-- DentalMCQ prescription medicine search upgrade
-- Run after 20260818_prescription_autocomplete.sql.
--
-- IMPORTANT:
-- This migration does NOT seed medicine names, doses, or drug-specific directions.
-- Import drug_master only from a verified/authorized dataset. The app will then
-- autocomplete those records while ranking the doctor's own recent prescriptions first.

create or replace function public.search_drug_master(
  p_search_term text,
  p_limit integer default 10
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
  select
    d.id,
    d.display_name,
    d.brand_name,
    d.generic_name,
    d.dosage_form,
    d.strength,
    d.company_name,
    d.registration_no
  from public.drug_master d
  where d.is_active = true
    and trim(coalesce(p_search_term, '')) <> ''
    and (
      d.display_name ilike '%' || trim(p_search_term) || '%'
      or coalesce(d.brand_name, '') ilike '%' || trim(p_search_term) || '%'
      or coalesce(d.generic_name, '') ilike '%' || trim(p_search_term) || '%'
      or coalesce(d.company_name, '') ilike '%' || trim(p_search_term) || '%'
    )
  order by
    case when d.display_name ilike trim(p_search_term) || '%' then 0 else 1 end,
    case when coalesce(d.brand_name, '') ilike trim(p_search_term) || '%' then 0 else 1 end,
    d.display_name asc
  limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

grant execute on function public.search_drug_master(text, integer) to authenticated;

create or replace function public.search_recent_prescription_medicines(
  p_search_term text default '',
  p_limit integer default 6
)
returns table (
  id uuid,
  display_name text,
  generic_name text,
  company_name text,
  last_used_at timestamptz,
  use_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with extracted as (
    select
      trim(coalesce(m->>'name', '')) as medicine_name,
      p.created_at
    from public.prescriptions p
    cross join lateral jsonb_array_elements(coalesce(p.medicines::jsonb, '[]'::jsonb)) m
    where p.created_by = auth.uid()
  ), ranked as (
    select
      medicine_name,
      max(created_at) as last_used_at,
      count(*) as use_count
    from extracted
    where medicine_name <> ''
      and (
        trim(coalesce(p_search_term, '')) = ''
        or medicine_name ilike '%' || trim(p_search_term) || '%'
      )
    group by medicine_name
  )
  select
    coalesce(d.id, gen_random_uuid()) as id,
    r.medicine_name as display_name,
    d.generic_name,
    d.company_name,
    r.last_used_at,
    r.use_count
  from ranked r
  left join public.drug_master d
    on lower(d.display_name) = lower(r.medicine_name)
   and d.is_active = true
  order by r.last_used_at desc, r.use_count desc, r.medicine_name asc
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

grant execute on function public.search_recent_prescription_medicines(text, integer) to authenticated;
