/**
 * Deploy-এর সময় ডেটাবেসের দ্রুত প্রস্তুতি — `npm run build`-এর শুরুতে নিজে থেকে চলে। কয়েক সেকেন্ডের কাজ, তাই বিল্ড আটকায় না।
 *   ১. টেবিল তৈরি/হালনাগাদ (prisma migrate deploy) — শুধু নতুন migration প্রয়োগ হয়
 *   ২. গবেষণার ডেটা সম্পূর্ণ বসানো আছে কিনা পরীক্ষা — না থাকলে লগে স্পষ্ট নির্দেশনা (বিল্ড থামায় না)
 *   ৩. ADMIN_EMAIL ও ADMIN_PASSWORD দেওয়া থাকলে এবং কোনো অ্যাডমিন না থাকলে প্রথম অ্যাডমিন তৈরি
 *
 * গবেষণার ৫,৩৫২ প্রশ্ন বসানো (npm run setup:prod) বিল্ডের ভেতরে হয় না: দূরের ডেটাবেসে কয়েক মিনিট লাগে,
 * আর Hostinger-এর বিল্ড-সময়সীমায় মাঝপথে কেটে যায়। এটি একবার আলাদাভাবে চালানো হয় (docs/DEPLOY_HOSTINGER.md)।
 * স্থানীয় ডেভেলপমেন্ট ডেটাবেসে (npm run db) কিছু করে না।
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
  if (/localhost:5452|bcs_local_dev/.test(url) && process.env.DEPLOY_SETUP_FORCE !== "1") {
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
    if (historical >= EXPECTED_HISTORICAL && tasks >= EXPECTED_TASKS) {
      console.log(`[deploy-setup] গবেষণার ডেটা সম্পূর্ণ (${historical} প্রশ্ন, ${tasks} ধাপ)।`);
    } else {
      console.warn(
        `[deploy-setup] সতর্কতা: গবেষণার ডেটা অসম্পূর্ণ (${historical}/${EXPECTED_HISTORICAL} প্রশ্ন, ${tasks}/${EXPECTED_TASKS} ধাপ)। ` +
          "একবার `npm run setup:prod` চালাতে হবে (docs/DEPLOY_HOSTINGER.md)।",
      );
    }

    // Current Affairs: ডেটাবেসে না থাকলে repo-র প্রশ্নব্যাংক (data/source/current_affairs.docx) বসানো।
    // পরে নতুন সংস্করণ অ্যাডমিন প্যানেল → Current Affairs থেকে Import করা হয় (এখানে আর বদলায় না)।
    const caFile = path.resolve(__dirname, "..", "data", "source", "current_affairs.docx");
    if ((await db.caQuestion.count()) === 0 && existsSync(caFile)) {
      const { parseCurrentAffairsDocx } = await import("../src/lib/current-affairs/parse");
      const { importCurrentAffairs } = await import("../src/lib/current-affairs/import");
      const r = await importCurrentAffairs(db, await parseCurrentAffairsDocx(readFileSync(caFile)), "deploy");
      console.log(`[deploy-setup] Current Affairs প্রশ্নব্যাংক বসানো হলো: ${r.added}টি প্রশ্ন।`);
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
