# ৫২তম বিসিএস প্রিলিমিনারি — গবেষণাভিত্তিক Level-based প্রস্তুতি প্ল্যাটফর্ম

নকশা ও নিয়ম: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## প্রথমবার চালানো (Windows/macOS/Linux, Node 20+)

```bash
npm install
npm run db            # আলাদা টার্মিনালে: স্থানীয় PostgreSQL (পোর্ট ৫৪৫২), চালু রাখুন
npx prisma migrate deploy
npm run db:import     # গবেষণার ৫,৩৫২ প্রশ্ন, Priority List, পুনরাবৃত্তি-পরিবার
npm run db:seed       # Level, নিয়ম, Roadmap-এর কাজ
npm run db:allocate   # Level 2-এর অনুমোদিত প্রশ্ন-লক্ষ্য (১০,৪০০, উপবিষয়ভিত্তিক)
npm run db:verify     # উৎস-ফাইলের সঙ্গে স্বাধীন মিলিয়ে দেখা
npm run dev           # http://localhost:3000
```

`db:import` ও `db:seed` বারবার চালানো নিরাপদ — শিক্ষার্থীর অগ্রগতি বা অ্যাডমিনের বদলানো নিয়ম মোছে না।

## ফোল্ডার

- `prisma/schema.prisma` — ডেটাবেস স্কিমা
- `data/source/` — গবেষণার উৎস-ডেটা (ধাপ ০৪ TSV, চূড়ান্ত প্রশ্ন-JSON)
- `scripts/` — স্থানীয় ডেটাবেস, Import, Seed, যাচাই
- `src/lib/rules/defaults.ts` — সব Threshold ও নিয়মের প্রাথমিক মান
