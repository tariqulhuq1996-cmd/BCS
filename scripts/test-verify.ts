/**
 * ইমেইল যাচাইয়ের (৬ সংখ্যার কোড) স্বয়ংক্রিয় পরীক্ষা: সঠিক কোড, ভুল কোড, ৫ বার ভুলে আটকানো, মেয়াদ শেষ,
 * নতুন কোডে আগেরটি বাতিল, ডেটাবেসে কোড নিজে না থাকা, পুরোনো ও seed-এর অ্যাকাউন্ট যাচাইকৃত থাকা।
 * অস্থায়ী ব্যবহারকারী দিয়ে; শেষে মুছে ফেলা হয়।   npm run test:verify
 */
import { PrismaClient } from "@prisma/client";
import { MAX_ATTEMPTS, checkCode, completeSignup, createCode, newSignupCode, startSignup } from "../src/lib/auth/verify";
import { randomBytes } from "node:crypto";
import { CodeSchema } from "../src/lib/auth/schemas";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const other = (c: string) => String((Number(c) + 1) % 1_000_000).padStart(6, "0");

async function main() {
  const tag = `vt${Date.now()}`;
  const mk = (n: string, verified: boolean) =>
    db.user.create({ data: { email: `${tag}-${n}@verify.test`, passwordHash: "x", ...(verified ? {} : { emailVerifiedAt: null }), profile: { create: { name: n } } } });
  try {
    const seeded = await mk("seeded", true);
    check("সাধারণভাবে তৈরি (seed/অ্যাডমিন) অ্যাকাউন্ট যাচাইকৃত", !!seeded.emailVerifiedAt);
    check("কোনো পুরোনো অ্যাকাউন্ট যাচাই-বাকি নেই (নতুন রেজিস্ট্রেশন ছাড়া)", (await db.user.count({ where: { emailVerifiedAt: null, emailCode: null, email: { not: { endsWith: "@verify.test" } } } })) === 0);

    const u = await mk("u", false);
    check("নতুন অ্যাকাউন্ট যাচাই-বাকি", u.emailVerifiedAt === null);
    check("কোড না চাইলে: none", (await checkCode(db, u.id, "123456")) === "none");
    const c1 = await createCode(db, u.id);
    check("কোড ৬ সংখ্যার", /^\d{6}$/.test(c1), c1);
    const rec = await db.emailCode.findUniqueOrThrow({ where: { userId: u.id } });
    check("ডেটাবেসে কোড নিজে নেই (শুধু হ্যাশ)", rec.codeHash !== c1 && !rec.codeHash.includes(c1) && rec.codeHash.length === 64);
    check("ভুল কোড: wrong", (await checkCode(db, u.id, other(c1))) === "wrong");
    const c2 = await createCode(db, u.id);
    check("নতুন কোডে ভুলের হিসাব শূন্য", (await db.emailCode.findUniqueOrThrow({ where: { userId: u.id } })).attempts === 0);
    if (c1 !== c2) check("নতুন কোড চাইলে আগেরটি অচল", (await checkCode(db, u.id, c1)) === "wrong");
    check("সঠিক কোড: ok", (await checkCode(db, u.id, c2)) === "ok");
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id }, include: { emailCode: true } });
    check("যাচাইয়ের পর অ্যাকাউন্ট যাচাইকৃত ও কোড মুছে গেছে", !!after.emailVerifiedAt && after.emailCode === null);
    check("একই কোড আবার কাজ করে না", (await checkCode(db, u.id, c2)) === "none");

    const l = await mk("locked", false);
    const lc = await createCode(db, l.id);
    const res: string[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) res.push(await checkCode(db, l.id, other(lc)));
    check(`${MAX_ATTEMPTS} বার ভুলে আটকে যায়`, res.at(-1) === "locked" && res.slice(0, -1).every((r) => r === "wrong"), res);
    check("আটকে গেলে সঠিক কোডও চলে না", (await checkCode(db, l.id, lc)) === "locked");
    check("আটকানো অবস্থায় অ্যাকাউন্ট যাচাই-বাকিই থাকে", (await db.user.findUniqueOrThrow({ where: { id: l.id } })).emailVerifiedAt === null);
    const lc2 = await createCode(db, l.id);
    check("নতুন কোড চাইলে আবার যাচাই করা যায়", (await checkCode(db, l.id, lc2)) === "ok");

    const e = await mk("expired", false);
    const ec = await createCode(db, e.id);
    await db.emailCode.update({ where: { userId: e.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("মেয়াদ শেষ হলে: expired", (await checkCode(db, e.id, ec)) === "expired");

    // ── নতুন নিবন্ধন: কোড মিলবার আগে অ্যাকাউন্ট নেই
    const sid = () => randomBytes(32).toString("hex");
    const sEmail = `${tag}-signup@verify.test`;
    const s1 = sid();
    const sc1 = await startSignup(db, s1, { email: sEmail, name: "নতুন শিক্ষার্থী", passwordHash: "h" });
    check("নিবন্ধন জমা দিলেও অ্যাকাউন্ট তৈরি হয় না", (await db.user.count({ where: { email: sEmail } })) === 0 && (await db.pendingSignup.count({ where: { email: sEmail } })) === 1);
    const pend = await db.pendingSignup.findUniqueOrThrow({ where: { id: s1 } });
    check("অপেক্ষমাণ নিবন্ধনে কোড নিজে নেই (শুধু হ্যাশ)", pend.codeHash.length === 64 && !pend.codeHash.includes(sc1));
    check("ভুল কোডে অ্যাকাউন্ট তৈরি হয় না", (await completeSignup(db, s1, other(sc1))).result === "wrong" && (await db.user.count({ where: { email: sEmail } })) === 0);
    // একই ইমেইলে আবার চেষ্টা (অন্য ব্রাউজার/অন্য কেউ) → আগেরটি অচল, ইমেইল আটকে থাকে না
    const s2 = sid();
    const sc2 = await startSignup(db, s2, { email: sEmail, name: "দ্বিতীয় চেষ্টা", passwordHash: "h2" });
    check("একই ইমেইলে নতুন নিবন্ধনে আগেরটি বাতিল", (await completeSignup(db, s1, sc1)).result === "none" && (await db.pendingSignup.count({ where: { email: sEmail } })) === 1);
    const sc2b = await newSignupCode(db, s2);
    if (sc2b !== sc2) check("নতুন কোড চাইলে আগের কোড অচল", (await completeSignup(db, s2, sc2)).result === "wrong");
    const ok = await completeSignup(db, s2, sc2b);
    const made = await db.user.findUnique({ where: { email: sEmail }, include: { profile: true } });
    check("সঠিক কোডে তবেই অ্যাকাউন্ট: যাচাইকৃত, নাম ও পাসওয়ার্ডসহ", ok.result === "ok" && !!made && made.id === ok.userId && !!made.emailVerifiedAt && made.profile?.name === "দ্বিতীয় চেষ্টা" && made.passwordHash === "h2", { ok, made });
    check("অ্যাকাউন্ট খোলার পর অপেক্ষমাণ নিবন্ধন মুছে গেছে", (await db.pendingSignup.count({ where: { email: sEmail } })) === 0);
    const s3 = sid();
    const sc3 = await startSignup(db, s3, { email: sEmail, name: "দখল", passwordHash: "h3" });
    check("যাচাইকৃত অ্যাকাউন্টের ইমেইলে নতুন নিবন্ধন: taken, আগের অ্যাকাউন্ট অক্ষত", (await completeSignup(db, s3, sc3)).result === "taken" && (await db.user.findUniqueOrThrow({ where: { email: sEmail } })).passwordHash === "h2");

    const sl = sid();
    const slc = await startSignup(db, sl, { email: `${tag}-slock@verify.test`, name: "x", passwordHash: "h" });
    for (let i = 0; i < MAX_ATTEMPTS; i++) await completeSignup(db, sl, other(slc));
    check(`নিবন্ধনেও ${MAX_ATTEMPTS} বার ভুলে আটকায়, সঠিক কোডও চলে না`, (await completeSignup(db, sl, slc)).result === "locked" && (await db.user.count({ where: { email: `${tag}-slock@verify.test` } })) === 0);
    const se = sid();
    const sec = await startSignup(db, se, { email: `${tag}-sexp@verify.test`, name: "x", passwordHash: "h" });
    await db.pendingSignup.update({ where: { id: se }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("নিবন্ধনের কোডের মেয়াদ শেষ: expired", (await completeSignup(db, se, sec)).result === "expired");

    // পুরোনো যাচাই-বাকি অ্যাকাউন্ট ইমেইলটি আটকে রাখে না
    const legacy = await mk("legacy", false);
    const sg = sid();
    const sgc = await startSignup(db, sg, { email: legacy.email, name: "আসল মালিক", passwordHash: "hl" });
    const rg = await completeSignup(db, sg, sgc);
    check("যাচাই-বাকি পুরোনো অ্যাকাউন্টের জায়গায় নতুন যাচাইকৃত অ্যাকাউন্ট", rg.result === "ok" && rg.userId !== legacy.id && (await db.user.count({ where: { email: legacy.email } })) === 1);

    const p = (v: string) => CodeSchema.safeParse({ code: v });
    check("বাংলা অঙ্কে লেখা কোড চলে", p("১২৩৪৫৬").success && p("১২৩৪৫৬").data?.code === "123456");
    check("ফাঁকা ঘর/হাইফেনসহ কোড চলে", p("123 456").data?.code === "123456" && p("123-456").data?.code === "123456");
    check("৫ বা ৭ সংখ্যা বা অক্ষর চলে না", !p("12345").success && !p("1234567").success && !p("12a456").success);
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.pendingSignup.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\n${fails}টি পরীক্ষা ব্যর্থ` : "\nসব পরীক্ষা সফল");
  process.exit(fails ? 1 : 0);
}
main();
