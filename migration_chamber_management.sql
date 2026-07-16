-- ============================================================
-- Migration: Chamber Management (patients, appointments, prescription linkage)
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- Fully backward-compatible: existing prescriptions keep working exactly
-- as they are today (patient_id is nullable, nothing is deleted or
-- renamed on the existing table).
-- ============================================================

-- ---------- patients ----------
-- One row per patient, per doctor. Phone number is unique PER DOCTOR
-- (owner_id), not globally — two different doctors on this platform can
-- each have their own patient with the same phone number, matching how
-- every other table in this app is already scoped per user.
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  age text,
  address text,
  clinical_notes text,
  next_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, phone_number)
);

create index if not exists idx_patients_owner on patients(owner_id);

alter table patients enable row level security;

drop policy if exists "patients_select_own" on patients;
create policy "patients_select_own" on patients
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "patients_insert_own" on patients;
create policy "patients_insert_own" on patients
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "patients_update_own" on patients;
create policy "patients_update_own" on patients
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "patients_delete_own" on patients;
create policy "patients_delete_own" on patients
  for delete to authenticated using (owner_id = auth.uid());

-- ---------- appointments ----------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled', 'no_show')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_owner on appointments(owner_id);
create index if not exists idx_appointments_patient on appointments(patient_id);
create index if not exists idx_appointments_scheduled on appointments(owner_id, scheduled_at);

alter table appointments enable row level security;

drop policy if exists "appointments_select_own" on appointments;
create policy "appointments_select_own" on appointments
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "appointments_insert_own" on appointments;
create policy "appointments_insert_own" on appointments
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "appointments_update_own" on appointments;
create policy "appointments_update_own" on appointments
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "appointments_delete_own" on appointments;
create policy "appointments_delete_own" on appointments
  for delete to authenticated using (owner_id = auth.uid());

-- ---------- prescriptions: link to patients ----------
-- Nullable and additive only — every existing prescription row is
-- untouched and keeps rendering/printing exactly as before.
alter table prescriptions add column if not exists patient_id uuid references patients(id) on delete set null;
create index if not exists idx_prescriptions_patient on prescriptions(patient_id);


-- ============================================================
-- OPTIONAL — backfill patients from existing prescriptions
-- ============================================================
-- Not required. Old prescriptions work fine with patient_id = null.
-- Run this block ONLY if you also want old prescriptions retroactively
-- grouped into patient profiles (by doctor + phone number). Safe to run
-- more than once — it skips prescriptions that already have a patient_id
-- and skips patients that already exist for that (doctor, phone) pair.
--
-- insert into patients (owner_id, full_name, phone_number, age, address)
-- select distinct on (created_by, patient_mobile)
--   created_by, patient_name, patient_mobile, patient_age, patient_address
-- from prescriptions
-- where patient_mobile is not null and patient_mobile <> ''
-- order by created_by, patient_mobile, created_at desc
-- on conflict (owner_id, phone_number) do nothing;
--
-- update prescriptions p
-- set patient_id = pt.id
-- from patients pt
-- where p.patient_id is null
--   and p.patient_mobile is not null and p.patient_mobile <> ''
--   and pt.owner_id = p.created_by
--   and pt.phone_number = p.patient_mobile;
