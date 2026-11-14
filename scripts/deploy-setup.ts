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
// --soft: ডেটাবেসে পৌঁছানো না গেলে ব্যর্থ না হয়ে সতর্কতা দিয়ে থামে (বিল্ড চলতে থাকে; অ্যাপ চালুর সময় আবার চেষ্টা হয়)
const soft = process.argv.includes("--soft");
const when = process.argv.includes("--on-start") ? "অ্যাপ চালুর সময়" : "বিল্ডের সময়";
const EXPECTED_HISTORICAL = 5352;

/** ডেটাবেসে সংযোগ পরীক্ষা; না হলে কারণসহ বাংলা বার্তা */
async function canConnect(): Promise<boolean> {
  const probe = new PrismaClient();
  try {
    await probe.$queryRaw`select 1`;
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      (e as { errorCode?: string }).errorCode ||
      (/Authentication failed|credentials .* not valid|Access denied/i.test(msg) ? "P1000"
        : /Can't reach|make sure your database server is running|ECONNREFUSED|timed out/i.test(msg) ? "P1001"
        : /does not exist|Unknown database/i.test(msg) ? "P1003"
        : "");
    const host = (() => {
      try {
        const u = new URL(url);
        return `${u.hostname}:${u.port || 3306}, ডেটাবেস ${u.pathname.slice(1)}, ব্যবহারকারী ${decodeURIComponent(u.username)}`;
      } catch {
        return "DATABASE_URL পড়া যায়নি";
      }
    })();
    const why =
      code === "P1000"
        ? "ব্যবহারকারীর নাম বা পাসওয়ার্ড মেলেনি। hPanel → Databases-এ ব্যবহারকারী ও পাসওয়ার্ড মিলিয়ে দেখুন (উপসর্গসহ পুরো নাম, যেমন u123456789_…); পাসওয়ার্ডে @ : / # ? থাকলে URL-encode করুন বা এসব চিহ্ন ছাড়া নতুন পাসওয়ার্ড দিন; ব্যবহারকারী ডেটাবেসের সঙ্গে যুক্ত আছে কিনা দেখুন।"
        : code === "P1001"
          ? "ডেটাবেস-সার্ভারে পৌঁছানো যায়নি (host/port ভুল, বা এই পরিবেশ থেকে ডেটাবেস দেখা যায় না)।"
          : code === "P1003"
            ? "এই নামের ডেটাবেস নেই — নামটি উপসর্গসহ মিলিয়ে দেখুন।"
            : (e instanceof Error ? e.message.split(/\r?\n/).filter(Boolean).slice(-1)[0] : String(e));
    console.warn(`[deploy-setup] ${when} ডেটাবেসে সংযোগ হয়নি (${code || "অজানা"}; ${host}) — ${why}`);
    return false;
  } finally {
    await probe.$disconnect().catch(() => {});
  }
}
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

  if (!(await canConnect())) {
    if (soft) {
      console.warn(`[deploy-setup] ডেটাবেস-প্রস্তুতি বাদ রেখে এগোনো হচ্ছে — অ্যাপ চালুর সময় আবার চেষ্টা হবে। (বিল্ড এতে আটকায় না)`);
      return;
    }
    process.exit(1);
  }

  console.log(`[deploy-setup] ${when}: টেবিল তৈরি/হালনাগাদ…`);
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

    // Level 2-এর তৈরি প্রশ্নব্যাংক (data/source/level2/*.json) — যেগুলো নেই শুধু সেগুলো বসে
    run("npx tsx scripts/import-level2-bank.ts");

    // পুরোনো ডেটায় প্রশ্নের উৎস "…তম বিসিএস প্রিলিমিনারি" — এখন সাইটজুড়ে "BCS Preliminary" (একবারই বদলায়)
    const fixed = await db.$executeRaw`UPDATE Question SET source = REPLACE(source, ${"বিসিএস প্রিলিমিনারি"}, ${"BCS Preliminary"}) WHERE source LIKE ${"%বিসিএস প্রিলিমিনারি%"}`;
    if (fixed) console.log(`[deploy-setup] ${fixed}টি প্রশ্নের উৎস "BCS Preliminary"-তে হালনাগাদ`);

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
      // নিরপেক্ষ নাম (একবারই): নথির মূল নাম থাকলে বদলায়; অ্যাডমিন নিজে নাম দিয়ে থাকলে (nameLocked) হাত দেয় না
      const { renameCaBank } = await import("../src/lib/current-affairs/import");
      const POLITICAL = "bnp-govt-political";
      if (await db.caBank.count({ where: { bankKey: POLITICAL, nameLocked: false } })) {
        await renameCaBank(db, POLITICAL, {
          name: "সরকার ও সমসাময়িক রাজনীতি",
          title: "৫২তম BCS Preliminary — সরকার ও সমসাময়িক রাজনীতি — বিশেষ প্রশ্নব্যাংক (Political Affairs Question Bank)",
        });
        console.log(`[deploy-setup] প্রশ্নব্যাংক "${POLITICAL}"-এর নাম: সরকার ও সমসাময়িক রাজনীতি`);
      }
      // অধ্যায়ের নিরপেক্ষ নাম — শুধু যেগুলো অ্যাডমিন নিজে বদলাননি
      const NEUTRAL: Record<number, string> = { 4: "বর্তমান সরকারের কার্যক্রম", 7: "পূর্ববর্তী শাসনামল", 8: "রাজনৈতিক পরিবার ও নেতৃত্ব", 9: "রাজনৈতিক ইতিহাস ও গুরুত্বপূর্ণ ঘটনা" };
      const open = await db.caChapter.findMany({ where: { bankKey: POLITICAL, nameLocked: false, no: { in: Object.keys(NEUTRAL).map(Number) } }, select: { no: true } });
      if (open.length) {
        const r = await renameCaBank(db, POLITICAL, { chapters: Object.fromEntries(open.map((c) => [c.no, NEUTRAL[c.no]])) });
        console.log(`[deploy-setup] "${POLITICAL}"-এর ${r.chapters}টি অধ্যায়ের নাম নিরপেক্ষ করা হলো`);
      }
    }

    // অ্যাডমিন: ADMIN_EMAIL ও ADMIN_PASSWORD দেওয়া থাকলে সেই অ্যাকাউন্ট ঠিক ওই পাসওয়ার্ডে অ্যাডমিন করা হয় — প্রতিবার
    // (নতুন হলে তৈরি, আগে থাকলে পাসওয়ার্ড হালনাগাদ; বন্ধ থাকলে চালু)। লগইনের পর ADMIN_PASSWORD মুছে দিলে আর বদলায় না।
    // মানের চারপাশের উদ্ধৃতিচিহ্ন বাদ (Hostinger-এ হাতে "…" লিখলে সেটি পাসওয়ার্ডের অংশ হয়ে যেত)।
    const clean = (v?: string) => (v ?? "").trim().replace(/^["'](.*)["']$/, "$1");
    const email = clean(process.env.ADMIN_EMAIL).toLowerCase();
    const password = clean(process.env.ADMIN_PASSWORD);
    const admins = await db.user.count({ where: { role: "ADMIN", disabled: false } });
    if (email && password) {
      if (password.length < 10) {
        console.warn(`[deploy-setup] ADMIN_PASSWORD ${password.length} অক্ষরের — অন্তত ১০ অক্ষর লাগবে। অ্যাডমিন অ্যাকাউন্ট তৈরি/হালনাগাদ হয়নি।`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.warn(`[deploy-setup] ADMIN_EMAIL সঠিক ইমেইল নয়: "${email}"। অ্যাডমিন অ্যাকাউন্ট তৈরি/হালনাগাদ হয়নি।`);
      } else {
        const passwordHash = await bcrypt.hash(password, 12);
        const existed = await db.user.findUnique({ where: { email }, select: { id: true } });
        await db.user.upsert({
          where: { email },
          update: { role: "ADMIN", passwordHash, disabled: false },
          create: { email, role: "ADMIN", passwordHash, profile: { create: { name: "অ্যাডমিন" } } },
        });
        // আগের ভুল চেষ্টার লগইন-সীমা মুছে দেওয়া, যাতে সঙ্গে সঙ্গে লগইন করা যায়
        await db.rateHit.deleteMany({ where: { key: { startsWith: `login:${email}:` } } });
        console.log(
          `[deploy-setup] অ্যাডমিন অ্যাকাউন্ট প্রস্তুত: ${email} (${existed ? "পাসওয়ার্ড হালনাগাদ" : "নতুন তৈরি"}; পাসওয়ার্ড ${password.length} অক্ষর)। লগইনের পর Hostinger থেকে ADMIN_PASSWORD মুছে দিন।`,
        );
      }
    } else if (admins === 0) {
      console.log("[deploy-setup] কোনো অ্যাডমিন নেই। ADMIN_EMAIL ও ADMIN_PASSWORD (১০+ অক্ষর) দিয়ে আবার Deploy করুন।");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[deploy-setup] ব্যর্থ:", e);
  // --soft: বিল্ড/চালু থামানো হয় না; পরের চালুতে আবার চেষ্টা (প্রতিটি ধাপ বারবার চালানো নিরাপদ)
  process.exit(soft ? 0 : 1);
});
