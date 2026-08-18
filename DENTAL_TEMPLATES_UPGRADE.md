# Dental professional template upgrade

Added:
- 5 dentist-focused starter suggestions for each C/C, H/O, O/E, Investigation, and Treatment Plan.
- Suggestions open on focus even before typing.
- Doctor-specific recent/frequent phrases remain ranked first.
- 10 built-in Bangla patient advice templates.
- Existing personal advice template save/delete remains available.

Supabase:
Run `supabase/migrations/20260818_dental_professional_templates.sql` after the earlier prescription autocomplete migration.

Medication-specific dose/timing recommendation logic was not changed by this upgrade.
