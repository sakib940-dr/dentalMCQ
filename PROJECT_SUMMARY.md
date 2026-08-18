# DentalMCQ — প্রজেক্ট সামারি (বাংলা)
*এই ফাইলটি বর্তমান GitHub রিপোতে যা ডিপ্লয় করা আছে (Vercel live: dentalmcq.vercel.app) তার সম্পূর্ণ ফিচার-ম্যাপ। ভবিষ্যতে নতুন কোনো ফিচার যোগ করা বা বাগ ফিক্স করার আগে এই ফাইলটা নতুন Claude চ্যাটে আপলোড/পেস্ট করে দিলে পুরো কনটেক্সট ফিরে পাওয়া যাবে।*

## এই অ্যাপটা আসলে কী
ডেন্টাল স্টুডেন্টদের (BDS/FCPS/BCS প্রস্তুতি) জন্য একটা প্রোডাকশন-লেভেল MCQ লাইভ-এক্সাম ওয়েব অ্যাপ। **React (Vite) + Supabase (Postgres/Auth/Realtime) + Vercel** দিয়ে বানানো। চারটা রোল আছে: **Super Admin** (ঠিক একজন, প্রোটেক্টেড), **Admin** (নতুন রোল — Moderator-এর মতোই কিন্তু বাড়তি Categories ও Packages অ্যাক্সেস আছে), **Moderator**, **Examinee** (স্টুডেন্ট)।

## স্ট্যাক ও ডিপ্লয়মেন্ট
- **Frontend**: React + Vite, প্লেইন CSS (`src/App.css`), কোনো UI ফ্রেমওয়ার্ক নেই। প্রতিটা রোলের ড্যাশবোর্ড আলাদা `lazy()` চাংক হিসেবে লোড হয় (code-splitting) — যাতে স্টুডেন্ট কখনো Super Admin/Moderator-এর কোড ডাউনলোড না করে।
- **Backend**: Supabase (Postgres + Auth + Realtime), বিজনেস লজিক মূলত RLS পলিসি + কিছু `security definer` RPC ফাংশনে।
- **Hosting**: Vercel, GitHub-এ পুশ করলে অটো-ডিপ্লয় হয়।
- **রিপো আপডেট পদ্ধতি**: GitHub-এর ওয়েব "Add file → Upload files" দিয়ে (git CLI না) — extract করা ফাইল রিপো-রুটে ড্র্যাগ-ড্রপ করতে হয়, জিপ ফাইল বা বাইরের ফোল্ডার আপলোড করা যাবে না।
- **Env vars** (Vercel প্রজেক্ট সেটিংসে): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, এবং নতুন **`VITE_SENTRY_DSN`** (ঐচ্ছিক — না দিলে অ্যাপ স্বাভাবিকভাবেই চলবে, শুধু এরর ট্র্যাকিং হবে না)।
- **Error tracking**: `@sentry/react` যোগ হয়েছে (`main.jsx`-এ `Sentry.ErrorBoundary`-এর ভেতর পুরো অ্যাপ র‍্যাপ করা)। DSN সেট না থাকলে এটা সম্পূর্ণ নিষ্ক্রিয় থাকে। ক্র্যাশ হলে ইউজারকে একটা ফ্রেন্ডলি ফলব্যাক স্ক্রিন দেখায় ("রিফ্রেশ করুন, এক্সামের উত্তর ইতিমধ্যে সেভ হয়ে গেছে")।
- **`vercel.json`**: রিরাইট রুল (SPA রুট রিফ্রেশে যাতে ভেঙে না যায়) + `/assets/*` এর জন্য ১ বছরের ইমিউটেবল ক্যাশ হেডার।

