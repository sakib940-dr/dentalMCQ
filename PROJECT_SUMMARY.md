# DentalMCQ — Project Summary
*Last updated: this covers everything built as of the current session. Paste/upload this file into a new Claude chat to restore full context before asking for bug fixes or new features.*

## What this is
A production MCQ live-exam web app for dental students (BDS/FCPS/BCS prep), built with **React (Vite) + Supabase (Postgres/Auth) + Vercel**. Three roles: Super Admin (exactly one, protected), Moderator (unlimited), Examinee (student).

## Stack & deployment
- **Frontend**: React + Vite, plain CSS (`src/App.css`), no UI framework
- **Backend**: Supabase (Postgres + Auth + Realtime), all business logic in RLS policies + a few `security definer` RPC functions
- **Hosting**: Vercel, auto-deploys from GitHub on push
- **Repo**: pushed via GitHub web upload (drag-and-drop files), not git CLI
- **Env vars** (set in Vercel project settings): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **`vercel.json`** exists with a rewrite rule so client-side routes survive refresh

## Database schema (core tables)
- `profiles` — extends `auth.users`; role enum (`super_admin`/`moderator`/`examinee`), `full_name`, `username`, `email`, `mobile_number`, `practice_enabled`, `live_exam_enabled`
- `categories` → `subjects` → `subcategories` → `chapters` → `questions` (strict hierarchy; questions live at chapter level)
- `exams` — `category_id`, `title`, `syllabus`, `start_time`/`end_time` (this is the **availability window**, NOT the per-student timer), `duration_minutes` (the actual per-student timer length, set directly by admin, default = 60% of question count), `total_questions`, `negative_marking`, `allow_student_time_adjust`, `is_published`
- `exam_questions` — fixed question set per exam (same questions for every student)
- `exam_attempts` — official/practice attempt records; `attempt_type` enum, `status` enum, `score`/`percentage`/`rank`
- `attempt_answers` — per-question answers for an attempt
- `wrong_questions` — tracks incorrect answers for spaced-repetition practice; unique on `(examinee_id, question_id)`
- `bookmarked_questions` — student-curated "save for later" list, separate from `wrong_questions` (auto-populated from wrong answers) and from ExamRunner's in-session "★ Mark" (per-attempt only, never persisted); unique on `(examinee_id, question_id)`, RLS = own rows only
- `patients` — Chamber Management, `owner_id`-scoped per doctor; `unique(owner_id, phone_number)` — see Chamber Management section below for why phone isn't globally unique
- `appointments` — Chamber Management; `owner_id`, `patient_id`, `scheduled_at`, `status`
- `prescriptions.patient_id` — nullable FK added onto the existing `prescriptions` table, linking each prescription to a `patients` row (see Chamber Management section)
- `practice_sessions` / `practice_answers` — separate from official attempts, never touch merit list
- `chat_threads` / `chat_messages` — one thread per student; `sender_role` on each message lets Moderators see student+moderator messages but NEVER super_admin messages (Super Admin sees everything)
- `notices` — general announcement board, staff-write/all-read
- `exam_schedule_entries` — hand-written routine/timetable per category (date + syllabus text), NOT linked to actual exams
- `user_credentials` — **plain-text password shadow table**, Super Admin only (see Security Notes below — explicit user request, not best practice)
- `app_settings` — global feature toggles: `practice_enabled_global`, `live_exam_enabled_global`

## Key business rules (important — don't regress these)
1. **Exam status is computed live from time**, not stored: `now() < start_time` → upcoming; `start_time <= now() <= end_time` → live; else archived. There is NO cron/scheduler — a `compute_exam_duration` trigger and `auto_archive_exams()` function exist in schema history but are **unused/removed**; do not rely on them.
2. **Timer rule**: default duration = `round(question_count * 0.6)` minutes (10 Q → 6 min, 100 Q → 60 min). Admin sets this directly on the exam (editable, not locked to the formula). Students can adjust only if `allow_student_time_adjust` is true (Live) or always (Practice).
3. **Exam availability window** (`start_time`/`end_time`) is separate from timer duration — defaults to 12:01 AM–11:59 PM of the chosen start date, admin-customizable for multi-day windows.
4. **Merit list stays hidden until the exam's `end_time` passes** — RLS policy `attempts_merit_list_after_close` only allows reading other students' attempts once `end_time < now()`. Own score/answer-sheet is visible immediately after personal submission.
5. **Practice never touches official results** — separate tables entirely (`practice_sessions`/`practice_answers`), including "retake archived exam as practice."
6. **Duplicate official attempts are blocked** — unique index on `exam_attempts(exam_id, examinee_id) where attempt_type='official'`.
7. **Answers must be written to `attempt_answers` WHILE the parent attempt is still `status='in_progress'`** (RLS requires this) — mark the attempt `submitted` only AFTER the answers are saved, not before. (This was a real bug once — order matters.)
8. **Single Super Admin enforced at DB level** — triggers `check_single_super_admin` and `protect_super_admin` prevent creating a 2nd super_admin, deleting the super_admin, or demoting them.
9. **No moderator limit** — the old 5-moderator cap trigger was removed.
10. **Moderators can see student + their own chat messages, but never Super Admin's messages** — enforced via `sender_role` filtering in RLS, not app-layer filtering.

