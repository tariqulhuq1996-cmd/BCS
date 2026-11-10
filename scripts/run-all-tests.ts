/**
 * সব স্বয়ংক্রিয় পরীক্ষা একসঙ্গে:  npm test
 * প্রতিটি পরীক্ষা-সংগ্রহ আলাদা প্রসেসে চলে (একটির অস্থায়ী তথ্য অন্যটিকে প্রভাবিত করে না); শেষে সারসংক্ষেপ।
 * স্থানীয় ডেটাবেস চালু থাকতে হবে (npm run db)।
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const SUITES = [
  ["ডেটা (উৎসের সঙ্গে মিল)", "verify-data.ts"],
  ["ডেটার অখণ্ডতা", "check-integrity.ts"],
  ["Unlock-ইঞ্জিন", "test-progress.ts"],
  ["Level ১", "test-level1.ts"],
  ["Level ২ ও Revision", "test-level2.ts"],
  ["Level ৩", "test-level3.ts"],
  ["অ্যাডমিন", "test-admin.ts"],
  ["নিরাপত্তা ও একযোগে অনুরোধ", "test-security.ts"],
  ["HTTP (চালু অ্যাপ থাকলে)", "test-http.ts"],
];

const root = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const rows: string[] = [];
for (const [name, file] of SUITES) {
  const t0 = Date.now();
  const r = spawnSync(`npx tsx "${path.join("scripts", file)}"`, { cwd: root, encoding: "utf8", shell: true, timeout: 15 * 60e3 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const p = (out.match(/^PASS/gm) ?? []).length;
  const f = (out.match(/^FAIL/gm) ?? []).length + (r.status !== 0 && !/^FAIL/m.test(out) ? 1 : 0);
  pass += p; fail += f;
  rows.push(`${f ? "✗" : "✓"} ${name.padEnd(28)} ${String(p).padStart(3)} পাস  ${f ? `${f} ব্যর্থ` : ""}  (${((Date.now() - t0) / 1000).toFixed(0)} সে.)`);
  if (f) for (const l of out.split("\n").filter((x) => x.startsWith("FAIL") || /error/i.test(x)).slice(0, 8)) rows.push(`    ${l}`);
}
console.log(rows.join("\n"));
console.log(`\nমোট: ${pass} পাস, ${fail} ব্যর্থ`);
process.exitCode = fail ? 1 : 0;
