# Prescription Autocomplete Upgrade

## Included
- Bengali-safe PDF work from the previous build remains intact.
- Autocomplete for C/C, H/O, O/E, Investigation and Treatment Plan.
- Common dental phrases are seeded by SQL.
- Previously saved doctor phrases are learned and ranked as `Recent`.
- Keyboard navigation: Arrow Up/Down, Enter, Escape.
- Responsive floating suggestion panel.
- `drug_master` schema, indexes, RLS and CSV import headers are included as an empty verified-data catalog structure.

## Required Supabase step
Run:

`supabase/migrations/20260818_prescription_autocomplete.sql`

in the Supabase SQL Editor once.

## Drug data
The migration intentionally does not contain real medicine records or prescribing directions. An authorized administrator should populate `drug_master` only from a verified/licensed clinical dataset.
