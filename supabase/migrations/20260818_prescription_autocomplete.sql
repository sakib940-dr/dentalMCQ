-- DentalMCQ prescription autocomplete upgrade
-- Run this file once in Supabase SQL Editor.
--
-- This migration intentionally creates the medication catalog structure but
-- does not seed real medicines or prescribing directions. Populate drug_master
-- only from a verified, appropriately licensed/authorized clinical data source.

create extension if not exists pgcrypto;

create table if not exists public.drug_master (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  brand_name text,
  generic_name text,
  dosage_form text,
  strength text,
  company_name text,
  registration_no text,
  source_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drug_master_display_name_idx on public.drug_master using gin (to_tsvector('simple', coalesce(display_name, '')));
create index if not exists drug_master_brand_lower_idx on public.drug_master (lower(coalesce(brand_name, '')));
create index if not exists drug_master_generic_lower_idx on public.drug_master (lower(coalesce(generic_name, '')));
create index if not exists drug_master_company_lower_idx on public.drug_master (lower(coalesce(company_name, '')));

alter table public.drug_master enable row level security;

drop policy if exists "Authenticated users can read drug master" on public.drug_master;
create policy "Authenticated users can read drug master"
on public.drug_master for select
to authenticated
using (is_active = true);

drop policy if exists "Super admins manage drug master" on public.drug_master;
create policy "Super admins manage drug master"
on public.drug_master for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

create table if not exists public.clinical_suggestions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('chief_complaint','history','on_examination','investigation','treatment_plan')),
  text text not null,
  doctor_id uuid references auth.users(id) on delete cascade,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clinical_suggestions_global_unique
  on public.clinical_suggestions (category, lower(text))
  where doctor_id is null;

create unique index if not exists clinical_suggestions_doctor_unique
  on public.clinical_suggestions (doctor_id, category, lower(text))
  where doctor_id is not null;

create index if not exists clinical_suggestions_lookup_idx
  on public.clinical_suggestions (category, doctor_id, last_used_at desc, usage_count desc);

alter table public.clinical_suggestions enable row level security;

drop policy if exists "Users can read global and own clinical suggestions" on public.clinical_suggestions;
create policy "Users can read global and own clinical suggestions"
on public.clinical_suggestions for select
to authenticated
using (is_active = true and (doctor_id is null or doctor_id = auth.uid()));

drop policy if exists "Users manage own clinical suggestions" on public.clinical_suggestions;
create policy "Users manage own clinical suggestions"
on public.clinical_suggestions for all
to authenticated
using (doctor_id = auth.uid())
with check (doctor_id = auth.uid());

create or replace function public.search_clinical_suggestions(
  p_category text,
  p_search_term text,
  p_limit integer default 8
)
returns table (
  id uuid,
  text text,
  source text,
  usage_count integer,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.id,
    cs.text,
    case when cs.doctor_id = auth.uid() then 'recent' else 'common' end as source,
    cs.usage_count,
    cs.last_used_at
  from public.clinical_suggestions cs
  where cs.is_active = true
    and cs.category = p_category
    and (cs.doctor_id is null or cs.doctor_id = auth.uid())
    and cs.text ilike '%' || trim(coalesce(p_search_term, '')) || '%'
  order by
    case when cs.doctor_id = auth.uid() then 0 else 1 end,
    cs.last_used_at desc nulls last,
    cs.usage_count desc,
    case when cs.text ilike trim(coalesce(p_search_term, '')) || '%' then 0 else 1 end,
    cs.text asc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_clinical_suggestions(text, text, integer) to authenticated;

create or replace function public.record_clinical_suggestion_usage(
  p_category text,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := trim(coalesce(p_text, ''));
  v_id uuid;
begin
  if auth.uid() is null or v_text = '' then
    return;
  end if;

  if p_category not in ('chief_complaint','history','on_examination','investigation','treatment_plan') then
    return;
  end if;

  select id into v_id
  from public.clinical_suggestions
  where doctor_id = auth.uid()
    and category = p_category
    and lower(text) = lower(v_text)
  limit 1;

  if v_id is null then
    insert into public.clinical_suggestions (category, text, doctor_id, usage_count, last_used_at)
    values (p_category, v_text, auth.uid(), 1, now());
  else
    update public.clinical_suggestions
    set usage_count = usage_count + 1,
        last_used_at = now(),
        updated_at = now()
    where id = v_id;
  end if;
end;
$$;

grant execute on function public.record_clinical_suggestion_usage(text, text) to authenticated;

-- Common dental phrases. Doctor-specific phrases are learned automatically
-- from saved prescriptions and are ranked ahead of global suggestions.
insert into public.clinical_suggestions (category, text)
values
  ('chief_complaint', 'Pain'),
  ('chief_complaint', 'Swelling'),
  ('chief_complaint', 'Sensitivity'),
  ('chief_complaint', 'Bleeding'),
  ('chief_complaint', 'Food lodgement'),
  ('chief_complaint', 'Broken tooth'),
  ('chief_complaint', 'Bad breath'),
  ('chief_complaint', 'Tooth mobility'),
  ('chief_complaint', 'Missing tooth'),
  ('chief_complaint', 'Difficulty chewing'),
  ('chief_complaint', 'ব্যথা'),
  ('chief_complaint', 'ফোলা'),
  ('chief_complaint', 'ঠান্ডা-গরমে শিরশির'),

  ('history', 'Pain for 1 day'),
  ('history', 'Pain for 3 days'),
  ('history', 'Pain for 1 week'),
  ('history', 'Pain on chewing'),
  ('history', 'Pain at night'),
  ('history', 'History of swelling'),
  ('history', 'History of trauma'),
  ('history', 'Previous dental treatment'),
  ('history', '৩ দিন ধরে ব্যথা'),
  ('history', 'চিবানোর সময় ব্যথা'),

  ('on_examination', 'Caries'),
  ('on_examination', 'Deep caries'),
  ('on_examination', 'Grossly carious tooth'),
  ('on_examination', 'Tenderness on percussion'),
  ('on_examination', 'Swelling present'),
  ('on_examination', 'Sinus tract present'),
  ('on_examination', 'Mobility Grade I'),
  ('on_examination', 'Mobility Grade II'),
  ('on_examination', 'Mobility Grade III'),
  ('on_examination', 'Calculus +'),
  ('on_examination', 'Calculus ++'),
  ('on_examination', 'Calculus +++'),
  ('on_examination', 'Gingival inflammation'),
  ('on_examination', 'Plaque present'),

  ('investigation', 'IOPA'),
  ('investigation', 'OPG'),
  ('investigation', 'Bitewing radiograph'),
  ('investigation', 'CBC'),
  ('investigation', 'RBS'),

  ('treatment_plan', 'Scaling and polishing'),
  ('treatment_plan', 'Restoration'),
  ('treatment_plan', 'Review'),
  ('treatment_plan', 'Referral'),
  ('treatment_plan', 'Follow-up')
on conflict do nothing;
