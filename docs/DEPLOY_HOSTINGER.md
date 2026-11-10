# Hostinger (Business/Cloud) + Neon — ধাপে ধাপে

অ্যাপ চলবে Hostinger-এর **Node.js Web App** হিসেবে (GitHub থেকে)। ডেটাবেস **Neon**-এ (PostgreSQL; Hostinger-এর shared/cloud প্ল্যানে PostgreSQL নেই)।
ক্রম গুরুত্বপূর্ণ: **আগে ডেটাবেস তৈরি ও ডেটা বসানো, তারপর Hostinger-এ Deploy** — কারণ বিল্ডের সময়ই অ্যাপ ডেটাবেস থেকে গবেষণার পাতাগুলো তৈরি করে।

## ১. GitHub
1. github.com → New repository → **Private**, README/.gitignore কিছু যোগ না করে খালি।
2. কম্পিউটারে `platform` ফোল্ডারে:
   ```bash
   git remote add origin https://github.com/<নাম>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
   `.env` ও স্থানীয় ডেটাবেস GitHub-এ যায় না (`.gitignore`-এ বাদ দেওয়া)।

## ২. Neon ডেটাবেস
1. neon.tech-এ অ্যাকাউন্ট → New Project → Region **AWS Asia Pacific (Singapore)** → PostgreSQL ১৬ বা নতুন।
2. Dashboard → **Connect** থেকে দুটি ঠিকানা কপি করুন:
   - **Pooled** (হোস্টে `-pooler` আছে) → এটি হবে `DATABASE_URL`; শেষে `&pgbouncer=true` যোগ করুন।
   - **Direct** ("Connection pooling" বন্ধ করে) → এটি `DIRECT_URL`।
3. নিজের কম্পিউটার থেকে একবার ডেটা বসান (`platform` ফোল্ডারে, PowerShell):
   ```powershell
   $env:DATABASE_URL="<Neon pooled ঠিকানা>"; $env:DIRECT_URL="<Neon direct ঠিকানা>"; npm run setup:prod
   ```
   এতে: টেবিল → গবেষণার ৫,৩৫২ প্রশ্ন → Level, নিয়ম, ৪৬৭ ধাপ → Level ২-এর লক্ষ্য → যাচাই। শেষে "ব্যর্থ: কিছু নয়" দেখা উচিত।
4. অ্যাডমিন অ্যাকাউন্ট (একই PowerShell জানালায়):
   ```powershell
   npx tsx scripts/create-admin.ts <আপনার-ইমেইল> '<শক্ত পাসওয়ার্ড>'
   ```
5. Neon-এ Backup: ফ্রি প্ল্যানে সীমিত পুনরুদ্ধার-সময় থাকে; নিয়মিত `npm run backup` (বা অ্যাডমিন → Backup ডাউনলোড) নিজের কাছে রাখুন।

## ৩. ইমেইল (পাসওয়ার্ড রিসেট)
hPanel → Emails → ডোমেইনে একটি মেইলবক্স (যেমন `no-reply@<ডোমেইন>`)। Hostinger-এর SMTP সাধারণত `smtp.hostinger.com`, পোর্ট `465` — hPanel-এর "Connect apps & devices" পাতায় মিলিয়ে নিন।

## ৪. Hostinger-এ Node.js অ্যাপ
hPanel → Websites → **Add website → Node.js Apps** → **Import Git repository** → GitHub যুক্ত করে repo বাছুন।

| সেটিং | মান |
|---|---|
| Framework | Next.js |
| Branch | `main` |
| Node.js version | ২২ (না থাকলে ২০) |
| Root directory | repo-র মূল (যেখানে `package.json`) |
| Build command | `npm run build` |
| Start | Hostinger নিজে `next start` চালায়; আলাদা দিতে হলে `npm run start` |

**Environment variables** (এখানেই বসান, ফাইলে নয়):

| নাম | মান |
|---|---|
| `DATABASE_URL` | Neon pooled ঠিকানা (`&pgbouncer=true` সহ) |
| `DIRECT_URL` | Neon direct ঠিকানা |
| `APP_URL` | `https://<আপনার ডোমেইন>` (শেষে `/` ছাড়া) |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.hostinger.com` / `465` |
| `SMTP_USER` / `SMTP_PASS` | মেইলবক্সের ঠিকানা / পাসওয়ার্ড |
| `MAIL_FROM` | `বিসিএস ৫২ প্রস্তুতি <no-reply@<ডোমেইন>>` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `4` |

Deploy চাপুন। বিল্ড শেষে ডোমেইন যুক্ত করুন ও SSL চালু করুন। পরে কোনো ভেরিয়েবল বদলালে **Redeploy** করতে হয়।

## ৫. চালুর পর যাচাই
- `https://<ডোমেইন>/api/health` → `{"ok":true,"db":"ok",…}`
- হোমপেজ, গবেষণা-পাতা, নিবন্ধন, লগইন ঠিক আছে
- "পাসওয়ার্ড ভুলে গেছি" দিয়ে নিজের ঠিকানায় ইমেইল আসে (স্প্যামে নয়)
- অ্যাডমিন অ্যাকাউন্টে লগইন করে অ্যাডমিন প্যানেল খোলে
- UptimeRobot-এ `/api/health` পর্যবেক্ষণ

## পরে কোড হালনাগাদ
`git push` → Hostinger স্বয়ংক্রিয়/হাতে Redeploy। ডেটাবেসের গঠন বদলালে আগে নিজের কম্পিউটার থেকে:
```powershell
$env:DATABASE_URL="<pooled>"; $env:DIRECT_URL="<direct>"; npx prisma migrate deploy
```

## সমস্যা হলে
- **বিল্ড ব্যর্থ, ডেটাবেসের ত্রুটি** → ধাপ ২.৩ (`setup:prod`) আগে হয়েছে কিনা, `DATABASE_URL` ঠিক কিনা।
- **সাইট চালু হয় না, লগে "APP_URL নেই"** → Environment variables-এ `APP_URL` দিন, Redeploy।
- **রিসেট-ইমেইল আসে না** → SMTP মান; Hostinger-এর ইমেইল লগ; প্রেরকের SPF/DKIM (Hostinger ডোমেইনে সাধারণত নিজে থেকে থাকে)।
- **বড় প্রশ্ন-ফাইল Import হয় না** → ৪ MB-এর ছোট ভাগে ভাগ করুন, অথবা নিজের কম্পিউটার থেকে `npx tsx scripts/import-questions.ts` (উপরের মতো `$env:DATABASE_URL` দিয়ে)।
