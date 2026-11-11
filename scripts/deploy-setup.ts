/**
 * Hostinger-এ Deploy-এর সময় ডেটাবেস প্রস্তুত করা (`npm run build`-এর শুরুতে)। ডেটাবেস একই সার্ভারের MariaDB, তাই দ্রুত।
 *   ১. টেবিল তৈরি/হালনাগাদ (prisma migrate deploy) — শুধু নতুন migration প্রয়োগ হয়
 *   ২. গবেষণার ডেটা অসম্পূর্ণ হলে (প্রথম Deploy বা মাঝপথে থেমে যাওয়া) বসানো; সম্পূর্ণ থাকলে আর ছোঁয় না
 *      (অ্যাডমিনের সম্পাদিত ব্যাখ্যা ইত্যাদি অক্ষত থাকে)
 *   ৩. seed — নতুন কোডে যোগ হওয়া নিয়ম/ধাপ (শুধু অনুপস্থিতগুলো)
 *   ৪. Current Affairs প্রশ্নব্যাংক না থাকলে বসানো
 *   ৫. ADMIN_EMAIL ও ADMIN_PASSWORD থাকলে এবং কোনো অ্যাডমিন না থাকলে প্রথম অ্যাডমিন
 * স্থানীয় ডেভেলপমেন্ট ডেটাবেসে (npm run db) কিছু করে না।
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "";
const EXPECTED_HISTORICAL = 5352;
const EXPECTED_TASKS = 467;

async function main() {
  if (!url) {
    console.log("[deploy-setup] DATABASE_URL নেই — ডেটাবেস প্রস্তুতি বাদ (শুধু বিল্ড)।");
    return;
  }
  if (/127.0.0.1:3307|localhost:3307|bcs_local_dev/.test(url) && process.env.DEPLOY_SETUP_FORCE !== "1") {
    console.log("[deploy-setup] স্থানীয় ডেভেলপমেন্ট ডেটাবেস — বাদ।");
    return;
  }

  console.log("[deploy-setup] টেবিল তৈরি/হালনাগাদ…");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });

  const db = new PrismaClient();
  try {
    const [historical, tasks] = await Promise.all([
      db.question.count({ where: { kind: "HISTORICAL" } }),
      db.learningTask.count(),
    ]);
    const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: process.env });
    if (historical >= EXPECTED_HISTORICAL && tasks >= EXPECTED_TASKS) {
      console.log(`[deploy-setup] গবেষণার ডেটা সম্পূর্ণ (${historical} প্রশ্ন, ${tasks} ধাপ)। নতুন নিয়ম/ধাপ থাকলে যোগ…`);
      run("npx tsx scripts/seed.ts");
    } else {
      console.log(`[deploy-setup] গবেষণার ডেটা বসানো হচ্ছে (${historical}/${EXPECTED_HISTORICAL} প্রশ্ন আছে)…`);
      run("npx tsx scripts/import-research.ts");
      run("npx tsx scripts/seed.ts");
      run("npx tsx scripts/allocate-level2.ts --floor 10 --write");
      run("npx tsx scripts/verify-data.ts");
    }

    // Current Affairs: data/source/current-affairs/<key>.docx — যে ব্যাংক ডেটাবেসে নেই, সেটি বসানো।
    // পরে নতুন সংস্করণ অ্যাডমিন প্যানেল → Current Affairs থেকে Import করা হয় (এখানে আর বদলায় না)।
    const caDir = path.resolve(__dirname, "..", "data", "source", "current-affairs");
    if (existsSync(caDir)) {
      const { parseCurrentAffairsDocx } = await import("../src/lib/current-affairs/parse");
      const { importCurrentAffairs } = await import("../src/lib/current-affairs/import");
      // সাধারণ Current Affairs আগে (পাতায় প্রথমে দেখায়), তারপর বাকিগুলো নামের ক্রমে
      const files = readdirSync(caDir).filter((f) => f.endsWith(".docx")).sort((a, b) => Number(b === "current-affairs.docx") - Number(a === "current-affairs.docx") || a.localeCompare(b));
      for (const file of files) {
        const bankKey = file.replace(/.docx$/, "");
        if ((await db.caQuestion.count({ where: { bankKey } })) > 0) continue;
        const r = await importCurrentAffairs(db, await parseCurrentAffairsDocx(readFileSync(path.join(caDir, file))), bankKey, "deploy");
        console.log(`[deploy-setup] Current Affairs "${bankKey}" বসানো হলো: ${r.added}টি প্রশ্ন।`);
      }
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins > 0) {
      if (password) console.log("[deploy-setup] অ্যাডমিন আগে থেকেই আছে। নিরাপত্তার জন্য Hostinger থেকে ADMIN_PASSWORD মুছে দিন।");
    } else if (email && password.length >= 10) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.user.upsert({
        where: { email },
        update: { role: "ADMIN", passwordHash },
        create: { email, role: "ADMIN", passwordHash, profile: { create: { name: "অ্যাডমিন" } } },
      });
      console.log(`[deploy-setup] প্রথম অ্যাডমিন তৈরি: ${email}। এখন Hostinger থেকে ADMIN_PASSWORD মুছে দিন।`);
    } else {
      console.log("[deploy-setup] কোনো অ্যাডমিন নেই। ADMIN_EMAIL ও ADMIN_PASSWORD (১০+ অক্ষর) দিয়ে আবার Deploy করুন।");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[deploy-setup] ব্যর্থ:", e);
  process.exit(1);
});
