# PostgreSQL → MariaDB (Hostinger Business) — কাজের পরিকল্পনা

অবস্থা: **সম্পন্ন — ২০২৬-১১-১১।** সব পরীক্ষা MariaDB 11.8.9-এ পাস। নিচের তালিকা ইতিহাস হিসেবে রাখা।

যা শেখা গেল (MariaDB-নির্দিষ্ট): একযোগে একই সারিতে লেখায় 1020 "Record has changed since last read" — `src/lib/db-retry.ts`-এর withWriteRetry; `@db.Date` কলামে সময়-বিন্দু দিয়ে খোঁজা মেলে না — দিনের হিসাব DateTime-এ; count()/sum() BigInt/Decimal ফেরত দেয় — `src/lib/sql.ts`-এর numify; Json-ঘরের ধরন prisma-json-types-generator দিয়ে string[]।
লক্ষ্য: Neon/PostgreSQL বাদ; Hostinger Business-এর **MariaDB 11.8.9** (প্রতি ডেটাবেস ৩ GB) একই সার্ভারে।
বিল্ড GitHub Actions-এ থাকবে (Hostinger-এর পুরোনো glibc-এ Next 16 compiler চলে না) — `.github/workflows/hostinger-build.yml`, `deploy` শাখা।

## ধাপ (ক্রমানুসারে; প্রতিটি শেষে `npx tsc --noEmit`)

1. **স্থানীয় MariaDB 11.8** — `scripts/db.ts` (এখন embedded-postgres) বদলে স্থানীয় MariaDB চালু
   (যেমন `mysql-memory-server` npm বা Windows-এ MariaDB zip), পোর্ট ৩৩০৭, ডেটাবেস `bcs52`, ব্যবহারকারী `bcs`।
   `.env`: `DATABASE_URL="mysql://bcs:bcs_local_dev@localhost:3307/bcs52"`। `env.ts`/`deploy-setup.ts`-এর স্থানীয়-ডেটাবেস শনাক্তকরণ (`localhost:5452|bcs_local_dev`) হালনাগাদ।
2. **schema.prisma** — `provider = "mysql"`; পুরোনো `prisma/migrations` সরিয়ে নতুন `init` migration (প্রোডাকশনে এখনও কোনো ডেটা নেই)।
   - তালিকা-ঘর → `Json`: `Question.options` (১৯৩), `TestAttempt.questionIds` (৩৯৭), `attemptIds` (৪৬৫)। (optionPerms ইত্যাদি অন্য তালিকা থাকলে একইভাবে)
   - লম্বা লেখা → `@db.Text`: `Question.text`, `explanation`, `verifyNote`, `answerNote`, `source`; `Subtopic.introBn`; `LearningLevel.descriptionBn`; `RuleSetting.noteBn`; `AuditLog`-এর বিবরণ; `ImportBatch` রিপোর্ট ইত্যাদি। ১৯১ অক্ষরের বেশি হতে পারে এমন সব `String`।
   - লম্বা লেখার ঘরে `@unique`/`@@index` থাকলে (যেমন `textHash` ঠিক আছে — ছোট) পরীক্ষা করুন।
3. **Json-ঘর পড়া/লেখা** — নিচের ফাইলে `options`/`questionIds`/`attemptIds` এখন `string[]` ধরে নেওয়া; Prisma `Json` → `as string[]` টাইপ-কাস্ট বা ছোট helper (`asStrings(v)`):
   `src/lib/exam/{service,select,analysis}.ts`, `src/lib/admin/{actions,export}.ts`, `src/lib/questions/{import,hash}.ts`, `src/lib/research/data.ts`,
   `src/app/{page,mistakes/page,level-2/[code]/page,admin/questions/page,admin/questions/[id]/page}.tsx`,
   `src/components/{admin/question-form,exam/question-review,exam/test-runner,home/omr-question,home/repeat-list}.tsx`, `scripts/import-research.ts`, `scripts/import-questions.ts`।
   Prisma-র তালিকা-ফিল্টার (`has`, `hasSome`) থাকলে বিকল্প লিখুন।
