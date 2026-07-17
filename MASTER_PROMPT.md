# DentalMCQ — Master Prompt for a New Claude Session

Paste this as your first message in a new conversation, with `PROJECT_SUMMARY.md` and
`examapp.zip` attached. This tells Claude what the app is and how to work on it safely.
I'm not a developer — I rely on you to investigate, build, test, and explain in plain
terms before I deploy anything.

## What this is

DentalMCQ — a live exam-prep + practice platform for dental students, plus a Chamber
Management module (patients, appointments, prescriptions) for practicing dentists.
React + Vite frontend, Supabase (Postgres/Auth/Storage/Edge Functions) backend,
deployed on Vercel. No custom backend server — the browser talks to Supabase directly.

## Read this first, every time

1. Read `PROJECT_SUMMARY.md` fully before touching anything. It has the real database
   schema, business rules, the full feature map by role, known past bugs and their
   fixes, and current architecture decisions. Don't assume — verify by reading the
   actual code before changing it, even if something seems obvious.
2. If `PROJECT_SUMMARY.md` says something was "verified" or "fixed," treat that as
   true only if it's specific and traceable (a file name, a migration name) — not if
   it's vague. One prior session had unexplained/fabricated content appear in this
   project (a "streak" feature, fake migration file, and — more seriously — a silent
   rewrite of real wrong-answer-tracking logic) that was never requested. It was found
   and removed, but stay alert: before delivering anything, `grep` the project for
   content you don't remember writing this session, and don't trust code you can't
   account for just because it's already there.

## Hard rules — do not violate these without my explicit go-ahead

- **Never change payment/package/subscription business logic** (`PackagePage.jsx`,
  `payment_claims`, `packages`, `category_access_grants`) unless I specifically ask.
- **Never change exam scoring/merit-list logic** without flagging it clearly first —
  `finalize_exam_attempt()` is the server-side authoritative scorer; don't move scoring
  back to the client.
- **Don't redesign the UI/theme** unless I ask for that specifically. Reuse existing
  CSS classes and component patterns instead of inventing new ones — check for an
  existing pattern before building something that looks new.
- **Don't add features I didn't ask for**, even small ones, even if they seem obviously
  useful. Ask first if you think something's missing.
- Preserve the "practice never affects official results" rule everywhere.
- Preserve "unanswered ≠ wrong" everywhere (a real bug, already fixed once — don't
  reintroduce it).

## Before you consider anything done

1. `npm run build` — must be 0 errors.
2. `npm run lint` — must be 0 errors (warnings are fine if they match the existing
   pattern already in the codebase).
3. Integrity sweep: `grep` the whole project for anything you don't remember writing.
4. Only then zip and deliver.

## How deployment actually works (three separate channels, not one)

1. **Frontend code** → I extract the zip you give me and drag the *contents* (not the
   zip, not the outer folder) into my GitHub repo root → Vercel auto-deploys.
2. **Database changes** → you give me a `.sql` file → I paste it into Supabase
   Dashboard → SQL Editor → run it myself. You never have direct DB access.
3. **Edge Functions** (currently: `delete-user`, `admin-reset-password`) → separate
   from the zip entirely. You give me the full file content → I paste it into
   Supabase Dashboard → Edge Functions → the function with that exact name → Deploy.
   If something's already there, tell me to select-all and delete it first, not just
   paste on top.

Never assume I'll use a CLI or git commands — I don't. Everything is copy-paste
through web dashboards.

## Known constraints about me / how to talk to me

- I often write in Bangla or mixed Bangla/English. Respond in whichever language fits
  — technical file names/code stay in English regardless.
- I'm on mobile. Keep responses scannable — short paragraphs, headers, lists. Don't
  make me scroll through an essay to find the one instruction I need.
- When something breaks, I'll usually paste a screenshot or an error message, not a
  full description — read it carefully, it usually has the real answer in it (status
  codes, log lines) rather than guessing from first principles.
- If a task is large or the request is ambiguous, give me a short plan and flag any
  assumptions before deep implementation — but don't stall on small, clearly-specified
  requests with unnecessary questions.

## Current known risks (check PROJECT_SUMMARY.md for the full, current list)

- Supabase project is on the **Free tier** as of the last audit — this has a real
  7-day auto-pause-on-inactivity risk, and is likely insufficient for a synchronized
  1000-student exam-submission spike. Re-check current plan/limits before a big exam
  day (search for current Supabase pricing — it changes).
- RLS policies on older tables were never fully audited (no direct DB access) —
  Supabase Dashboard → Database → Advisors will flag `auth_rls_initplan` issues if
  they exist; ask me to check that and report back before assuming RLS is optimal.
- A k6 load test script exists (`loadtest/exam-flow.js`) but has never actually been
  run against production — treat performance fixes as reasoned, not benchmarked,
  until that changes.

## Where to start

Ask me what I want to work on. If I say "just review and tell me what's outstanding,"
read `PROJECT_SUMMARY.md`'s "What's NOT yet built" and "residual risk" sections and
summarize those back to me before doing anything else.
