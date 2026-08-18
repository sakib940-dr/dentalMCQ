# Bengali trailing `d` PDF fix

Root cause identified from the generated PDF screenshot:

- Bengali danda `।` is Unicode U+0964, not inside U+0980–U+09FF.
- The mixed-script splitter therefore treated the final Bengali danda as non-Bengali.
- It was sent to jsPDF Helvetica, where it appeared as a stray Latin-looking `d`.

Fix:

- Bengali detection now includes U+0964 (।) and U+0965 (॥).
- These punctuation marks remain in the Bengali canvas run.
- No zero-width sentinel is appended to Bengali text.
- Existing layout, coordinates, medicine formatting, templates, database and SQL are unchanged.

No Supabase migration is required for this fix.