4. **কাঁচা SQL (PostgreSQL-রীতি → MariaDB)** — `"Quoted"` নাম → `` `backtick` ``; `::int`/`::text` → `CAST(... AS SIGNED)` বা বাদ; `to_char(x at time zone 'Asia/Dhaka')` → `DATE_FORMAT(CONVERT_TZ(x,'+00:00','+06:00'),'%Y-%m-%d')`; count/sum BigInt/Decimal ফেরত দেয় → `Number()`:
   `src/app/admin/reports/page.tsx`, `src/app/level-2/page.tsx`, `src/app/mistakes/page.tsx`, `src/lib/admin/export.ts`, `src/lib/exam/analysis.ts`,
   `src/lib/exam/service.ts:450` (addTime: `coalesce` MariaDB-তেও আছে, শুধু উদ্ধৃতি-চিহ্ন), `src/lib/progress/dashboard.ts`, `src/app/api/health/route.ts`,
   `scripts/{allocate-level2,check-integrity,stats}.ts`, পরীক্ষা-স্ক্রিপ্টগুলোর কাঁচা SQL।
5. **`mode: "insensitive"` বাদ** (MariaDB-র collation নিজেই case-insensitive): `src/app/admin/questions/page.tsx:30`, `src/app/admin/students/page.tsx:24`।
6. **লেনদেন/একযোগে অনুরোধ** — `createAttempt`-এর twin-dedupe ও submit-এর conditional `updateMany` MariaDB-তে (REPEATABLE READ) `test-security.ts` দিয়ে যাচাই।
7. **বিল্ড ডেটাবেস ছোঁবে না** — `"use cache"` পাতা (হোমপেজ, /research, /repeated-questions) বিল্ডে prerender হলে DB লাগে; সেগুলো রানটাইমে তৈরি হোক (connection()/dynamic) যাতে GitHub Actions-এ `DATABASE_URL` secret না লাগে। workflow থেকে `DATABASE_URL` সরান; `deploy-setup.ts` Hostinger-এ চলে।
8. **deploy-setup.ts** — Hostinger-এ ডেটাবেস খালি হলে `import-research → seed → allocate-level2 --floor 10 --write → verify-data` এখানেই চালান (একই সার্ভারে, কয়েক সেকেন্ড); অসম্পূর্ণ থাকলে আবার চালান (idempotent)।
9. **অ্যাডমিন** — সারসংক্ষেপে ডেটাবেসের আকার (`information_schema.tables`) ও ২.৫ GB পেরোলে সতর্কতা; RateHit/মেয়াদোত্তীর্ণ Session নিয়মিত মোছা।
10. **পরীক্ষা** — `npm test` (২১২), `test-load.ts`, `npm run build`, compiler-ছাড়া `next start` + `test-http.ts`।
11. **নির্দেশিকা** — `docs/DEPLOY_HOSTINGER.md`: hPanel → Databases → MariaDB ডেটাবেস+ব্যবহারকারী → `DATABASE_URL="mysql://USER:PASS@localhost:3306/DBNAME"` (host hPanel-এ যা দেখায়)। Neon অংশ, `.env.neon`, `neon.ts`, `@neon/*` প্যাকেজ সরান; `.env.hostinger` হালনাগাদ; GitHub secret শুধু `APP_URL`।

## ৩ GB হিসাব
প্রশ্ন (৫,৩৫২ + ১০,৪০০) ≈ ৩০–৫০ MB; পূর্ণ কোর্স শেষ করা শিক্ষার্থী ≈ ৮–১২ MB (AttemptAnswer-সারি); সাধারণ ১–৩ MB → ~১,০০০–২,০০০ সক্রিয় শিক্ষার্থী।
