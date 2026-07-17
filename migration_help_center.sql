-- ============================================================
-- Migration: help_center_sections (Super Admin editable Help Center)
-- Run this in Supabase SQL Editor before deploying the new frontend.
-- ============================================================
--
-- WHY: the Help Center's 14 sections were hardcoded in HelpCenterPage.jsx
-- — any wording fix, new section, or update needed a code change and a
-- redeploy. This moves it to the database so Super Admin can manage it
-- directly. This migration also seeds the table with the exact content
-- that was previously hardcoded, so nothing is lost on deploy.
--
-- body is plain text, paragraphs separated by a blank line (\n\n) — no
-- HTML/markdown is parsed or rendered, by design, so there's no XSS
-- surface from admin-entered content ever being injected as raw HTML.

create table if not exists help_center_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_help_center_sections_order on help_center_sections(display_order);

alter table help_center_sections enable row level security;

-- Public read — the Help Center is reachable before login.
drop policy if exists "help_center_sections_select_all" on help_center_sections;
create policy "help_center_sections_select_all" on help_center_sections
  for select
  to public
  using (true);

drop policy if exists "help_center_sections_insert_staff" on help_center_sections;
create policy "help_center_sections_insert_staff" on help_center_sections
  for insert
  to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

drop policy if exists "help_center_sections_update_staff" on help_center_sections;
create policy "help_center_sections_update_staff" on help_center_sections
  for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

drop policy if exists "help_center_sections_delete_staff" on help_center_sections;
create policy "help_center_sections_delete_staff" on help_center_sections
  for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'moderator')));

