# DentalMCQ Final All-in-One Upgrade

This package contains the complete project plus prescription-related Supabase migrations and DGDA medicine import data.

## Prescription features
- Bengali/English PDF rendering upgrade
- Medicine autocomplete and recent-first search
- DGDA drug master import dataset
- Clinical autocomplete for C/C, H/O, O/E, Investigation, Treatment Plan
- 20 dental starter suggestions per clinical category
- Any-word/partial-word matching inside clinical phrases
- Common advice templates

## Migration order for an installation where `20260818_prescription_autocomplete.sql` is already applied
1. `20260818_prescription_medicine_search.sql`
2. `20260818_dgda_drug_catalog_search_upgrade.sql`
3. `20260818_dental_professional_templates_20.sql`
4. Import `supabase/data/dgda_drug_master_import.csv` into `public.drug_master`.

See `START_HERE_BANGLA.txt` for the full deployment checklist.
