# ৫২তম বিসিএস প্রস্তুতি প্ল্যাটফর্ম — Architecture (Phase 02, অনুমোদিত)

মূল দর্শন: RESEARCH → PLAN → SOLVE → REVIEW → REVISE → MASTER → ADVANCE → EXAM → IMPROVE

## ১. অনুমোদিত সিদ্ধান্ত (Phase 01 পর্যালোচনা)

| # | সিদ্ধান্ত | কোথায় প্রয়োগ |
|---|---|---|
| ১ | বিশেষ বিসিএস: ডেটাসেট অনুযায়ী ৮টি (১২, ১৮, ২৬, ৩২, ৩৯, ৪২, ৪৮, ৪৯) | `Exam.type = SPECIAL`; Level 1 ক্রমের ভেতরেই, আলাদা লেবেল |
| ২ | Threshold: Level 1 ও 2-এ ৮০% | `src/lib/rules/defaults.ts` → `RuleSetting` |
| ৩ | ব্যাখ্যার ঘাটতি পূরণ: Claude লিখবে, "যাচাই বাকি" অবস্থায় | `Question.explanationStatus = DRAFT` |
| ৪ | বাধ্যতামূলক পথে V ও C; J ও S ঐচ্ছিক অনুশীলনে; D/X/N বাতিল | `path.eligible_classes`, `path.practice_classes`, `status = RETIRED` |
| ৫ | Level 2-এর ৯,০০০ প্রশ্নই নতুন; পুরোনো প্রশ্ন শুধু Revision-এ | `Question.kind = TOPIC` বনাম `HISTORICAL` |
| ৬ | Level 3 গেট: শেষ ৫ টেস্টের গড় নেট ১২০ (স্তর ১→২), ১৪০ (২→৩); প্রতিটি টেস্টের পর ভুল Review বাধ্যতামূলক | `l3.gate.*`, `l3.require_review` |
| ৭ | Next.js + PostgreSQL-এ নতুন করে তৈরি; প্রোটোটাইপের যুক্তি (বাছাই-ওজন, Revision-ব্যান্ড, Cumulative সূত্র) পোর্ট | `select.weights`, `l1.revision.bands`, `l1.cumulative.*` |

## ২. প্রযুক্তি

- Next.js ১৬ (App Router, TypeScript), Tailwind CSS ৪, Recharts (Phase 03)
- PostgreSQL + Prisma ৬। স্থানীয় ডেভেলপমেন্টে `embedded-postgres` (PostgreSQL ১৮ বাইনারি, `npm run db`)
- প্রমাণীকরণ: নিজস্ব সার্ভার-সাইড সেশন (`Session` টেবিল; কুকিতে HttpOnly র‍্যান্ডম টোকেন, ডেটাবেসে শুধু হ্যাশ), bcrypt পাসওয়ার্ড-হ্যাশ, এককালীন হ্যাশকৃত রিসেট-টোকেন।
  তৃতীয় পক্ষের Auth লাইব্রেরি নয় — Email/Password-ভিত্তিক সাধারণ প্রবাহে এটাই সবচেয়ে সরল ও নিরীক্ষাযোগ্য।
- বাংলা ফন্ট: Hind Siliguri

## ৩. Sitemap

```
Public:   /  · /research · /research/subject/[code] · /roadmap · /repeated-questions · /about
          /login · /register · /reset-password
Student:  /dashboard · /level-1 · /level-1/[bcsNo] · /level-2 · /level-2/[subtopicCode]
          /level-3 · /level-3/[testNo] · /test/[attemptId] · /result/[attemptId]
          /revision · /mistakes · /bookmarks · /search · /calendar · /achievements · /profile
          /readiness-report
Admin:    /admin · /admin/questions · /admin/import · /admin/verify · /admin/taxonomy
          /admin/roadmap · /admin/rules · /admin/model-tests · /admin/students · /admin/reports
          /admin/backup
```

## ৪. ডেটা-মডেল (প্রধান সম্পর্ক)

```
Subject 1─* Topic 1─* Subtopic 1─* Question *─0..1 Exam
Question *─* RepeatFamily (QuestionFamily)
LearningLevel 1─* LearningTask ─ (Exam | Subtopic | ModelTest)
LearningTask *─* LearningTask (TaskPrerequisite: "এটি খুলতে ওগুলো শেষ হতে হবে")
User 1─* StudentTaskProgress (প্রতি কাজে: state LOCKED/AVAILABLE/IN_PROGRESS/COMPLETED, step SOLVE…DONE)
User 1─* TestAttempt 1─* AttemptAnswer
User 1─* QuestionStat  (ভুলের ভান্ডার + দুর্বল প্রশ্ন + Leitner SRS একসঙ্গে)
ModelTest 1─* ModelTestQuestion *─1 Question
RuleSetting (key, scope) — সব নিয়ম; নির্দিষ্টতর scope আগে প্রযোজ্য
```