## Feature map (what's built, by role)

### Examinee dashboard (`src/pages/examinee/ExamineeDashboard.jsx`)
- **Home** (`/dashboard`) = `StudentDashboardHome.jsx` — the student's landing page. Quick Actions grid (Question Bank Practice, Start Mock Exam, Wrong Answer Revision, Bookmarked Questions ❤️, Prescription Tool, Dental Chamber), a compact Subscription strip (soonest-expiring grant + Renew/Manage → `/dashboard/package`), an Exam Overview stat grid (Questions Available/Attempted/Accuracy/Exams/Avg/Best/Wrong-for-revision/Bookmarked — correct/wrong and live/archived shown as sub-labels rather than separate cards, to avoid redundant tiles), and a merged Recent Activity feed (official exams + practice sessions, sorted by date). Stats are computed client-side via parallel Supabase queries (same pattern as `SuperAdminOverview.jsx`), not a DB view/RPC.
- **Exams** (`/dashboard/exams`) = `CategoryExamsPage.jsx` → category grid → click into a category → 5 tabs: **Exam Schedule, Upcoming, Live, Archive, Practice** (this is what used to be the Home route — moved when the Dashboard was added, no internal changes to this component's own logic)
  - Live: start exam (fixed question set, `ExamRunner` component)
  - Archive: **3 buttons per exam** — View Result (own answer sheet), Merit List (ranked table, only if window closed), Retake as practice
  - Practice (moved INSIDE category, scoped to that category's subjects only): 3 modes — **Single** (pick subject, random across its chapters), **Mixed** (checkbox+number-box per subject, only >0 boxes contribute, NO auto-fill), **By chapter** (pick subject, then number-box per chapter). All three end with a Duration field (60% default, editable).
  - Wrong Questions entry point also lives in Practice tab
- **Bookmarks** (`/dashboard/bookmarks`) = `BookmarksPage.jsx` — browsable list of saved questions (static answer view, correct option shown, ❤️ remove button), with a "Practice these" button
- **Question Bank Practice** (`/dashboard/question-bank`) = `QuestionBankPracticePage.jsx` — replaced the old "Continue Practice" tile. Shows only categories the student currently has active-subscription access to (locked categories aren't shown at all, not even grayed out); each category card shows question count + how many are due for revision (cheaply derived from the student's own bounded `wrong_questions` list, not a full per-category answer scan). Picking a category reuses `PracticeSetup` (now exported from `PracticePage.jsx`) — same Subject/Mixed/By-chapter tabs as the in-category Practice tab, plus a new **Random** tab (N random questions from anywhere in the category). Auto-resumes any in-progress practice session on mount, preserving the old "Continue Practice" convenience under this better entry point.
- **Quick practice launcher** (`/dashboard/practice-session`) = `PracticeSessionRoute.jsx` — launches a `PracticeSession` directly by router state (`{mode:'wrong'}`, `{mode:'bookmarked'}`, `{mode:'randomCategory', categoryId, count}`, or a resumed session) without requiring a category pick first. Applies the same `practice_enabled_global`/`profile.practice_enabled` gating as the category-scoped Practice tab, so this shortcut can't bypass that business rule.
- **Notice Board** — read-only list, pinned notices highlighted
- **Messages** — chat with admin/moderator team, auto-welcome message on registration (DB trigger)

### Chamber Management (`/dashboard/chamber/*`) — private per-doctor patient records, separate from the shared exam platform
- **`ChamberHome.jsx`** (`/dashboard/chamber`) — hub with two Quick Action cards (Smart Prescription → `/dashboard/prescription`, Patient Management → `/dashboard/chamber/patients`), Total Patients/Today's Appointments/Total Prescriptions stat strip, Today's + Upcoming appointment lists (tap a row → that patient's profile).
- **`patients` table** — `owner_id`-scoped (per doctor, NOT global). **Phone number is unique per (owner_id, phone_number)**, not globally unique — this was an explicit user decision: two different doctors on the platform can each have their own patient with the same phone number, matching how every other table in this app (prescriptions, wrong_questions, bookmarks) is already scoped per user. Fields: `full_name`, `phone_number`, `age`, `address`, `clinical_notes` (plain text, not a dated log — v1 simplicity, easy to upgrade later), `next_visit_date` (a lightweight standalone reminder, distinct from formal `appointments`).
- **`appointments` table** — `owner_id`, `patient_id`, `scheduled_at`, `status` (upcoming/completed/cancelled/no_show), `reason`. Booked from `PatientProfilePage.jsx`; no separate calendar view — "Today"/"Upcoming" panels on `ChamberHome.jsx` cover the reminder use case.
- **Smart Prescription = the existing `PrescriptionPage.jsx`, extended, not rebuilt.** On save, `findOrCreatePatient()` (`src/lib/patients.js`) looks up a patient by (owner_id, normalized phone) and links `prescriptions.patient_id`, creating the patient record if none exists yet. `prescriptions.patient_id` is nullable — every prescription created before this migration keeps working exactly as before, just with `patient_id = null` (an optional commented-out backfill script exists in `migration_chamber_management.sql` for anyone who wants old prescriptions retroactively grouped into patient profiles).
- **"Treatment History" is intentionally NOT a separate table** — a patient's prescriptions already carry chief complaint/exam findings/treatment plan, so `PatientProfilePage.jsx` just lists that patient's own prescriptions chronologically. Avoids duplicating clinical data in two places.
- **`PrescriptionHistoryPage.jsx`** (`/dashboard/chamber/prescriptions`) — full searchable history (client-side filter over the doctor's own last 300 records, not a raw PostgREST `.or()` filter string — deliberately avoided since embedding raw search text into a filter string breaks on commas/parentheses and there's no precedent for it elsewhere in this codebase). "Open" and "Reprint & Download" both navigate to `/dashboard/prescription` with the full record in router state; `PrescriptionPage` picks it up via a `location.state.prescription` effect, calls the existing `loadIntoForm()`, and — for Reprint — auto-triggers `generate()` once state has actually applied (a `autoGenerateAfterLoad` flag + second effect, needed because `generate()` closes over component state that isn't updated synchronously). **View and Edit were consolidated into one "Open" action** (both just load the record into the same editable form) rather than building a separate read-only rendering path — flagged as a deliberate scope simplification, not an oversight.
- **`PatientProfilePage.jsx`** (`/dashboard/chamber/patients/:id`) — demographic header, editable Clinical Notes + Next Visit Date, Book Appointment (inline form) + upcoming/past appointment lists with mark-done/cancel, and the patient's full prescription history with the same Open/Reprint actions. "+ New Prescription" prefills just the patient's demographic fields into a **blank** prescription form (`location.state.prefillPatient` — distinct from the full-record load path, since a new prescription shouldn't inherit the old one's clinical content).
- **Future modules (architecture reserved, NOT built)**: Marketplace, Lab Booking, Equipment Repair Booking, Bulk SMS, Direct Call, WhatsApp, Digital Marketing, Follow-up/Recall Campaigns, Financial Reports, Inventory, Staff Management. Convention going forward: routes under `/dashboard/chamber/*`, tables scoped `owner_id`-per-doctor like `patients`/`appointments`, and `patients.phone_number` as the shared key anything patient-communication-related (SMS/WhatsApp/Call) will join on. No code exists for any of these yet.
- Migration: `migration_chamber_management.sql`.

### `ExamRunner.jsx` (shared by Practice AND Live Exam — one component, two callers)
- Setup screen: shows question count, editable timer (if allowed), single "Start" click → auto-fullscreen (no separate "Start Full Screen" step)
- Running: sticky header (title + answered count + timer), all questions in one smooth-scrolling list (NOT one-at-a-time), each question has an inline "★ Mark" button (session-local, never persisted) and an inline ❤️/🤍 bookmark toggle (optional props `bookmarkedIds`/`onToggleBookmark` — persists to `bookmarked_questions` via the caller, not ExamRunner itself, which stays presentational/DB-agnostic), sticky bottom bar with ONLY a big "Submit exam" button + answered count (no Prev/Next/Mark buttons in the bottom bar — those were removed per user request)
- The submitted-phase answer sheet (right after finishing) ALSO has the bookmark toggle now — this was a gap initially (bookmarking only worked while an attempt was in progress, not while reviewing it right after submit or later via `ExamResultView` in `CategoryExamsPage.jsx`); both are wired up now, same helpers (`src/lib/bookmarks.js`).
- Resume-after-refresh via localStorage: persists `questionIds` (exact set+order), `answers`, `marked`, and an absolute `endAt` timestamp (wall-clock accurate, survives tab close)
- Back-button interception: pushes a history guard entry, shows a custom confirm modal instead of silently exiting
- Submit → full color-coded answer sheet (green/red/yellow cards, correct/wrong/unanswered), big score/percentage, negative marking shown if >0
- **Auto-submit is staggered** with a 0–4s random delay before the DB write (not the UI) to avoid a submission stampede when many students' timers expire simultaneously
- **All answers are written in ONE batched upsert**, not one request per question (this was a major fix — originally looped one DB call per question)

### Super Admin dashboard (`src/pages/admin/SuperAdminDashboard.jsx`)
Tabs: **Overview** (stats grid, quick actions, "needs attention" low-question-count warnings, 7-day signup chart, recent registrations, recent submissions, top exams), **Categories** (tree: category→subject→subcategory→chapter, inline rename/delete), **Exam Schedule** (own top-level tab — category picker + date/syllabus routine entries), **Question Bank** (manual entry, CSV import/export, search, bulk delete), **Exams** (`ExamBuilderPage.jsx` — manual checkbox selection showing full question+options, OR random-by-chapter, category/title/syllabus/availability-window/timer/negative-marking/allow-adjust), **Users** (role switching, plain-text password view w/ show-hide toggle, per-user Practice+Live-Exam toggles, delete — Super Admin's own row has no delete/role-change buttons), **Notice Board** (post/pin/delete), **Messages** (staff chat inbox, sees everything), **Settings** (global Practice/Live-Exam toggles + change-password form)

### Moderator dashboard
Same as Super Admin MINUS Users tab and global-settings-toggles (Moderator only gets Change Password in Settings). Has its own scoped-down Overview (no student/registration stats).

## Known past bugs & their fixes (don't reintroduce)
1. **Manual question selector showed no options** — was only `select('id, question_text')`, fixed to `select('*')` and render all 4 options with correct one highlighted.
2. **Password not saving to `user_credentials` on registration** — root cause was an RLS evaluation issue specific to that table (never fully root-caused, but confirmed NOT a session-timing race since `profiles` insert succeeded fine with an identical RLS pattern). **Fixed by bypassing RLS entirely** via a `security definer` RPC `save_credential_shadow(target_user_id, new_password)` that self-checks the caller owns the row (or is staff) instead of relying on RLS. Both `signUp()` and `changePassword()` call this RPC now, not direct table writes.
3. **Exam never went live automatically** — `auto_archive_exams()` existed but nothing scheduled it. Fixed by computing status from time client-side everywhere (`computeEffectiveStatus` pattern), not trusting the stored `status` column.
4. **Exam `end_time` was wrongly = start_time + timer duration** (a few minutes), not a real availability window — fixed by separating "Available from/until" (defaults to full day) from "Timer minutes" (60% rule) as distinct fields.
5. **Option text invisible on mobile** — `<button>` elements didn't inherit page text color on some mobile browsers; fixed by explicitly setting `color` on `.opt-btn`/`.opt-text`.
6. **RLS ordering bug**: writing `attempt_answers` after marking the attempt `submitted` failed RLS (policy requires `status='in_progress'` at write time) — fixed by reordering: save answers first, then mark submitted.
7. **Delete User only removed the `profiles` row, never the actual Auth login account** — `supabase.from('profiles').delete()` from the browser can never touch `auth.users`; that requires the service role key, which must never ship to the client. Fixed with a Supabase **Edge Function** (`supabase-functions/delete-user/index.ts`, deployed separately via the Supabase Dashboard's Edge Functions UI — NOT part of the zip/GitHub/Vercel frontend flow) that re-checks the caller is `super_admin` server-side, refuses to delete the Super Admin or the caller's own account, deletes the profile, then calls `auth.admin.deleteUser()`. `UserManagementPage.jsx`'s `removeUser()` now calls `supabase.functions.invoke('delete-user', ...)` instead of deleting the table row directly.

## Security notes (explicit user decisions, not my recommendation)
- **Plain-text passwords are stored** in `user_credentials`, visible to Super Admin only, by explicit user request despite being told this is non-standard/risky. This was a deliberate tradeoff the user chose knowingly.
- If this app is ever used beyond a small trusted deployment, recommend replacing this with a proper password-reset flow.

## Performance notes for scale (500–1000 concurrent students)
- User is on **Supabase Free tier** as of this writing — explicitly told this is a real risk at that scale, no load testing has been done
- Optimizations already applied: batched answer writes (was N requests, now 1), staggered auto-submit jitter, verified indexes exist on all hot-path tables (`attempt_answers`, `exam_questions`, `exam_attempts`)
- Recommended next steps if scale is real: load-test with 50-100 concurrent first, consider Supabase Pro tier upgrade (~$25/mo) before a real high-stakes exam day, consider splitting exam windows across batches of students

## Deployment workflow used throughout this project
1. I generate/edit files in `/home/claude/examapp` (a Vite React project)
2. `npm run build` to verify no errors
3. Zip the whole project (excluding `node_modules`, `.git`, `.env`) into `examapp.zip`
4. User downloads, extracts, and re-uploads via GitHub's web "Add file → Upload files" (drag-and-drop the extracted contents, NOT the zip itself, NOT the outer folder — the files need to land at repo root)
5. Vercel auto-detects the push and redeploys
6. For DB changes, I provide a separate `.sql` migration file the user runs in Supabase's SQL Editor

## Also implemented (not previously listed in this file — found in codebase, documenting now for continuity)
- **Packages/Subscriptions**: `packages`, `package_categories`, `category_access_grants`, `payment_claims` tables; `PackagePage.jsx` (student-facing claim/promo/txn flow), `PaymentAdminPage.jsx` (staff approval), `PackagesReadOnlyPage.jsx`. Access to a category's exams/practice is gated by `has_active_access()` RPC checking `category_access_grants`, not a flat `is_active` flag. A package can link multiple categories (`package_categories`); claiming/approval creates one grant row per linked category, each with its own `expires_at` — there is no single unified "current package" row, by design (see `SubscriptionStrip` in `StudentDashboardHome.jsx` for how the dashboard summarizes this honestly instead of faking a single-package model).
- **Prescription module**: `prescriptions`, `advice_templates` tables; per-doctor logo watermark + custom footer text (stored on `profiles.prescription_logo_url` / `prescription_footer_text` / `prescription_watermark_opacity`), auto `serial_number`, tooth-quadrant clinical notation (`ToothQuadrantInput`), jsPDF generation with embedded Bengali font, "Reprint/Edit" from a recent-5 list. `PrescriptionActivityPage.jsx` gives staff a usage summary (`prescription_usage_summary` view) drillable per user.
- **Access Control / Audit Log**: `AccessControlPage.jsx`, `AuditLogPage.jsx` — not yet cross-referenced in this summary's business rules; read the components directly if working in this area.
- **PWA install prompt**: `InstallAppButton.jsx`.

## What's NOT yet built
- **Chamber future modules** (Marketplace, Lab Booking, Equipment Repair Booking, Bulk SMS, Direct Call, WhatsApp, Digital Marketing, Follow-up/Recall Campaigns, Financial Reports, Inventory, Staff Management) — architecture/naming convention reserved (see Chamber Management section above), no code built.
- Everything else, including Chamber Management (Smart Prescription + Patient Management), Question Bank Practice, and Bookmarked Questions, is complete as of this summary.

## A note on trusting this file
Twice during this session, files in this project contained content that was never requested — a streak counter, "Question of the Day," a topic heatmap, and (more seriously) a `recordPracticeResult()` helper that had silently replaced the original, working wrong-answer-tracking logic in both `PracticeSession` and `ArchivedRetakeSession` with an unreviewed rewrite. The cause was never identified. All of it — the extra components, the extra CSS, the fabricated migration file, and the business-logic swap — was found and reverted back to the original, verified logic. If anything in this file describes a feature you don't remember asking for, or if behavior around practice submissions/wrong-question tracking looks off, treat it as suspect and verify against the actual component files rather than trusting this summary.
