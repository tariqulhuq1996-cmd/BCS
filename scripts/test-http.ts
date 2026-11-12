/**
 * HTTP-স্তরের পরীক্ষা — চালু অ্যাপের বিরুদ্ধে (npm run dev বা npm start, ডিফল্ট http://localhost:3000)।
 * আসল কুকি দিয়ে: অপরিচিত, শিক্ষার্থী, মেয়াদোত্তীর্ণ সেশন — কে কী দেখতে পায়।
 *   npx tsx scripts/test-http.ts [base-url]
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

async function get(path: string, cookie?: string) {
  const r = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie: `bcs_session=${cookie}` } : {} });
  return { status: r.status, location: r.headers.get("location") ?? "", headers: r.headers, body: r.status < 300 ? await r.text() : "" };
}
async function session(userId: string, expired = false) {
  const t = randomBytes(32).toString("base64url");
  await db.session.create({ data: { id: hash(t), userId, expiresAt: new Date(Date.now() + (expired ? -1 : 1) * 3600e3) } });
  return t;
}

async function main() {
  try { await fetch(BASE, { method: "HEAD" }); } catch { console.log(`SKIP  ${BASE} চালু নেই`); return; }
  const tag = `http${Date.now()}`;
  const stu = await db.user.create({ data: { email: `${tag}-s@http.test`, passwordHash: "x", profile: { create: { name: "এইচটিটিপি পরীক্ষার্থী" } } } });
  const other = await db.user.create({ data: { email: `${tag}-o@http.test`, passwordHash: "x" } });
  try {
    // ── অপরিচিত
    for (const p of ["/", "/login", "/register"]) {
      const r = await get(p);
      check(`সবার জন্য খোলা: ${p}`, r.status === 200, r.status);
    }
    for (const p of ["/dashboard", "/level-1/10", "/test/x", "/result/x", "/admin", "/revision", "/profile", "/current-affairs", "/research", "/repeated-questions"]) {
      const r = await get(p);
      check(`লগইন ছাড়া ${p} → লগইন পাতায়`, (r.status === 307 || r.status === 302) && r.location.includes("/login"), { s: r.status, l: r.location });
    }
    const home = await get("/");
    check("নিরাপত্তা-হেডার আছে", home.headers.get("x-frame-options") === "DENY" && home.headers.get("x-content-type-options") === "nosniff" && !!home.headers.get("referrer-policy"));
    const csp = home.headers.get("content-security-policy") ?? "";
    check("CSP: শুধু নিজের সাইট, ফ্রেম নিষেধ, plugin নিষেধ", /default-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && !/https?:\/\//.test(csp), csp);
    check("সার্ভারের পরিচয়-হেডার (X-Powered-By) নেই", !home.headers.get("x-powered-by"));
    const health = await fetch(BASE + "/api/health");
    const hj = await health.json().catch(() => ({}));
    check("/api/health: অ্যাপ ও ডেটাবেস চালু", health.status === 200 && hj.ok === true && hj.db === "ok", hj);
    const robots = await (await fetch(BASE + "/robots.txt")).text();
    check("robots.txt: অ্যাডমিন ও শিক্ষার্থী-অংশ সার্চ ইঞ্জিনে নয়", /Disallow: \/admin/.test(robots) && /Disallow: \/dashboard/.test(robots) && /Sitemap:/.test(robots));
    const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
    check("sitemap.xml-এ শুধু জনসাধারণের পাতা", sitemap.includes("/register") && !sitemap.includes("/research") && !sitemap.includes("/admin") && !sitemap.includes("/dashboard"));

    // ── শিক্ষার্থী
    const { ensureStarted } = await import("../src/lib/progress/engine");
    await ensureStarted(db, stu.id);
    const ck = await session(stu.id);
    const dash = await get("/dashboard", ck);
    check("শিক্ষার্থী নিজের Dashboard দেখে", dash.status === 200 && dash.body.includes("এইচটিটিপি পরীক্ষার্থী"));
    const locked = await get("/level-1/11", ck);
    check("তালাবন্ধ ধাপে শুধু বার্তা, কোনো প্রশ্ন নয়", locked.body.includes("Unlock করতে আগের ধাপের") && !locked.body.includes("ভাগ ১ শুরু করো"));
    const adm = await get("/admin", ck);
    check("শিক্ষার্থী অ্যাডমিন অংশে কিছু পায় না", !adm.body.includes("যাচাইয়ের অপেক্ষায়") && !adm.body.includes("অ্যাডমিন প্যানেল</p>"));
    const exp = await get("/admin/export/backup.json", ck);
    check("শিক্ষার্থী Backup ডাউনলোড পায় না (৪০৪)", exp.status === 404);

    // অন্যের পরীক্ষা
    const { startStep } = await import("../src/lib/exam/service");
    await ensureStarted(db, other.id);
    const oa = await startStep(db, other.id, "L1:EXAM:10");
    const oq = (await db.testAttempt.findUniqueOrThrow({ where: { id: oa } })).questionIds[0];
    const qText = (await db.question.findUniqueOrThrow({ where: { id: oq } })).text;
    const peek = await get(`/test/${oa}`, ck);
    check("অন্যের চলমান পরীক্ষার প্রশ্ন দেখা যায় না", !peek.body.includes(qText) && peek.body.includes("এই পাতাটি নেই"));
    const peekRes = await get(`/result/${oa}`, ck);
    check("অন্যের ফলাফল দেখা যায় না", !peekRes.body.includes(qText));
    const own = await get(`/test/${oa}`, await session(other.id));
    check("মালিক নিজের পরীক্ষা দেখে, কিন্তু HTML-এ সঠিক উত্তরের সূচক নেই", own.body.includes(qText) && !own.body.includes("correctIndex"));

    // ── মেয়াদোত্তীর্ণ সেশন
    const ex = await session(stu.id, true);
    const d2 = await get("/dashboard", ex);
    check("মেয়াদোত্তীর্ণ সেশনে Dashboard-এর তথ্য নেই", !d2.body.includes("এইচটিটিপি পরীক্ষার্থী"));
    const fake = await get("/dashboard", "not-a-real-token");
    check("জাল সেশন-টোকেনে কিছু নেই", !fake.body.includes("আজ তোমার করণীয়"));

    // ── বন্ধ অ্যাকাউন্ট
    await db.user.update({ where: { id: stu.id }, data: { disabled: true } });
    const d3 = await get("/dashboard", ck);
    check("বন্ধ অ্যাকাউন্টে আগের সেশন কাজ করে না", !d3.body.includes("এইচটিটিপি পরীক্ষার্থী"));
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
