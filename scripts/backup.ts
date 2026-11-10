/**
 * পূর্ণ Backup ফাইলে লেখা:  npm run backup   → backups/bcs52-<সময়>.json
 * (backups/ ফোল্ডার git-এ যায় না।) নিয়মিত চালাতে Windows Task Scheduler বা cron ব্যবহার করুন।
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fullBackup } from "../src/lib/admin/export";

const db = new PrismaClient();
(async () => {
  const dir = path.resolve(__dirname, "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `bcs52-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const body = await fullBackup(db);
  writeFileSync(file, body);
  console.log(`Backup: ${file} (${(body.length / 1024 / 1024).toFixed(1)} MB)`);
  await db.$disconnect();
})();
