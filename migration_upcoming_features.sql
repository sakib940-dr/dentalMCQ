-- ============================================================
-- Migration: upcoming_features (Super Admin editable roadmap list)
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
-- Same reasoning as help_center_sections — this list will change as
-- Chamber modules actually get built; it shouldn't need a code change
-- every time an item is added or removed.

create table if not exists upcoming_features (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '✨',
  label text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_upcoming_features_order on upcoming_features(display_order);

alter table upcoming_features enable row level security;

drop policy if exists "upcoming_features_select_all" on upcoming_features;
create policy "upcoming_features_select_all" on upcoming_features
  for select
  to authenticated
  using (true);

drop policy if exists "upcoming_features_insert_staff" on upcoming_features;
create policy "upcoming_features_insert_staff" on upcoming_features
  for insert
  to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

drop policy if exists "upcoming_features_update_staff" on upcoming_features;
create policy "upcoming_features_update_staff" on upcoming_features
  for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

drop policy if exists "upcoming_features_delete_staff" on upcoming_features;
create policy "upcoming_features_delete_staff" on upcoming_features
  for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

insert into upcoming_features (icon, label, display_order)
select * from (values
  ('🛒', 'Dental Materials Marketplace', 10),
  ('🔬', 'Dental Laboratory Directory & Booking', 20),
  ('🔧', 'Equipment Repair & Technician Booking', 30),
  ('📱', 'Bulk SMS to Patients', 40),
  ('📞', 'Direct Call from Patient Profile', 50),
  ('💬', 'WhatsApp Messaging', 60),
  ('📢', 'Digital Marketing for Dental Chambers', 70),
  ('⏰', 'Patient Follow-up Reminder', 80),
  ('🔄', 'Patient Recall Campaign', 90),
  ('📊', 'Financial Reports', 100),
  ('📦', 'Inventory Management', 110),
  ('👥', 'Staff Management', 120)
) as seed(icon, label, display_order)
where not exists (select 1 from upcoming_features);