## রোল ও রাউটিং (`src/App.jsx`)
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/resend-confirmation` — পাবলিক অথ পেজ
- `/help` — পাবলিক Help Center (লগইন ছাড়াও দেখা যায়)
- `/admin/*` → SuperAdminDashboard (শুধু `super_admin`)
- `/moderator/*` → ModeratorDashboard (`moderator` অথবা `admin` রোল — দুটোই একই কম্পোনেন্ট শেয়ার করে, `admin` হলে বাড়তি ট্যাব দেখায়)
- `/dashboard/*` → ExamineeDashboard (`examinee`)
- সব প্রোটেক্টেড রুট `ProtectedRoute.jsx` দিয়ে গার্ড করা, রোল না মিললে হোমে রিডাইরেক্ট (`HomeRedirect.jsx`)

## অথেন্টিকেশন — নতুন যা যোগ হয়েছে
- **প্রোফাইল তৈরি এখন DB ট্রিগার দিয়ে হয়**, ক্লায়েন্ট-সাইড insert দিয়ে না (আগে "Confirm Email" অফ থাকলেই কাজ করত; এখন Confirm Email অন থাকলেও DB ট্রিগার লেভেলে কাজ করে, সেশন থাকুক বা না থাকুক)।
- **Forgot Password ফ্লো**: `ForgotPasswordPage.jsx` → রিসেট ইমেইল পাঠায় → লিংকে ক্লিক করলে `/reset-password`-এ যায় (`ResetPasswordPage.jsx`) → নতুন পাসওয়ার্ড সেট।
- **Resend Confirmation Email**: `ResendConfirmationPage.jsx` — কনফার্মেশন ইমেইল না পেলে/এক্সপায়ার হলে আবার পাঠানোর অপশন।
- **Rate-limit aware cooldown**: `lib/useResendCooldown.js` — Supabase-এর "wait N seconds" এরর মেসেজ পার্স করে আসল কুলডাউন টাইম দেখায় (গেসিং না)।
- প্রতিটা সফল লগইন/সাইনআপ/পাসওয়ার্ড-চেঞ্জ/রিকভারিতে `save_credential_shadow` RPC কল হয় প্লেইন-টেক্সট শ্যাডো কপি সিঙ্ক রাখতে (Super Admin ভিজিবিলিটির জন্য, নিচে সিকিউরিটি নোট দেখুন)।
- **রেফারেল ক্যাপচার**: রেজিস্ট্রেশন লিংকে `?ref=CODE` থাকলে `RegisterPage.jsx` সেটা ধরে `set_referred_by` RPC কল করে (best-effort, ফেইল করলেও রেজিস্ট্রেশন আটকায় না)।

## ডেটাবেস স্কিমা — মূল টেবিল (আগের থেকে চলে আসা)
- `profiles` — `role` enum (`super_admin`/`admin`/`moderator`/`examinee`), `full_name`, `username`, `email`, `mobile_number`, `practice_enabled`, `live_exam_enabled`, `referral_code`
- `categories` → `subjects` → `subcategories` → `chapters` → `questions` (কড়া হায়ারার্কি)
- `exams`, `exam_questions`, `exam_attempts`, `attempt_answers`
- `wrong_questions` — ভুল উত্তরের ভিত্তিতে স্পেসড-রিপিটিশন প্র্যাকটিসের জন্য
- `practice_sessions` / `practice_answers` — অফিসিয়াল রেজাল্ট থেকে সম্পূর্ণ আলাদা
- `chat_threads` / `chat_messages` — Moderator শুধু student + নিজের মেসেজ দেখে, Super Admin-এর মেসেজ কখনো না
- `notices`, `exam_schedule_entries`
- `user_credentials` — প্লেইন-টেক্সট পাসওয়ার্ড শ্যাডো টেবিল, Super Admin only
- `app_settings` — গ্লোবাল টগল + এখন আরও কী-ভ্যালু সেটিংস রাখার জন্য ব্যবহৃত হয় (নিচে দেখুন)

## ডেটাবেস স্কিমা — নতুন টেবিল/ভিউ (এই ভার্সনে যোগ হয়েছে)
- **`bookmarked_questions`** (`examinee_id`, `question_id`) — স্টুডেন্ট ইচ্ছাকৃতভাবে যেকোনো প্রশ্ন বুকমার্ক করতে পারে (যেকোনো এক্সাম/প্র্যাকটিস থেকে)। এটা `wrong_questions` (অটোমেটিক, ভুল উত্তরের ভিত্তিতে) এবং `ExamRunner`-এর ইন-সেশন "★ Mark" (শুধু ঐ অ্যাটেম্পটের জন্য, DB-তে সেভ হয় না) থেকে আলাদা।
- **`patients`** (`owner_id`, `full_name`, `phone_number`, `age`, `address`) — ডেন্টাল চেম্বার মডিউলের রোগীর তালিকা। `phone_number` দিয়ে ইউনিক আইডেন্টিফাই হয় (ফোন নরমালাইজ করা হয় `lib/patients.js`-এ)।
- **`appointments`** (`owner_id`, `patient_id`, `scheduled_at`, `status`, `reason`) — চেম্বারের অ্যাপয়েন্টমেন্ট বুকিং।
- **`prescriptions`** — আগে থেকেই ছিল, এখন `patients`-এর সাথে লিংকড, হিস্ট্রি সার্চেবল।
- **`promo_codes`** (`code`, `discount_percent`, `max_uses`, `max_per_student`, `expires_at`) — পেমেন্ট/প্যাকেজ সিস্টেমের প্রোমো কোড।
- **`packages`**, **`category_access_grants`**, **`manual_category_locks`** — পেইড প্যাকেজ সিস্টেম: প্রতিটা ক্যাটাগরি/prescription resource-এর নিজস্ব expiry সহ অ্যাক্সেস গ্রান্ট, অ্যাডমিন চাইলে ম্যানুয়ালি লক করতে পারে।
- **`feedback`** — বাগ রিপোর্ট / ফিচার সাজেশন / জেনারেল ফিডব্যাক, স্টার রেটিং সহ, `status` (`new`/`reviewed`/`resolved`)।
- **`help_center_sections`** — অ্যাডমিন-এডিটেবল বাংলা হেল্প কনটেন্ট, পাবলিক `/help` পেজে দেখায়।
- **`upcoming_features`** — রোডম্যাপ লিস্ট (আইকন + লেবেল), অ্যাডমিন ম্যানেজ করে।
- **`audit_log`** — `role_change`, `account_delete`, `manual_lock`, `manual_unlock` অ্যাকশন লগ হয় (actor + target প্রোফাইল রেফারেন্স সহ)।
- **`stuck_exam_attempts`** (ভিউ) — যেসব অ্যাটেম্পট আটকে গেছে (crash/network issue) সেগুলো `void_stuck_attempt` RPC দিয়ে ভয়েড করে স্টুডেন্টকে নতুন অ্যাটেম্পট শুরু করতে দেয়।
- **`my_referrals`** (ভিউ) — নিজের রেফারেল কোডে কারা রেজিস্টার করেছে।
- **`notifications`** — চ্যাট আনরিড কাউন্টের জন্য একক সোর্স অফ ট্রুথ (bell icon আর bottom-nav badge দুটোই এখান থেকেই পড়ে)।
- **`app_settings`**-এর নতুন কী: `contact_methods` (JSON array — email/phone/whatsapp/facebook/custom), `dashboard_motivational_line` (হোমপেজের উদ্দীপনামূলক লাইন)।

## Examinee ড্যাশবোর্ড — নতুন নেভিগেশন স্ট্রাকচার
স্টুডেন্টের জন্য এখন **bottom tab bar** (মোবাইল অ্যাপ প্যাটার্ন) — অন্য তিন রোলের top quick-bar থেকে আলাদা:
- **Bottom nav**: Home, Exams, Chamber, Messages (আনরিড ব্যাজ সহ), Profile
- **☰ Drawer (secondary)**: Package, Notice Board, Help, Contact, Referral, Settings, Feedback

### নতুন পেজ/ফিচার (Examinee সাইড)
1. **`StudentDashboardHome.jsx`** — নতুন হোমপেজ, Quick Actions গ্রিড দুই ভাগে (Study: Question Bank Practice, Mock Exam, Wrong Answer Revision, Bookmarks, Smart Search; Chamber: Prescription Tool, Dental Chamber, Help & Support)।
2. **`QuestionBankPracticePage.jsx`** — ক্যাটাগরি-ভিত্তিক প্র্যাকটিস এন্ট্রি পয়েন্ট, প্রতি ক্যাটাগরিতে কতগুলো প্রশ্ন + কতগুলো "to review" (ভুল করা) দেখায়। ইন-প্রগ্রেস সেশন থাকলে অটো-রিজিউম করে (`findResumablePracticeSession`)।
3. **`PracticeSessionRoute.jsx`** — `/dashboard/practice-session` রুট, router state দিয়ে সেশন পাস করা হয় (রিফ্রেশ করলে state হারিয়ে গেলে ড্যাশবোর্ডে ফেরত পাঠায়)।
4. **`BookmarksPage.jsx`** — সেভ করা প্রশ্নের তালিকা, সঠিক উত্তর+ব্যাখ্যা সহ, রিমুভ করার অপশন।
5. **`SmartSearchPage.jsx`** — প্রশ্ন ব্যাংকে টেক্সট সার্চ, ম্যাচ হওয়া অংশ হাইলাইট করে দেখায়।
6. **Dental Chamber মডিউল** (নতুন সম্পূর্ণ ফিচার): `ChamberHome.jsx` (স্ট্যাটস + আজকের/আসন্ন অ্যাপয়েন্টমেন্ট), `PatientsListPage.jsx` (রোগী যোগ/তালিকা, ফোন দিয়ে ডুপ্লিকেট চেক), `PatientProfilePage.jsx` (প্রোফাইল + অ্যাপয়েন্টমেন্ট বুকিং), `PrescriptionHistoryPage.jsx` (সর্বশেষ ৩০০টা প্রেসক্রিপশন সার্চেবল)।
7. **`SupportHubPage.jsx`** — Help Center / Feedback / Contact Us — এই তিনটার একটা হাব পেজ।
8. **`FeedbackPage.jsx`** — বাগ রিপোর্ট/ফিচার সাজেশন/জেনারেল ফিডব্যাক ফর্ম, স্টার রেটিং সহ, বাংলা প্লেসহোল্ডার টেক্সট।
9. **`ContactUsPage.jsx`** — অ্যাডমিন-কনফিগার করা যোগাযোগের মাধ্যম (email/phone/whatsapp/facebook) দেখায়।
10. **`ReferralPage.jsx`** — নিজের রেফারেল লিংক কপি করা, কে কে রেফারেলে জয়েন করেছে তার তালিকা।
11. **`SettingsPage.jsx`** — Exam Question Text Size (small/medium/large, localStorage-এ সেভ হয় `lib/examFontSize.js` দিয়ে) + Change Password।
12. **`PackagePage.jsx` (আপডেটেড)** — এখন প্রতিটা ক্যাটাগরির নিজস্ব expiry-সহ subscription (My Subscriptions প্যানেল), bKash/ইত্যাদি পেমেন্ট মেথড বেছে ট্রানজেকশন আইডি সাবমিট, প্রোমো কোড অ্যাপ্লাই করার অপশন।

## Super Admin ড্যাশবোর্ড — নতুন ট্যাব/ফিচার
পুরনো ট্যাবগুলোর সাথে যোগ হয়েছে:
- **Access Control** (`/admin/access`) — তিনটা প্যানেল এক পেজে: `AccessControlPage` (স্টুডেন্ট বেছে ক্যাটাগরি/প্রেসক্রিপশন লক-আনলক ও এক্সপায়ারি ম্যানেজ), `StuckAttemptsPage` (আটকে যাওয়া এক্সাম অ্যাটেম্পট ভয়েড করা), `AuditLogPage` (সাম্প্রতিক ১০০টা অ্যাডমিন অ্যাকশন লগ)।
- **Payments** (`/admin/payments`) — `PaymentAdminPage.jsx`: ট্রানজেকশন অ্যাপ্রুভাল + `PromoCodesPanel` (প্রোমো কোড তৈরি/ম্যানেজ)। (Super Admin-only অংশ কোডে `role === 'super_admin'` চেক দিয়ে গার্ড করা।)
- **Prescriptions** (`/admin/prescriptions`) — `PrescriptionActivityPage.jsx` (আগে থেকেই ছিল, একই জায়গায় আছে)।
- **Feedback** (`/admin/feedback`) — `FeedbackAdminPage.jsx`: টাইপ অনুযায়ী ফিল্টার, স্ট্যাটাস আপডেট, ডিলিট।
- **Settings ট্যাব এখন একসাথে অনেকগুলো প্যানেল**: `FeatureTogglesPanel`, `ContactInfoPanel` (যোগাযোগ মাধ্যম এডিট), `MotivationalLinePanel` (হোমপেজের অনুপ্রেরণামূলক লাইন এডিট), `HelpCenterAdminPage` (হেল্প সেকশন এডিট), `UpcomingFeaturesAdminPage` (রোডম্যাপ এডিট), `ChangePasswordPanel`।

## Admin/Moderator ড্যাশবোর্ড
- এখন `ModeratorDashboard.jsx` **দুই রোল** হ্যান্ডেল করে: `moderator` এবং নতুন `admin` রোল (একই কম্পোনেন্ট, `profile.role === 'admin'` চেক দিয়ে টাইটেল ও এক্সট্রা ট্যাব বদলায়)।
- **Moderator**: Dashboard, Exam Schedule, Question Bank, Exams, Notice Board, Messages, Settings (শুধু Change Password)।
- **Admin** (Moderator-এর সব + বাড়তি): **Categories** (এডিট করতে পারে, ডিলিট করতে পারে না — `hideDelete` প্রপ দিয়ে), **Packages** (`PackagesReadOnlyPage.jsx` — শুধু দেখা, এডিট না)।
- চ্যাটে (`StaffChatInbox.jsx`, `StudentChatPage.jsx`) `sender_role === 'admin'`-কে "Admin" লেবেল দিয়ে আলাদা দেখানো হয়।

## `ExamRunner.jsx` (Live Exam + Practice শেয়ার্ড কম্পোনেন্ট) — অপরিবর্তিত মূল লজিক
আগের সামারিতে বর্ণিত সব লজিক এখনো বলবৎ: রিজিউম-আফটার-রিফ্রেশ (localStorage), ব্যাক-বাটন ইন্টারসেপশন, স্ট্যাগারড অটো-সাবমিট (০-৪ সেকেন্ড র‍্যান্ডম ডিলে), ব্যাচড আপসার্ট (এক DB কল-এ সব উত্তর)। নতুন সংযোজন: **exam font size setting** (`lib/examFontSize.js`) এখন প্রশ্ন/অপশন টেক্সট সাইজ নিয়ন্ত্রণ করে।

## গুরুত্বপূর্ণ বিজনেস রুল (রিগ্রেস করবেন না)
আগের সামারির সব রুল এখনো প্রযোজ্য:
1. এক্সাম স্ট্যাটাস লাইভ কম্পিউট হয় সময় থেকে, স্টোরড কলাম থেকে না — কোনো cron/scheduler নেই।
2. টাইমার ডিফল্ট = `round(প্রশ্ন সংখ্যা * 0.6)` মিনিট।
3. Availability window (`start_time`/`end_time`) টাইমার ডিউরেশন থেকে আলাদা।
4. মেরিট লিস্ট `end_time` পার না হওয়া পর্যন্ত লুকানো থাকে।
5. প্র্যাকটিস কখনো অফিসিয়াল রেজাল্ট স্পর্শ করে না।
6. একই এক্সামে ডুপ্লিকেট অফিসিয়াল অ্যাটেম্পট ব্লকড (ইউনিক ইনডেক্স)।
7. `attempt_answers`-এ লেখা হয় অ্যাটেম্পট `in_progress` থাকা অবস্থাতেই, `submitted` মার্ক করার আগে।
8. একজনই Super Admin — DB ট্রিগার দিয়ে সুরক্ষিত (ডিলিট/ডিমোট/দ্বিতীয় জন তৈরি — সব ব্লকড)।
9. Moderator সংখ্যায় কোনো লিমিট নেই।
10. Moderator/Admin শুধু student + নিজের চ্যাট মেসেজ দেখে, Super Admin-এর মেসেজ কখনো না।

## নিরাপত্তা সংক্রান্ত নোট (ইউজারের সচেতন সিদ্ধান্ত, আমার সাজেশন না)
- `user_credentials`-এ প্লেইন-টেক্সট পাসওয়ার্ড সেভ থাকে, শুধু Super Admin দেখতে পারে — ইউজারের সরাসরি অনুরোধে, ঝুঁকি জানিয়ে দেওয়ার পরেও।
- বড় পরিসরে ব্যবহার হলে এটা প্রপার পাসওয়ার্ড-রিসেট ফ্লো দিয়ে রিপ্লেস করার পরামর্শ থাকবে (যদিও এখন Forgot Password ফ্লো যোগ হয়েছে, `user_credentials` টেবিলটা এখনো আলাদাভাবে আছে)।

## পারফরম্যান্স নোট (৫০০-১০০০ কনকারেন্ট স্টুডেন্টের জন্য)
- Supabase **Free tier**-এ আছে — বড় লাইভ এক্সামের আগে লোড-টেস্ট এবং সম্ভবত Pro tier আপগ্রেড (~$25/মাস) বিবেচনা করা উচিত।
- অপ্টিমাইজেশন প্রয়োগ করা আছে: ব্যাচড আনসার রাইট, স্ট্যাগারড অটো-সাবমিট জিটার, হট-পাথ টেবিলে ইনডেক্স।

## ডিপ্লয়মেন্ট ওয়ার্কফ্লো
1. `/home/claude/examapp` (Vite React প্রজেক্ট)-এ ফাইল জেনারেট/এডিট করা হয়
2. `npm run build` দিয়ে এরর-ফ্রি ভেরিফাই
3. `node_modules`, `.git`, `.env` বাদ দিয়ে পুরো প্রজেক্ট জিপ করা হয়
4. ইউজার ডাউনলোড করে extract করে GitHub-এর ওয়েব "Add file → Upload files"-এ আপলোড করে (রিপো-রুটে ফাইলগুলো যেন সরাসরি বসে)
5. Vercel অটো-ডিটেক্ট করে রিডিপ্লয় করে
6. DB পরিবর্তনের জন্য আলাদা `.sql` মাইগ্রেশন ফাইল দেওয়া হয়, Supabase SQL Editor-এ রান করার জন্য

## ফাইল স্ট্রাকচার (কম্পোনেন্ট রেফারেন্স, দ্রুত খুঁজে পাওয়ার জন্য)
```
src/
├── App.jsx                          — রাউটিং, role-based lazy dashboards
├── main.jsx                         — Sentry init + ErrorBoundary
├── contexts/AuthContext.jsx         — auth, referral, forgot/reset password
├── components/
│   ├── ExamRunner.jsx               — লাইভ এক্সাম + প্র্যাকটিস (শেয়ার্ড)
│   ├── PracticePage.jsx             — PracticeSetup, PracticeSession, findResumablePracticeSession এক্সপোর্ট করে
│   ├── QuestionBankPracticePage.jsx — নতুন প্র্যাকটিস এন্ট্রি পয়েন্ট
│   ├── PracticeSessionRoute.jsx     — প্র্যাকটিস সেশন রাউট wrapper
│   ├── BookmarksPage.jsx / SmartSearchPage.jsx — নতুন
│   ├── ChamberHome.jsx / PatientsListPage.jsx / PatientProfilePage.jsx / PrescriptionHistoryPage.jsx — চেম্বার মডিউল (নতুন)
│   ├── FeedbackPage.jsx / FeedbackAdminPage.jsx — নতুন
│   ├── ContactUsPage.jsx / ContactInfoPanel.jsx — নতুন
│   ├── HelpCenterAdminPage.jsx / MotivationalLinePanel.jsx / UpcomingFeaturesAdminPage.jsx — নতুন (Settings ট্যাবে)
│   ├── ReferralPage.jsx / SettingsPage.jsx / SupportHubPage.jsx — নতুন
│   ├── AccessControlPage.jsx / StuckAttemptsPage.jsx / AuditLogPage.jsx — নতুন (Access Control ট্যাবে)
│   ├── PaymentAdminPage.jsx         — প্রোমো কোড প্যানেলসহ
│   └── StudentDashboardHome.jsx     — নতুন হোমপেজ
├── pages/
│   ├── HelpCenterPage.jsx           — পাবলিক /help
│   └── auth/
│       ├── ForgotPasswordPage.jsx / ResetPasswordPage.jsx / ResendConfirmationPage.jsx — নতুন
└── lib/
    ├── bookmarks.js / patients.js / examFontSize.js / useResendCooldown.js — নতুন হেল্পার
```

## সাম্প্রতিক আপডেট — চ্যাট সেশন লগ (নতুন চ্যাটে শুরু করার আগে অবশ্যই পড়ুন)
*এই সেকশনটা সময়ের সাথে যোগ হতে থাকবে। প্রতিটা এন্ট্রি বলে দেয় কী যোগ হয়েছে, কোন ফাইল বদলেছে, আর কোনো migration লাগলে সেটার নাম। নতুন চ্যাটে zip আপলোড করলে এই সেকশনটা প্রথমে পড়ে নিন — যা এখানে "✅ Done" লেখা আছে তা আবার নতুন করে বানানোর দরকার নেই।*

### ✅ Done — Landing Page + Mentors CMS
- `/` রুটে এখন লগইন করা না থাকলে `LandingPage.jsx` দেখায় (আগে সরাসরি `/login`-এ রিডাইরেক্ট হতো)
- নতুন ফাইল: `src/pages/LandingPage.jsx`, `src/components/MentorsAdminPage.jsx`
- বদলানো ফাইল: `src/pages/HomeRedirect.jsx`, `src/pages/admin/SuperAdminDashboard.jsx` (Settings ট্যাবে `MentorsAdminPage` যোগ), `src/App.css` (ল্যান্ডিং/মেন্টর কার্ড স্টাইল)
- DB: `migration_mentors.sql` — `mentors` টেবিল + `mentor-photos` স্টোরেজ বাকেট (রান করা হয়েছে ✅)

### ✅ Done — প্যাকেজ ডিউরেশন ফ্লেক্সিবল
- `PaymentAdminPage.jsx`-এর প্যাকেজ ফর্মে এখন 7/15/30/90/180/365 দিন প্রিসেট + Custom (যেকোনো সংখ্যা) অপশন আছে
- কোনো DB মাইগ্রেশন লাগেনি (কলাম আগে থেকেই যেকোনো integer নিতে পারত, সমস্যা ছিল শুধু UI dropdown-এ)

### ⚠️ Partially done — Referral Reward System (**বর্তমানে বন্ধ/OFF, টাকা-পয়সা রিলেটেড সাবধানে এগোতে হবে**)
- `ReferralPage.jsx` এখন CMS সেটিং থেকে ডাইনামিক টেক্সট দেখায়, WhatsApp/Messenger native-share বাটন যোগ হয়েছে
- Super Admin Settings-এ `ReferralSettingsPanel.jsx` (নতুন) — reward on/off + দিন সংখ্যা এডিট
- **সমস্যা যা এখনো ঠিক হয়নি**: `app_settings.value` কলাম আসলে `boolean` টাইপ ছিল (আমার ভুল অনুমান ছিল এটা `jsonb`)। `alter column value type jsonb` চালাতে গিয়ে "default for column value cannot be cast automatically to type jsonb" এরর এসেছে (কলামের DEFAULT ভ্যালু আগে ড্রপ করে তারপর ALTER করতে হবে, এখনো করা হয়নি)।
- **ফলে**: reward system-এর ব্যাকএন্ড (trigger, `referral_rewards` টেবিল) এখনো তৈরি হয়নি DB-তে। Toggle Off অবস্থায় আছে বলে ইউজার-ফেসিং কোনো সমস্যা নেই, কিন্তু ভবিষ্যতে চালু করতে চাইলে আগে এই কলাম টাইপ সমস্যাটা সমাধান করতে হবে: `alter table app_settings alter column value drop default;` তারপর `alter column value type jsonb using to_jsonb(value);` তারপর দরকার হলে নতুন default (`'false'::jsonb`) সেট করা।
- সংশ্লিষ্ট ফাইল (এখনো রান করা হয়নি): `migration_referral_reward_fixed.sql`
- **এখনো অজানা**: `ContactInfoPanel.jsx`/`MotivationalLinePanel.jsx`ও একই `app_settings.value` কলামে টেক্সট/লিস্ট সেভ করার চেষ্টা করে — এই কলাম যেহেতু boolean-only ছিল, এই দুটো ফিচারও সম্ভবত সাইলেন্টলি ফেইল করছে (এখনো ভেরিফাই/ফিক্স করা হয়নি)।

### ✅ Done — Payment Notification + Sender Phone Number + Payment Claims কার্ড
- Super Admin-কে এখন bell notification পাঠায় যখন কোনো নতুন পেমেন্ট সাবমিট হয় (`payment_pending` টাইপ)
- **বাগ ফিক্স**: `notifications_type_check` কনস্ট্রেইন্টে `payment_pending` টাইপ যোগ করা হয়নি বলে প্রথমবার এরর এসেছিল — `migration_notifications_and_sender_phone.sql`-এ ফিক্স করা হয়েছে
- Examinee পেমেন্ট সাবমিট করার সময় এখন "যে নাম্বার থেকে টাকা পাঠিয়েছেন" আলাদা ইনপুট বক্স আছে (`payment_claims.sender_phone_number` কলাম) — `PackagePage.jsx`-এ ফর্মে যোগ, `PaymentAdminPage.jsx`-এ Approve লিস্টে দেখায়
- `PaymentAdminPage.jsx`-এ **Payment Claims কার্ড এখন সবার উপরে** (আগে Package Settings/Promo Codes-এর নিচে ছিল), pending থাকলে সোনালি বর্ডার + "N pending" ব্যাজ দেখায়
- DB migration: `migration_payment_notification.sql` (ট্রিগার তৈরি) + `migration_notifications_and_sender_phone.sql` (constraint fix + নতুন কলাম + notification body-তে sender phone যোগ) — **দুটোই রান করতে হবে (দ্বিতীয়টা রান করলেই যথেষ্ট, এটা প্রথমটাসহ সব রিপ্লেস করে)**

### ⚠️ Needs manual setup — Push Notification System (সব রোলের জন্য)
- `notifications` টেবিলে যেখানেই নতুন রো insert হয় (payment_pending, chat_message, exam_published, expiry_warning, payment_approved, payment_rejected — সব টাইপেই), এখন থেকে সেই ইউজারের ব্রাউজারে/ফোনে একটা **আসল push notification** যাবে, অ্যাপ বন্ধ থাকলেও।
- নতুন ফাইল: `public/sw.js` (Service Worker), `src/lib/usePushNotifications.js` (permission চাওয়া + subscription সেভ করার হুক)
- বদলানো ফাইল: `src/components/DashboardLayout.jsx` (হুকটা এখানে কল করা হয়, তাই সব রোলেই কাজ করবে — Super Admin/Admin/Moderator/Examinee)
- `.env.example`-এ নতুন `VITE_VAPID_PUBLIC_KEY` — Vercel-এ env var হিসেবে বসাতে হবে
- **এই ফিচারটা শুধু zip+SQL দিয়ে সম্পূর্ণ হয় না — নিচের ৩ ধাপ ম্যানুয়ালি করতে হবে:**
  1. `supabase_edge_function_send-push.ts`-এর ভেতরের নির্দেশনা অনুযায়ী Supabase Dashboard → Edge Functions-এ `send-push` নামে ফাংশন বানিয়ে কোড পেস্ট করে Deploy করা (Verify JWT আনচেক করে)
  2. Edge Function-এর Secrets-এ VAPID কী ও একটা নিজের বানানো secret বসানো
  3. `migration_push_notifications.sql`-এ `<YOUR_PROJECT_REF>` ও secret বসিয়ে রান করা
- **VAPID key pair (একবারই লাগে, এই সেশনে জেনারেট করা হয়েছে)**:
  - Public (frontend-এ যাবে): `BJNPjAGUq3SGDf9Wfxm9XWS_GHHzD5vDnpxPLDY8R8rLRzA2E8P60BQl6OfLlA4bcUQwsiCFT6bIeP9wdZF24mo`
  - Private (শুধু Edge Function secret-এ, কখনো frontend/GitHub-এ না): `BW0jrEH14A0ttEK8G69usMwo1pYpE9MHslvNdQMA9tk`
- **এখনো বাকি**: উপরের ৩ ধাপ ইউজার নিজে করেননি এখনো, তাই push আসলে কাজ করছে কিনা টেস্ট করা হয়নি।

### 🐛 Fixed — Zip packaging bug (dotfiles missing)
- এতদিন ডেলিভার করা প্রতিটা zip থেকে `.env.example`, `.gitignore`, `.oxlintrc.json` বাদ পড়ে যাচ্ছিল (একটা `cp` কমান্ডের bug — dotfile কপি হচ্ছিল না)। এই zip থেকে ফিক্স করা হয়েছে, এখন এই ৩টা ফাইলও থাকবে।

### ✅ Done — Push Notification System (finally working!)
- অনেক ডিবাগিংয়ের পর সফলভাবে কাজ করছে। মূল সমস্যাগুলো ছিল: (১) Supabase-এর Kong গেটওয়ে `apikey` হেডার (Authorization থেকে আলাদা) সবসময় বাধ্যতামূলক চায়, (২) `VAPID_SUBJECT`-এ `mailto:` প্রিফিক্স ছাড়া ভ্যালিড URL হয় না, (৩) নতুন প্রজেক্টে Legacy JWT keys ছাড়াও নতুন Publishable/Secret key সিস্টেম আছে যেটা নিয়ে সতর্ক থাকতে হবে
- ফাইনাল কাজ করা trigger-এ `apikey` + `Authorization` (দুটোতেই anon key) + `x-push-secret` (নিজস্ব) — তিনটা হেডারই লাগে

### ✅ Done — Question Bank Study Mode (নতুন ফিচার)
- Examinee ড্যাশবোর্ডে "Question Bank Practice"-এর পাশে নতুন **"Question Bank (Study)"** কুইক অ্যাকশন — কুইজ শুরু না করেই প্রশ্ন ব্রাউজ/পড়া যায়
- ফ্লো: ক্যাটাগরি বাছাই → প্রতিটা Subject-এর কার্ড (প্রোগ্রেস রিং, হার্ট কাউন্ট, Subtopics/Questions সংখ্যা) → **All Questions** (পুরো subject-এর সব প্রশ্ন, paginated 50/page) / **All Subtopics** (subcategory বেছে সেটার প্রশ্ন) / **Random Quiz** (বিদ্যমান practice session লজিক পুনর্ব্যবহার করে, নতুন কিছু লেখা হয়নি)
- প্রতিটা প্রশ্নে: read/unread checkbox, উত্তর দেখান, ব্যাখ্যা দেখান, বুকমার্ক (♡/♥) — বুকমার্ক আগে থেকে থাকা `bookmarked_questions`/`lib/bookmarks.js` পুনর্ব্যবহার করে
- নতুন ফাইল: `src/components/QuestionStudyHub.jsx`, `src/lib/readMarks.js`
- বদলানো ফাইল: `src/pages/examinee/ExamineeDashboard.jsx` (রুট `question-bank-study`), `src/components/StudentDashboardHome.jsx` (নতুন কুইক অ্যাকশন), `src/App.css`
- DB: `migration_question_read_marks.sql` — নতুন `question_read_marks` টেবিল + দুটো RPC (`get_subject_study_progress`, `get_subject_bookmark_count`) — বড় subject-এ (৬০০০+ প্রশ্ন) হাজার হাজার question id ক্লায়েন্টে না পাঠিয়ে সার্ভার-সাইডে efficient ভাবে গণনা করার জন্য
- **স্কোপ থেকে বাদ দেওয়া হয়েছে ইচ্ছাকৃতভাবে**: রেফারেন্স স্ক্রিনশটে একটা পাই-চার্ট আইকন ছিল (সম্ভবত stats/analytics) — এটা স্পষ্টভাবে বর্ণনা করা হয়নি, তাই যোগ করা হয়নি। ভবিষ্যতে দরকার হলে জানাবেন।

### 🐛 Fixed — Admin role blocked from Payment Claims (RBAC gap)
- `get_all_payment_claims` ও `review_payment_claim` — এই দুটো DB ফাংশনে হার্ডকোড করা ছিল `role <> 'super_admin'` হলেই এরর, `admin` রোলকে বিবেচনাই করা হয়নি। এজন্যই Admin-এর Payment Claims কার্ডে কোনো ডেটা আসছিল না।
- `fix_admin_payment_access.sql`-এ ফিক্স করা হয়েছে — এখন `super_admin` ও `admin` দুটোই কাজ করবে, Moderator এখনো বাদ (আগের RBAC অনুযায়ী)।
- সাথে Payment Claims/Package কার্ডের মোবাইল রেসপন্সিভ CSS বাগও ফিক্স হয়েছে (`.claim-row-main` ক্লাসটা আগে সংজ্ঞায়িতই ছিল না)।

### ✅ Done — Super Admin CMS Panel পুনর্গঠন + app_settings রুট-কজ ফিক্স
- **root cause পাওয়া গেছে**: `app_settings.value` কলাম বহুদিন ধরে `boolean` টাইপে আটকে ছিল, যার ফলে `ContactInfoPanel`/`MotivationalLinePanel` (যেগুলো টেক্সট/লিস্ট সেভ করার চেষ্টা করে) **সাইলেন্টলি ফেইল** করছিল। আগের চেষ্টা (`migration_referral_reward_fixed.sql`) কলামের DEFAULT ভ্যালুর কারণে ব্যর্থ হয়েছিল।
- `fix_app_settings_jsonb.sql`-এ সঠিকভাবে ফিক্স করা হয়েছে (আগে DEFAULT ড্রপ করে, তারপর টাইপ বদলে, তারপর নতুন jsonb-compatible DEFAULT সেট করে) — **এটা রান করলে Contact Us page ও Motivational line CMS প্যানেল দুটোই প্রথমবারের মতো আসলেই কাজ করবে**।
- Super Admin-এর নেভিগেশনে নতুন **"Website / CMS"** ট্যাব যোগ হয়েছে (`/admin/cms`) — Mentors, Contact Info, Motivational Line, Help Center, Upcoming Features — এই ৫টা ওয়েবসাইট-কনটেন্ট প্যানেল এখন এক জায়গায়, Settings থেকে আলাদা।
- **Settings ট্যাব** এখন শুধু সিস্টেম/অ্যাকাউন্ট লেভেলের জিনিস রাখে: Feature Toggles, Referral Reward সেটিং, Change Password।
- বদলানো ফাইল: `src/pages/admin/SuperAdminDashboard.jsx`

### ✅ Done — Full-App CMS (Logo, Banner, Notice, FAQ, Blog, Terms, Privacy)
- Super Admin → Website/CMS ট্যাবে এখন সব ওয়েবসাইট কনটেন্ট ম্যানেজ করা যায়: **Mentors, Logo+Banner+Notice, Contact Info, Motivational Line, FAQ, Blog, Terms/Privacy, Help Center, Upcoming Features**
- **ডিফল্ট বিহেভিয়ার নিশ্চিত করা হয়েছে**: প্রতিটা নতুন টেবিল/সেটিং সেন্সিবল ডিফল্ট নিয়ে সিড করা (banner/notice off, FAQ/Blog খালি, Terms/Privacy-তে বাস্তব লেখা কনটেন্ট) — এডিট না করলে যা এখন আছে তাই দেখাবে, কিছু ভাঙবে না।
- **নতুন পাবলিক পেজ**: `/terms`, `/privacy`, `/faq`, `/blog`, `/blog/:slug` — সব লগইন ছাড়াই দেখা যায়
- ল্যান্ডিং পেজে এখন: লোগো (আপলোড করলে BrandWordmark-এর জায়গায়), হোমপেজ ব্যানার (on/off), সাইট-ওয়াইড নোটিস বার (on/off), FAQ প্রিভিউ সেকশন, ফুটারে সব নতুন পেজের লিংক
- রেজিস্ট্রেশন ফর্মে Terms/Privacy-এর লিংক যোগ হয়েছে ("রেজিস্ট্রেশন করার মাধ্যমে আপনি সম্মত হচ্ছেন...")
- নতুন ফাইল: `components/{LegalPagesAdminPage,FaqAdminPage,BlogAdminPage,LogoBannerAdminPage,PasswordField}.jsx`, `pages/{LegalPage,FaqPage,BlogListPage,BlogPostPage}.jsx`
- DB: `migration_full_cms.sql` — নতুন টেবিল (`legal_pages`, `faqs`, `blog_posts`), নতুন স্টোরেজ বাকেট (`site-media`), `app_settings`-এ ৩টা নতুন পাবলিক-রিডেবল কী (`site_logo_url`, `site_banner`, `site_notice`), এবং Terms/Privacy-এর বাস্তব ডিফল্ট কনটেন্ট সিড করা (Bangla-তে লেখা, প্রয়োজনে CMS থেকে এডিট করুন)
- ⚠️ **আমি আইনজীবী না** — সিড করা Terms/Privacy একটা ভালো শুরুর টেমপ্লেট, কিন্তু পেমেন্ট নেওয়া ও রোগীর তথ্য (Chamber ফিচার) হ্যান্ডেল করা প্ল্যাটফর্ম হিসেবে একজন আইনজীবী দিয়ে একবার রিভিউ করানো ভালো।

### ✅ Done — পাসওয়ার্ড স্ট্রেংথ UI (Register + Reset Password)
- নতুন `PasswordField.jsx` কম্পোনেন্ট — show/hide 👁️ আইকন + লাইভ চেকলিস্ট (৮+ অক্ষর, বড় হাতের, ছোট হাতের, সংখ্যা)
- রেজিস্ট্রেশন ও Reset Password — দুই জায়গাতেই এখন স্ট্রং পাসওয়ার্ড বাধ্যতামূলক (আগে শুধু ৬ অক্ষর দিলেই হতো)

### 🐛 Fixed — Payment history/claim ডিলিট কাজ করছিল না
- `payment_claims` টেবিলে DELETE-এর জন্য কোনো RLS পলিসিই ছিল না — তাই Super Admin "Delete" চাপলে কোনো এরর ছাড়াই চুপচাপ ০টা রো ডিলিট হতো। `fix_payment_claims_delete.sql`-এ ফিক্স করা হয়েছে।

## এখনো যা নেই / ভবিষ্যতে করা যেতে পারে
- মূল ৭-পয়েন্ট স্পেকের সব ফিচার আগেই সম্পূর্ণ ছিল। এই ভার্সনে যোগ হওয়া বড় মডিউলগুলো (Dental Chamber, Payment/Promo system, Feedback, Help Center, Referral, Bookmarks, Smart Search, Sentry error tracking, Forgot/Reset password) — এগুলোর প্রতিটাই ফাংশনাল অবস্থায় ডিপ্লয়েড।
- পেমেন্ট সিস্টেম কারেন্টলি ম্যানুয়াল ট্রানজেকশন-আইডি ভেরিফিকেশন-ভিত্তিক (bKash ইত্যাদি) — অটোমেটেড পেমেন্ট গেটওয়ে ইন্টিগ্রেশন নেই।
- Sentry ঐচ্ছিক এবং এখনো DSN কনফিগার করা না থাকলে সক্রিয় না — ভবিষ্যতে অ্যাক্টিভেট করার কথা মনে রাখা দরকার।
