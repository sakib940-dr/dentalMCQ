# Medicine 4-Row Prescription Upgrade

This build changes only the prescription medicine entry workflow while preserving the existing medicine catalog and PDF layout approach.

## Per-medicine editor

1. Medicine: DGDA catalog autocomplete.
2. Dose: editable autocomplete with five common notation shortcuts plus the doctor's own saved/recent entries.
3. Meal instruction: editable Bengali full-sentence autocomplete with five common documentation shortcuts plus the doctor's saved/recent entries.
4. Duration: numeric days only. The clinician enters only a number such as `3` or `7`; the UI and PDF add `দিন` automatically.

## Personal suggestion learning

After a prescription is generated and successfully saved, non-empty dose and meal-instruction text is recorded for the signed-in doctor. Recent/frequently used entries are available on later prescriptions and remain isolated by RLS.

## PDF

Medicine output remains two logical lines:

- Line 1: medicine name
- Line 2: dose — meal instruction — duration in days

No medicine-specific dose, duration, or meal rule is automatically selected by the application.
