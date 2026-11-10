# Deployment নির্দেশিকা

প্ল্যাটফর্মটি একটি Next.js অ্যাপ + একটি PostgreSQL ডেটাবেস। যেকোনো জায়গায় চলে যেখানে Node.js ২০+ ও PostgreSQL ১৫+ পাওয়া যায়।
নিচে দুটি পথ; **কোনটি বেছে নেবেন তা আপনার সিদ্ধান্ত** (খরচ, নিয়ন্ত্রণ, কে দেখাশোনা করবে)। দাম সময়ের সঙ্গে বদলায় — অ্যাকাউন্ট খোলার আগে সেবাদাতার বর্তমান মূল্য দেখে নিন।

> **নির্বাচিত পথ: Hostinger (Business/Cloud) + Neon** — ধাপে ধাপে নির্দেশনা: [DEPLOY_HOSTINGER.md](DEPLOY_HOSTINGER.md)

## পথ ক: ব্যবস্থাপিত সেবা (সবচেয়ে কম রক্ষণাবেক্ষণ)

| অংশ | উদাহরণ | মন্তব্য |
|---|---|---|
| অ্যাপ | Vercel | GitHub থেকে স্বয়ংক্রিয় Deploy; Function region **Singapore (sin1)** — বাংলাদেশের সবচেয়ে কাছে |
| ডেটাবেস | Neon বা Supabase (PostgreSQL) | **একই অঞ্চলে (Singapore)**; স্বয়ংক্রিয় Backup চালু রাখুন |
| ইমেইল | Brevo, Amazon SES, Resend, Mailgun ইত্যাদি (SMTP) | প্রেরক-ডোমেইনের SPF/DKIM সেট করুন, নইলে ইমেইল স্প্যামে যাবে |

ধাপ:
1. কোড GitHub-এর একটি **private** repository-তে রাখুন।
2. ডেটাবেস তৈরি করে সংযোগ-ঠিকানা নিন। Vercel-এর মতো serverless-এ সংযোগ-সংখ্যা সীমিত, তাই সেবাদাতার **pooled** ঠিকানা (যেমন Neon-এর `-pooler`) ব্যবহার করুন।
3. Vercel-এ project তৈরি করে Environment Variables বসান (`.env.example` দেখুন): `DATABASE_URL`, `APP_URL`, `SMTP_*`, `MAIL_FROM`।
4. নিজের কম্পিউটার থেকে একবার ডেটাবেস প্রস্তুত করুন (নিচে "প্রথমবার ডেটা")।
5. Deploy → ডোমেইন যুক্ত করুন → `https://<ডোমেইন>/api/health` খুলে `{"ok":true}` দেখুন।

## পথ খ: নিজস্ব সার্ভার (VPS)

যেমন DigitalOcean/AWS Lightsail (Singapore) বা বাংলাদেশের কোনো ডেটা সেন্টারের VPS। Ubuntu 24.04-এ:

```bash
# Node 20+, PostgreSQL, nginx, certbot ইনস্টল করার পর
git clone <repo> /srv/bcs52 && cd /srv/bcs52/platform
cp .env.example .env && nano .env          # DATABASE_URL, APP_URL, SMTP_* বসান
npm ci
BUILD_STANDALONE=1 npm run build            # .next/standalone তৈরি হয়
npm run setup:prod                          # প্রথমবার: টেবিল, গবেষণার ডেটা, Roadmap, নিয়ম, যাচাই
npx tsx scripts/create-admin.ts <ইমেইল> '<শক্ত পাসওয়ার্ড>'
```

চালু রাখা (systemd, `/etc/systemd/system/bcs52.service`):

```ini
[Service]
WorkingDirectory=/srv/bcs52/platform
EnvironmentFile=/srv/bcs52/platform/.env
ExecStartPre=/bin/sh -c 'cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/'
ExecStart=/usr/bin/node .next/standalone/server.js
Environment=PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
```