প্রম্পটে চাওয়া Entity-র অবস্থান: Answers ও Explanations আলাদা টেবিল নয়, `Question`-এর কলাম
(`correctIndex`, `explanation`, `explanationStatus`) — কারণ প্রতিটি প্রশ্নের উত্তর ও ব্যাখ্যা একটিই।
Weak Questions = `QuestionStat` যেখানে `wrong > 0`; Unlock Conditions = `TaskPrerequisite` + `RuleSetting`।

## ৫. Unlock-এর নিয়ম (সার্ভার-সাইড)

1. প্রতিটি API কল: `StudentTaskProgress.state ∈ {AVAILABLE, IN_PROGRESS, COMPLETED}` না হলে ৪০৩।
2. কাজ শেষ হলে (একটি ডেটাবেস-Transaction-এ): `COMPLETED` লেখা → যেসব কাজের সব পূর্বশর্ত এখন শেষ, সেগুলো `AVAILABLE`।
3. প্রশ্নের লেখা শুধু চলমান Attempt-এর প্রশ্নগুলোর জন্য পাঠানো হয়; সঠিক উত্তর ও ব্যাখ্যা জমা দেওয়ার পরে।
4. টাইমারযুক্ত পরীক্ষায় `deadlineAt`-এর পরে জমা এলে সার্ভার ঐ মুহূর্ত পর্যন্ত সংরক্ষিত উত্তর ধরে স্বয়ংক্রিয়ভাবে জমা দেয়।
5. অ্যাডমিন হাতে Unlock করলে `overrideBy/overrideAt` ও `AuditLog`-এ রেকর্ড।

### Level 1 Cycle (প্রতিটি বিসিএস)

```
SOLVE (৫০টি করে ভাগে) → REVIEW (দেখা নিশ্চিত) → REVISION (প্রথম স্কোর অনুযায়ী ১৫/২৫/৩৫/৪০টি)
→ MASTERY (৪০টি, ≥৮০%) → CUMULATIVE (১১তম থেকে: ২০ + ৫×সম্পন্ন, সর্বোচ্চ ১০০, ≥৮০%) → DONE → পরের বিসিএস
৪১টি শেষে → Level 1 Final (১০০টি, ≥৮০%) → Level 2 Phase A খোলে
```

### Level 2

চারটি Priority Phase (A ৩৬ → B ৫১ → C ৬৬ → D ১১৫ উপবিষয়)। একটি Phase-এর সব উপবিষয় একসঙ্গে খোলে;
Phase-এর সব উপবিষয় শেষ হলে Checkpoint; Checkpoint পাস করলে পরের Phase। শেষে Level 2 Final (২০০টি)।
SRS: Leitner বাক্স ১–৫, ব্যবধান ১/৩/৭/১৪/৩০ দিন; আজকের Revision বাকি থাকলে নতুন উপবিষয় নয় (দৈনিক সর্বোচ্চ ৬০)।

### Level 3

১৫০টি টেস্ট, ২০০ প্রশ্ন, ১২০ মিনিট, ভুলে −০.৫। স্তর ১ (১–৫০), ২ (৫১–১০০), ৩ (১০১–১৫০)।
পরের টেস্ট: আগেরটির ভুল Review। স্তর-গেট: শেষ ৫টির গড় নেট ১২০ / ১৪০।
পরপর ১০টি টেস্টে একই প্রশ্ন নয়। প্রতিটি টেস্ট অ্যাডমিন অনুমোদনের পর প্রকাশ।

## ৬. বর্তমান ডেটা-অবস্থা (Phase 02 শেষে, স্বাধীন যাচাইয়ে ২০/২০ মিল)

- ৫,৩৫২ ঐতিহাসিক প্রশ্ন; প্রকাশিত ৫,৩১২ (বাধ্যতামূলক পথযোগ্য V+C ৫,২১৫; ঐচ্ছিক J+S ৯৭); বাতিল ৪০
  (D ১৯, X ৯, N ৬, এবং অপশন অসম্পূর্ণ ৬টি V-প্রশ্ন: ১৫-৮৯, ১৬-৫৩, ২২-৮৫, ২২-৮৭, ২২-৯৮, ২৫-৬২)
- ব্যাখ্যা আছে ১,৫৬০টিতে (DRAFT অবস্থায়, অ্যাডমিন নিশ্চিত করবেন)
- ১০ বিষয়, ৪৬ টপিক, ২৬৮ উপবিষয় (Priority A ৩৬, B ৫১, C ৬৬, D ১১৫), ১৭১ পুনরাবৃত্তি-পরিবার (৩৬৭ প্রশ্ন-সংযোগ)
- ৪১ পরীক্ষা; আংশিক: ১৯তম (৫০/১০০); ২৯তম-এ ১০২টি (উৎসে অতিরিক্ত ২টি — যাচাই দরকার)
- Roadmap: ৩১৫টি কাজ (Level 1: ৪২, Level 2: ২৭৩); Level 3-এর কাজ Phase 07-এ
- টপিক-স্তরের Priority Score (ধাপ ০৯-এ আছে) এখনও আনা হয়নি — Phase 03-এ HTML রিপোর্ট থেকে নেওয়া হবে
