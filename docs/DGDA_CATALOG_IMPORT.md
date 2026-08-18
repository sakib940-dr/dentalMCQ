# DGDA Medicine Catalog Import

The supplied source file contained 41,201 rows with these columns:

- Company
- Trade Name
- Generic Name With Strength
- Dosage Form
- DAR No

The normalized import file is:

`supabase/data/dgda_drug_master_import.csv`

Normalization performed:

- source spelling of trade name/company/dosage form is preserved apart from whitespace cleanup;
- generic name and strength are separated from the source `Generic Name With Strength` field;
- common dosage forms receive a compact English display prefix (`TAB.`, `CAP.`, `SYP.`, `INJ.` etc.);
- `display_name` is built for prescription autocomplete, e.g. `TAB. Napa 500 mg`;
- exact duplicate source rows are removed;
- rows missing a trade name, generic/strength source field, or dosage form are kept separately in `dgda_drug_master_rejected_rows.csv` for manual review;
- dose, frequency, duration and meal instructions are NOT imported from the catalog.

## Import order

Run these SQL files in Supabase SQL Editor in this order if they have not already been run:

1. `supabase/migrations/20260818_prescription_autocomplete.sql`
2. `supabase/migrations/20260818_prescription_medicine_search.sql`
3. `supabase/migrations/20260818_dgda_drug_catalog_search_upgrade.sql`

Then use Supabase Dashboard:

1. Table Editor
2. Open `drug_master`
3. Import data from CSV
4. Select `supabase/data/dgda_drug_master_import.csv`
5. Map the CSV columns by name and start the import

The CSV intentionally omits the UUID `id`, `created_at`, and `updated_at` columns so PostgreSQL/Supabase defaults can create them.

## Expected data counts

- Source rows: 41,201
- Importable normalized rows after exact de-duplication: 41,121
- Rejected/incomplete source rows: 48
- Companies represented: 343

## Search behavior

Typing `Napa` can return entries such as:

`TAB. Napa 500 mg`

with metadata below it:

`Paracetamol • Beximco Pharmaceuticals Ltd.`

When selected, only the display name is placed in the prescription medicine field. Dose, meal timing and duration remain doctor-entered fields.