nginx (HTTPS certbot দিয়ে): `proxy_pass http://127.0.0.1:3000;` এবং অবশ্যই
`proxy_set_header X-Real-IP $remote_addr;` ও `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
(লগইনের চেষ্টা-সীমা ব্যবহারকারীর আসল IP দেখে) এবং `client_max_body_size 30m;` (বড় প্রশ্ন-ফাইল Import)।

দৈনিক Backup (cron, রাত ৩টা):

```bash
0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/bcs52-$(date +\%F).sql.gz && find /var/backups -name 'bcs52-*' -mtime +30 -delete
```

## প্রথমবার ডেটা

```bash
DATABASE_URL="<প্রোডাকশন ডেটাবেস>" DIRECT_URL="<সরাসরি সংযোগ>" npm run setup:prod
```

এটি একবারেই: টেবিল তৈরি (migration) → গবেষণার ৫,৩৫২ প্রশ্ন → Level, নিয়ম ও ৪৬৭টি ধাপ → Level ২-এর অনুমোদিত লক্ষ্য → উৎসের সঙ্গে মিল ও অখণ্ডতা যাচাই।
বারবার চালানো নিরাপদ (শিক্ষার্থীর অগ্রগতি মোছে না)। পরে কোড হালনাগাদ হলে শুধু `npx prisma migrate deploy` ও নতুন বিল্ড।

## চালুর আগের তালিকা

**প্রযুক্তিগত**
- [ ] `APP_URL` সঠিক https ঠিকানা; `/api/health` → `{"ok":true}`
- [ ] পাসওয়ার্ড-রিসেটের একটি পরীক্ষামূলক ইমেইল নিজের ঠিকানায় এসেছে (স্প্যামে নয়)
- [ ] অ্যাডমিন অ্যাকাউন্ট তৈরি; শক্ত পাসওয়ার্ড; ডেভেলপমেন্টের পরীক্ষামূলক অ্যাকাউন্ট প্রোডাকশনে নেই
- [ ] ডেটাবেসের স্বয়ংক্রিয় দৈনিক Backup চালু, একবার পুনরুদ্ধার করে দেখা হয়েছে
- [ ] Uptime-পর্যবেক্ষণ (যেমন UptimeRobot) `/api/health`-এ
- [ ] `npm test` স্থানীয়ভাবে পাস; প্রোডাকশন বিল্ডে `/`, `/register`, `/login` হাতে দেখা

**বিষয়বস্তু (আপনার কাজ)**
- [ ] Level ২-এর প্রশ্নভান্ডার Import → যাচাই → প্রকাশ (অন্তত Priority A দিয়ে শুরু করা যায়; বাকি উপবিষয়ে "প্রশ্ন প্রকাশিত হয়নি" দেখায়)
- [ ] ব্যাখ্যা: খসড়া ১,৫৫৫টি যাচাই; ব্যাখ্যাহীন ৩,৭৫৭টিতে ব্যাখ্যা
- [ ] `docs/DATA_ISSUES.md`-এর ২০টি একই-অপশনের প্রশ্ন মূল প্রশ্নপত্রের সঙ্গে মিলিয়ে ঠিক করা
- [ ] Level ২-এর প্রশ্ন প্রকাশের পর ১৫০টি Model Test তৈরি → দেখা → অনুমোদন
- [ ] গোপনীয়তা নীতি ও ব্যবহারের শর্ত (ইমেইল ও মোবাইল নম্বর সংগ্রহ করা হয়) — লেখা আপনার; পাতা যুক্ত করা আমার কাজ
- [ ] ৫১তম থেকে নতুন মানবণ্টন পিএসসির প্রজ্ঞাপনের সঙ্গে মিলিয়ে নেওয়া (অ্যাডমিন → নিয়ম → `exam.marks_distribution`)

## কে কোন তথ্য দেখে (গোপনীয়তার সারসংক্ষেপ)

- শিক্ষার্থী: শুধু নিজের অগ্রগতি, পরীক্ষা ও ফলাফল।
- অ্যাডমিন: সব শিক্ষার্থীর নাম, ইমেইল, মোবাইল, অগ্রগতি; প্রতিটি অ্যাডমিন-কাজ Audit Log-এ।
- পাসওয়ার্ড bcrypt-হ্যাশ; সেশন ও রিসেট-টোকেন SHA-256-হ্যাশ; পূর্ণ Backup-এ সেশন/টোকেন থাকে না।
