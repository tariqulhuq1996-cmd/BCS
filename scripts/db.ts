/**
 * স্থানীয় ডেভেলপমেন্ট ডেটাবেস — MariaDB 11.8 (Hostinger Business-এর মতো একই সংস্করণ)।
 * বাইনারি: .mariadb/mariadb-11.8.9-winx64 (mariadb.org-এর অফিসিয়াল zip, git-এ নয়)। ডেটা: .mariadb/data
 * ব্যবহার:  npm run db        → চালু করে, Ctrl+C পর্যন্ত চলবে
 * প্রথমবার নিজে থেকে ডেটা-ফোল্ডার, ডেটাবেস `bcs52` ও ব্যবহারকারী `bcs` তৈরি করে।
 * প্রোডাকশনে এটি লাগে না; সেখানে Hostinger-এর MariaDB-র DATABASE_URL।
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", ".mariadb");
const PORT = 3307;
const home = existsSync(root) ? readdirSync(root).find((d) => /^mariadb-11\.8\.\d+-winx64$/.test(d)) : undefined;
if (!home) {
  console.error(
    "MariaDB পাওয়া যায়নি। https://archive.mariadb.org/mariadb-11.8.9/winx64-packages/mariadb-11.8.9-winx64.zip নামিয়ে .mariadb/ ফোল্ডারে খুলুন।",
  );
  process.exit(1);
}
const bin = (exe: string) => path.join(root, home, "bin", exe);
const dataDir = path.join(root, "data");
const fresh = !existsSync(path.join(dataDir, "mysql"));

if (fresh) {
  execFileSync(bin("mariadb-install-db.exe"), [`--datadir=${dataDir}`, `--port=${PORT}`, "--default-user"], { stdio: "inherit" });
}

const server = spawn(
  bin("mariadbd.exe"),
  [`--datadir=${dataDir}`, `--port=${PORT}`, "--bind-address=127.0.0.1", "--character-set-server=utf8mb4", "--console", "--log-warnings=1"],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let log = "";
server.stderr.on("data", (d) => (log += String(d)));

function sql(statement: string) {
  return execFileSync(bin("mariadb.exe"), ["-uroot", "-h127.0.0.1", `-P${PORT}`, "-e", statement], { encoding: "utf8" });
}

async function main() {
  for (let i = 0; ; i++) {
    try {
      sql("select 1");
      break;
    } catch {
      if (i > 60 || server.exitCode !== null) throw new Error("MariaDB চালু হয়নি:\n" + log.slice(-2000));
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  // প্রতিবার নিশ্চিত করা (নিরাপদে বারবার চালানো যায়)। Prisma migrate dev-এর shadow database-এর জন্য ব্যবহারকারীকে সব ডেটাবেসে অধিকার।
  sql(
    "CREATE DATABASE IF NOT EXISTS bcs52 CHARACTER SET utf8mb4; " +
      "CREATE USER IF NOT EXISTS 'bcs'@'localhost' IDENTIFIED BY 'bcs_local_dev'; CREATE USER IF NOT EXISTS 'bcs'@'127.0.0.1' IDENTIFIED BY 'bcs_local_dev'; " +
      "GRANT ALL PRIVILEGES ON *.* TO 'bcs'@'localhost'; GRANT ALL PRIVILEGES ON *.* TO 'bcs'@'127.0.0.1'; FLUSH PRIVILEGES;",
  );
  console.log(`MariaDB চালু: mysql://bcs:***@127.0.0.1:${PORT}/bcs52  (বন্ধ করতে Ctrl+C)`);
  const stop = () => {
    try {
      execFileSync(bin("mariadb-admin.exe"), ["-uroot", "-h127.0.0.1", `-P${PORT}`, "shutdown"]);
    } catch {
      server.kill();
    }
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", (code) => {
    console.error(`MariaDB বন্ধ হয়ে গেছে (code ${code})`);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  server.kill();
  process.exit(1);
});
