# Prescription autocomplete setup

1. Run `supabase/migrations/20260818_prescription_autocomplete.sql` in the Supabase SQL Editor.
2. Clinical autocomplete is then available for C/C, H/O, O/E, Investigation and Treatment Plan.
3. Doctor-specific phrases are learned from saved prescriptions and ranked ahead of common phrases.
4. `drug_master` is created as a verified-data catalog structure. It is intentionally empty.
5. A CSV header template is available at `docs/drug_master_import_template.csv` for an authorized administrator to populate from a verified/licensed clinical source.

The frontend does not auto-prescribe dose, meal timing or treatment duration.
