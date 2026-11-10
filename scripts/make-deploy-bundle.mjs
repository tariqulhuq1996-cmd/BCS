/**
 * GitHub Actions-এ বিল্ডের পরে Hostinger-এর জন্য "deploy" শাখার ফাইল তৈরি।
 * Hostinger-এর সার্ভারের Linux পুরোনো (GLIBC < 2.29), তাই সেখানে Next.js 16-এর compiler চলে না;
 * বিল্ড হয় GitHub-এ, Hostinger শুধু তৈরি অ্যাপ চালায় (চালাতে compiler লাগে না — যাচাই করা)।
 *   node scripts/make-deploy-bundle.mjs <out-dir>
 */
import { cpSync, existsSync, mkdirSync, lstatSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "../deploy-out");
const root = process.cwd();
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execSync(`git -C "${root}" archive HEAD | tar -x`, { cwd: out, stdio: "inherit", shell: process.platform === "win32" ? "bash" : "/bin/sh" });

// .next — cache/dev/trace বাদে; node_modules-এর symlink আলাদাভাবে
const skip = new Set(["cache", "dev", "trace", "trace-build", "diagnostics", "types", "node_modules"]);
cpSync(path.join(root, ".next"), path.join(out, ".next"), {
  recursive: true,
  filter: (src) => !skip.has(path.relative(path.join(root, ".next"), src).split(path.sep)[0]),
});

// .next/node_modules: Turbopack-এর বাইরের প্যাকেজের symlink — আপেক্ষিক পথে নতুন করে
// (বিল্ড-মেশিনের পূর্ণ পথ Hostinger-এ থাকে না)
function copyLinks(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (lstatSync(s).isSymbolicLink()) {
      const target = readlinkSync(s);
      const abs = path.isAbsolute(target) ? target : path.resolve(path.dirname(s), target);
      const rel = path.relative(path.dirname(s), abs); // .next/node_modules/... থেকে ../../node_modules/...
      symlinkSync(rel, d, "dir");
    } else copyLinks(s, d);
  }
}
copyLinks(path.join(root, ".next", "node_modules"), path.join(out, ".next", "node_modules"));

// Hostinger "npm run build" চালালে শুধু Prisma ও ডেটাবেস-প্রস্তুতি (compile নয়)
const pkgPath = path.join(out, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.scripts.build = "prisma generate && tsx scripts/deploy-setup.ts";
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// এই শাখায় .next রাখতে হবে
const gi = readFileSync(path.join(out, ".gitignore"), "utf8").replace(/^\/\.next\/\s*$/m, "");
writeFileSync(path.join(out, ".gitignore"), gi);
console.log("deploy bundle:", out);
