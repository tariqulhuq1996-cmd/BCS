/**
 * স্থানীয় ডেভেলপমেন্ট ডেটাবেস (PostgreSQL ১৮, embedded-postgres প্যাকেজের বাইনারি)।
 * ব্যবহার:  npm run db        → চালু করে, Ctrl+C পর্যন্ত চলবে
 * প্রোডাকশনে এটি লাগবে না; সেখানে হোস্টেড PostgreSQL-এর DATABASE_URL দিন।
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "..", ".pgdata");
const fresh = !existsSync(path.join(dir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "bcs",
  password: "bcs_local_dev",
  port: 5452,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

async function main() {
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("bcs52");
  console.log("PostgreSQL চালু: postgresql://bcs:***@localhost:5452/bcs52  (বন্ধ করতে Ctrl+C)");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
}

main().catch(async (e) => {
  console.error(e);
  try { await pg.stop(); } catch {}
  process.exit(1);
});
