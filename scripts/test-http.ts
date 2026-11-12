/**
 * HTTP-স্তরের পরীক্ষা — চালু অ্যাপের বিরুদ্ধে (npm run dev বা npm start, ডিফল্ট http://localhost:3000)।
 * আসল কুকি দিয়ে: অপরিচিত, শিক্ষার্থী, মেয়াদোত্তীর্ণ সেশন — কে কী দেখতে পায়।
 *   npx tsx scripts/test-http.ts [base-url]
 */
import { startAtLevel1 } from "./_journey";
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
    await startAtLevel1(db, stu.id);
    const ck = await session(stu.id);
    const dash = await get("/dashboard", ck);
    check("শিক্ষার্থী নিজের Dashboard দেখে", dash.status === 200 && dash.body.includes("এইচটিটিপি পরীক্ষার্থী"));
    const locked = await get("/level-1/11", ck);
    check("তালাবন্ধ ধাপে শুধু বার্তা, কোনো প্রশ্ন নয়", locked.body.includes("Unlock করতে আগের ধাপের") && !locked.body.includes("ভাগ ১ শুরু করুন"));
    const adm = await get("/admin", ck);
    check("শিক্ষার্থী অ্যাডমিন অংশে কিছু পায় না", !adm.body.includes("যাচাইয়ের অপেক্ষায়") && !adm.body.includes("অ্যাডমিন প্যানেল</p>"));
    const exp = await get("/admin/export/backup.json", ck);
    check("শিক্ষার্থী Backup ডাউনলোড পায় না (৪০৪)", exp.status === 404);

    // লগইন থাকলে "অ্যাকাউন্ট খুলুন"/"লগইন করুন" কোথাও নয়
    const homeIn = await get("/", ck);
    check("লগইন থাকলে হোমপেজে অ্যাকাউন্ট খোলা/লগইনের লিংক নেই", homeIn.status === 200 && !homeIn.body.includes(`href="/register"`) && !homeIn.body.includes(`href="/login"`) && homeIn.body.includes("Dashboard-এ যান"));
    const homeOut = await get("/");
    check("লগইন ছাড়া হোমপেজে অ্যাকাউন্ট খোলার লিংক আছে", homeOut.body.includes(`href="/register"`) && !homeOut.body.includes("Dashboard-এ যান"));
    for (const p of ["/login", "/register"]) {
      const r = await get(p, ck);
      const toDash = r.location.includes("/dashboard") || /__next-page-redirect[^>]*\/dashboard|NEXT_REDIRECT;[^;]*;\/dashboard/.test(r.body);
      check(`লগইন থাকলে ${p} → Dashboard-এ, ফর্ম নেই`, toDash && !r.body.includes(`name="password"`) && !r.body.includes("লগইন করুন</h1>") && !r.body.includes("প্রস্তুতি শুরু করুন</h1>"), { s: r.status, l: r.location });
    }

    // ইমেইল যাচাই বাকি থাকলে কোনো শিক্ষার্থী-পাতা নয়
    const pend = await db.user.create({ data: { email: `${Date.now()}-pending@http.test`, passwordHash: "x", emailVerifiedAt: null, profile: { create: { name: "যাচাই-বাকি" } } } });
    try {
      const pk = await session(pend.id);
      const pd = await get("/dashboard", pk);
      check("যাচাই-বাকি অ্যাকাউন্ট Dashboard-এ নয়, যাচাই-পাতায়", (pd.status === 307 || pd.status === 302) ? pd.location.includes("/verify-email") : !pd.body.includes("যাচাই-বাকি") || /verify-email/.test(pd.body), { s: pd.status, l: pd.location });
      const pv = await get("/verify-email", pk);
      check("যাচাই-পাতায় কোডের ঘর", pv.status === 200 && pv.body.includes(`name="code"`));
    } finally {
      await db.user.delete({ where: { id: pend.id } });
    }

    // নতুন নিবন্ধন: অ্যাকাউন্ট ছাড়াই (শুধু নিবন্ধনের কুকি) যাচাই-পাতা খোলে; কোনো শিক্ষার্থী-পাতা নয়
    const st = randomBytes(32).toString("base64url");
    const sEmail = `${tag}-signup@http.test`;
    await db.pendingSignup.create({ data: { id: hash(st), email: sEmail, name: "নিবন্ধন", passwordHash: "x", codeHash: "x", expiresAt: new Date(Date.now() + 9e5) } });
    try {
      const sv = await fetch(BASE + "/verify-email", { redirect: "manual", headers: { cookie: `bcs_signup=${st}` } });
      const svb = sv.status === 200 ? await sv.text() : "";
      check("নিবন্ধনের কুকিতে যাচাই-পাতা খোলে, অ্যাকাউন্ট তখনো নেই", sv.status === 200 && svb.includes(`name="code"`) && svb.includes("কোড মিললে তবেই") && (await db.user.count({ where: { email: sEmail } })) === 0, sv.status);
      const sd = await fetch(BASE + "/dashboard", { redirect: "manual", headers: { cookie: `bcs_signup=${st}` } });
      check("নিবন্ধনের কুকিতে Dashboard নয় (লগইনে)", (sd.status === 307 || sd.status === 302) && (sd.headers.get("location") ?? "").includes("/login"), sd.status);
    } finally {
      await db.pendingSignup.deleteMany({ where: { email: sEmail } });
    }

    // অন্যের পরীক্ষা
    const { startStep } = await import("../src/lib/exam/service");
    await startAtLevel1(db, other.id);
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
    check("জাল সেশন-টোকেনে কিছু নেই", !fake.body.includes("আজ আপনার করণীয়"));

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
