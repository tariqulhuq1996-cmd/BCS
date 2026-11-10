/**
 * Deploy-এর সময় ডেটাবেস প্রস্তুত করা — `npm run build`-এর শুরুতে নিজে থেকে চলে (Hostinger-এ আলাদা কিছু চালাতে হয় না)।
 *   ১. টেবিল তৈরি/হালনাগাদ (prisma migrate deploy) — প্রতিবার; শুধু নতুন migration প্রয়োগ হয়
 *   ২. ডেটাবেস খালি হলে (প্রথম Deploy): গবেষণার প্রশ্ন → Level, নিয়ম, ধাপ → Level ২-এর অনুমোদিত লক্ষ্য → উৎসের সঙ্গে মিল যাচাই
 *      পরের Deploy-গুলোতে: শুধু seed (নতুন নিয়ম/ধাপ যোগ হয়; অ্যাডমিনের বদলানো মান ও শিক্ষার্থীর অগ্রগতি অক্ষত)
 *   ৩. ADMIN_EMAIL ও ADMIN_PASSWORD দেওয়া থাকলে এবং কোনো অ্যাডমিন না থাকলে প্রথম অ্যাডমিন তৈরি
 * স্থানীয় ডেভেলপমেন্ট ডেটাবেসে (npm run db) কিছু করে না — সেখানে prisma migrate dev ব্যবহার হয়।
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "";
const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: process.env });

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
  run("npx prisma migrate deploy");

  const db = new PrismaClient();
  try {
    const subjects = await db.subject.count();
    if (subjects === 0) {
      console.log("[deploy-setup] প্রথম Deploy: গবেষণার ডেটা বসানো হচ্ছে (কয়েক মিনিট লাগতে পারে)…");
      run("npx tsx scripts/import-research.ts");
      run("npx tsx scripts/seed.ts");
      run("npx tsx scripts/allocate-level2.ts --floor 10 --write");
      run("npx tsx scripts/verify-data.ts");
    } else {
      console.log("[deploy-setup] ডেটা আগে থেকেই আছে — শুধু নতুন নিয়ম/ধাপ যোগ (seed)।");
      run("npx tsx scripts/seed.ts");
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins > 0) {
      if (password) console.log("[deploy-setup] অ্যাডমিন আগে থেকেই আছে। নিরাপত্তার জন্য Hostinger থেকে ADMIN_PASSWORD মুছে দিন।");
    } else if (email && password.length >= 10) {
      await db.user.upsert({
        where: { email },
        update: { role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
        create: { email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12), profile: { create: { name: "অ্যাডমিন" } } },
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