-- Seed with the existing content — only runs if the table is empty, so
-- this is safe to re-run and won't duplicate or overwrite edits made
-- after the first deploy.
insert into help_center_sections (title, body, display_order)
select * from (values
  ('📝 অ্যাকাউন্ট রেজিস্ট্রেশন', $$রেজিস্ট্রেশন করতে Register পেজে গিয়ে আপনার নাম, ইউজারনেম, ইমেইল, মোবাইল নম্বর ও পাসওয়ার্ড দিন।

রেজিস্ট্রেশনের পর একটা কনফার্মেশন ইমেইল যেতে পারে — সেটা এলে Inbox ও Spam/Junk দুটো ফোল্ডারই চেক করুন, লিংকে ক্লিক করে অ্যাকাউন্ট ভেরিফাই করুন।$$, 10),
  ('🔑 লগইন', $$ইমেইল ও পাসওয়ার্ড দিয়ে Login পেজ থেকে লগইন করুন।

"Incorrect email or password" দেখালে — বানান আবার চেক করুন। "verify your email" দেখালে — ইনবক্স/স্প্যামে কনফার্মেশন ইমেইল খুঁজুন, অথবা Login পেজ থেকেই "Resend confirmation email" চাপুন।$$, 20),
  ('🔓 পাসওয়ার্ড ভুলে গেলে', $$Login পেজে "Forgot password?" চাপুন → আপনার ইমেইল দিন → একটা রিসেট লিংক পাঠানো হবে।

ইমেইল না পেলে Inbox ও Spam দুটোই চেক করুন। লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।$$, 30),
  ('📦 প্যাকেজ কেনা', $$ড্যাশবোর্ডের Package ট্যাব থেকে উপলব্ধ প্যাকেজগুলো দেখুন — প্রতিটা প্যাকেজে কোন কোন ক্যাটাগরি আনলক হবে ও কতদিনের জন্য, তা লেখা থাকে।

পছন্দের প্যাকেজ বেছে ক্লেইম/পেমেন্ট প্রক্রিয়া শুরু করুন।$$, 40),
  ('💳 পেমেন্ট সাবমিট করা', $$প্যাকেজ বাছার পর পেমেন্ট করে ট্রানজেকশন আইডি/প্রমাণ সাবমিট করুন — Package পেজেই এই ফর্ম পাবেন।

সাবমিট করার পর সেটা "Pending" অবস্থায় থাকবে, যতক্ষণ না অ্যাডমিন অনুমোদন করেন।$$, 50),
  ('✅ পেমেন্ট অনুমোদন', $$আপনার সাবমিট করা পেমেন্ট অ্যাডমিন টিম যাচাই করে অনুমোদন করেন — সাধারণত কিছু সময়ের মধ্যেই হয়ে যায়।

অনুমোদন হলে বেল আইকনে (🔔) একটা নোটিফিকেশন পাবেন। বেশি দেরি হলে Messages থেকে যোগাযোগ করতে পারেন।$$, 60),
  ('🔓 সাবস্ক্রিপশন সক্রিয়করণ', $$পেমেন্ট অনুমোদন হওয়ার সাথে সাথেই সংশ্লিষ্ট ক্যাটাগরির এক্সাম ও প্র্যাকটিস স্বয়ংক্রিয়ভাবে আনলক হয়ে যায় — আলাদা করে কিছু করতে হয় না।

Home ড্যাশবোর্ডে Subscription অংশে আপনার সক্রিয় প্যাকেজ ও মেয়াদ (কতদিন বাকি) দেখা যাবে।$$, 70),
  ('📖 Question Bank Practice', $$Home থেকে Question Bank Practice চাপুন — শুধু আপনার সাবস্ক্রাইব করা ক্যাটাগরিগুলো দেখাবে।

একটা ক্যাটাগরি বাছার পর ৪টা মোড পাবেন: Subject (একটা বিষয় থেকে), Mixed (একাধিক বিষয় মিলিয়ে), By chapter (নির্দিষ্ট অধ্যায় থেকে), Random (পুরো ক্যাটাগরি থেকে র‍্যান্ডম)।

প্র্যাকটিস এক্সাম কখনো আপনার অফিসিয়াল রেজাল্ট বা মেরিট লিস্টে প্রভাব ফেলে না।$$, 80),
  ('🎯 Model Test', $$Home থেকে Start Mock Exam চাপুন বা Exams ট্যাব থেকে একটা ক্যাটাগরিতে ঢুকে Live/Upcoming/Archive ট্যাব দেখুন।

Archive থেকে পুরনো এক্সাম প্র্যাকটিস হিসেবে আবার দেওয়া যায় (রেজাল্টে প্রভাব ফেলে না), সাথে Merit List ও নিজের আগের রেজাল্টও দেখা যায়।$$, 90),
  ('⏱️ Live Exam Participation', $$নির্ধারিত সময়ে Live এক্সাম শুরু হয় — Exams → নিজের ক্যাটাগরি → Live ট্যাবে গিয়ে শুরু করুন।

একবার শুরু করলে টাইমার চলতে থাকে, তাই ভালো নেটওয়ার্ক ও পর্যাপ্ত সময় নিয়ে বসুন। জমা দেওয়ার পর তাৎক্ষণিক ফলাফল দেখা যায়।$$, 100),
  ('❤️ Bookmark Questions', $$যেকোনো প্রশ্নের পাশে ❤️ আইকনে চাপলেই সেটা সেভ হয়ে যায় — এক্সাম চলাকালীন, প্র্যাকটিসের সময়, বা রেজাল্ট রিভিউ করার সময়, যেকোনো জায়গা থেকে।

Home থেকে Bookmarked Questions চাপলে সব সেভ করা প্রশ্ন একসাথে দেখা ও প্র্যাকটিস করা যায়। আবার ❤️ চাপলে বুকমার্ক উঠে যায়।$$, 110),
  ('💊 Prescription Tool', $$Home → Prescription Tool থেকে রোগীর তথ্য, উপসর্গ, পরীক্ষা, ওষুধ লিখে প্রেসক্রিপশন তৈরি করুন — PDF ডাউনলোড করা যায়।

ফোন নম্বর দিয়েই রোগী স্বয়ংক্রিয়ভাবে চিহ্নিত হয় — একই নম্বরে আগের প্রেসক্রিপশন থাকলে সেটার সাথেই যুক্ত হয়ে যাবে, নতুন হলে নতুন রোগী প্রোফাইল তৈরি হয়ে যাবে।$$, 120),
  ('🧑‍⚕️ Patient Management', $$Home → Dental Chamber → Patient Management-এ রোগীর তালিকা, প্রোফাইল, অ্যাপয়েন্টমেন্ট শিডিউল ও আগের সব প্রেসক্রিপশন এক জায়গায় দেখা যায়।

নাম বা ফোন নম্বর দিয়ে খোঁজা যায়, নতুন অ্যাপয়েন্টমেন্ট বুক করা যায়, ক্লিনিক্যাল নোট ও পরবর্তী ভিজিটের তারিখ সংরক্ষণ করা যায়।$$, 130),
  ('🛠️ সাধারণ সমস্যা ও সমাধান', $$লগইন হচ্ছে না: ইমেইল/পাসওয়ার্ড ঠিক আছে কিনা দেখুন; "email not confirmed" দেখালে Inbox/Spam চেক করে ভেরিফাই করুন।

পাসওয়ার্ড রিসেট ইমেইল আসছে না: Spam ফোল্ডার চেক করুন, কিছুক্ষণ পর "Resend" চাপুন।

পেমেন্ট এখনো Pending: অ্যাডমিন টিম দেখে অনুমোদন করা পর্যন্ত অপেক্ষা করুন — দেরি হলে Messages থেকে যোগাযোগ করুন।

ক্যাটাগরি লক দেখাচ্ছে: সেই ক্যাটাগরির প্যাকেজ কেনা/অনুমোদন হয়নি এখনো — Package পেজ থেকে সাবস্ক্রাইব করুন।

কোনো প্রশ্নে ভুল/টাইপো মনে হলে: Feedback পেজ থেকে "Report a Bug" দিয়ে জানান, দ্রুত ঠিক করে দেওয়া হবে।$$, 140)
) as seed(title, body, display_order)
where not exists (select 1 from help_center_sections);
