import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * ইমেইল পাঠানো (SMTP) — যেকোনো সেবা চলে: Amazon SES, Brevo, Mailgun, Resend (SMTP), Zoho, Gmail Workspace ইত্যাদি।
 * পরিবেশ-চলক: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (যেমন "BCS ৫২ প্রস্তুতি <no-reply@example.com>")।
 * কনফিগার করা না থাকলে: ডেভেলপমেন্টে লিংক সার্ভারের টার্মিনালে ছাপা হয়; প্রোডাকশনে ত্রুটি লগ হয় (ইমেইল যায় না)।
 */
let cached: Transporter | null = null;

/** পরিবেশ-চলকের মান — hPanel-এ ভুল করে দেওয়া দুই পাশের ফাঁকা জায়গা বা উদ্ধৃতিচিহ্ন ("…" / '…') বাদ দিয়ে। */
export function envValue(name: string): string {
  let v = (process.env[name] ?? "").trim();
  if (v.length >= 2 && (v[0] === `"` || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1).trim();
  return v;
}

function smtpConfig() {
  const host = envValue("SMTP_HOST");
  const user = envValue("SMTP_USER");
  const pass = envValue("SMTP_PASS");
  if (!host || !user || !pass) return null;
  const port = Number(envValue("SMTP_PORT") || 587);
  return { host, port, user, pass, from: envValue("MAIL_FROM") || user };
}

function transport(): Transporter | null {
  if (cached) return cached;
  const c = smtpConfig();
  if (!c) return null;
  cached = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 });
  return cached;
}

const fromAddress = () => smtpConfig()?.from ?? "";

/** অ্যাডমিন-পাতার জন্য: কোন মান বসানো আছে (পাসওয়ার্ড ছাড়া)। */
export function mailStatus() {
  const c = smtpConfig();
  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => !envValue(k));
  if (!c) return { configured: false as const, missing };
  const fromEmail = (c.from.match(/<([^>]+)>/)?.[1] ?? c.from).trim().toLowerCase();
  return { configured: true as const, host: c.host, port: c.port, user: c.user, from: c.from, passLength: c.pass.length, fromMatchesUser: fromEmail === c.user.toLowerCase() };
}

/** SMTP-র ত্রুটিকে সহজ বাংলায় ব্যাখ্যা (আসল বার্তাও সঙ্গে দেখানো হয়)। */
export function explainMailError(msg: string): string {
  const m = msg.toLowerCase();
  if (/535|auth|credentials|username and password/.test(m)) return "লগইন ব্যর্থ: SMTP_USER (পুরো ইমেইল ঠিকানা) বা SMTP_PASS (ঐ মেইলবক্সের পাসওয়ার্ড) ভুল। hPanel → Emails থেকে পাসওয়ার্ড নতুন করে দিয়ে আবার বসান।";
  if (/enotfound|getaddrinfo/.test(m)) return "SMTP_HOST খুঁজে পাওয়া যায়নি — বানান দেখুন (smtp.hostinger.com)।";
  if (/timeout|etimedout|econnrefused|econnreset/.test(m)) return "সার্ভারে সংযোগ হয়নি — SMTP_PORT দেখুন (465 অথবা 587)।";
  if (/wrong version number|ssl|tls/.test(m)) return "পোর্ট আর এনক্রিপশন মেলেনি — SMTP_PORT 465 দিন।";
  if (/553|550|sender|not owned|relay/.test(m)) return "প্রেরকের ঠিকানা গ্রহণ হয়নি — MAIL_FROM-এর <…> অংশের ঠিকানা SMTP_USER-এর সঙ্গে হুবহু এক হতে হবে।";
  return "ওপরের আসল বার্তাটি দেখুন।";
}

/** পরীক্ষামূলক ইমেইল — সফল না হলে SMTP-র আসল ত্রুটি ফেরত দেয়। */
export async function sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  cached = null; // সর্বশেষ মান দিয়ে নতুন সংযোগ
  const t = transport();
  if (!t) return { ok: false, error: "SMTP কনফিগার করা নেই।" };
  try {
    await t.verify();
    await t.sendMail({
      from: fromAddress(),
      to,
      subject: "পরীক্ষামূলক ইমেইল — BCS ৫২ প্রস্তুতি",
      text: "এই ইমেইল পৌঁছালে ইমেইল-সেবা ঠিকমতো কাজ করছে; শিক্ষার্থীরা যাচাই কোড পাবেন।",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function resetEmail(link: string) {
  const subject = "পাসওয়ার্ড রিসেট — BCS ৫২ প্রস্তুতি";
  const text = [
    "আপনার অ্যাকাউন্টের পাসওয়ার্ড রিসেটের অনুরোধ পাওয়া গেছে।",
    "",
    "নতুন পাসওয়ার্ড ঠিক করতে এই লিংকে যান (লিংকটি এক ঘণ্টা কাজ করবে, একবারই ব্যবহার করা যাবে):",
    link,
    "",
    "আপনি অনুরোধ না করে থাকলে এই ইমেইল উপেক্ষা করুন; আপনার পাসওয়ার্ড বদলাবে না।",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.7;color:#1c2733">
<p>আপনার অ্যাকাউন্টের পাসওয়ার্ড রিসেটের অনুরোধ পাওয়া গেছে।</p>
<p><a href="${link}" style="display:inline-block;background:#006a4e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">নতুন পাসওয়ার্ড ঠিক করুন</a></p>
<p style="color:#4a5662;font-size:14px">লিংকটি এক ঘণ্টা কাজ করবে এবং একবারই ব্যবহার করা যাবে। আপনি অনুরোধ না করে থাকলে এই ইমেইল উপেক্ষা করুন।</p></div>`;
  return { subject, text, html };
}

export async function sendPasswordResetLink(email: string, link: string) {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") console.error("[mailer] ইমেইল-সেবা কনফিগার করা হয়নি; রিসেট লিংক পাঠানো যায়নি।");
    else console.log(`\n[পাসওয়ার্ড রিসেট] ${email}\n  ${link}\n`);
    return;
  }
  try {
    await t.sendMail({ from: fromAddress(), to: email, ...resetEmail(link) });
  } catch (e) {
    // ব্যবহারকারীকে একই উত্তর দেওয়া হয় (ইমেইল আছে কি না প্রকাশ নয়); ত্রুটি শুধু সার্ভার-লগে
    console.error("[mailer] পাঠানো যায়নি:", (e as Error).message);
  }
}

/** ইমেইল-সেবা (SMTP) কনফিগার করা আছে কি না। */
export const mailConfigured = () => transport() !== null;

/** নতুন অ্যাকাউন্টে ইমেইল যাচাই লাগবে কি না। প্রোডাকশনে SMTP না থাকলে লাগে না — নইলে কেউই অ্যাকাউন্ট চালু করতে পারত না। */
export const verificationRequired = () => process.env.NODE_ENV !== "production" || mailConfigured();

export function verificationEmail(code: string) {
  const subject = `${code} — আপনার যাচাই কোড (BCS ৫২ প্রস্তুতি)`;
  const text = [
    "BCS ৫২ প্রস্তুতিতে অ্যাকাউন্ট খোলার জন্য ধন্যবাদ।",
    "",
    `আপনার ইমেইল যাচাইয়ের কোড: ${code}`,
    "",
    "কোডটি ১৫ মিনিট কাজ করবে। আপনি অ্যাকাউন্ট না খুলে থাকলে এই ইমেইল উপেক্ষা করুন।",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.7;color:#1c2733">
<p>BCS ৫২ প্রস্তুতিতে অ্যাকাউন্ট খোলার জন্য ধন্যবাদ। আপনার ইমেইল যাচাইয়ের কোড:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,monospace;color:#006a4e;margin:12px 0">${code}</p>
<p style="color:#4a5662;font-size:14px">কোডটি ১৫ মিনিট কাজ করবে। আপনি অ্যাকাউন্ট না খুলে থাকলে এই ইমেইল উপেক্ষা করুন।</p></div>`;
  return { subject, text, html };
}

/** যাচাই কোড পাঠানো; পাঠানো গেলে true। SMTP না থাকলে ডেভেলপমেন্টে কোড টার্মিনালে ছাপা হয়। */
export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mailer] ইমেইল-সেবা কনফিগার করা হয়নি; যাচাই কোড পাঠানো যায়নি।");
      return false;
    }
    console.log(`\n[ইমেইল যাচাই] ${email}\n  কোড: ${code}\n`);
    return true;
  }
  try {
    await t.sendMail({ from: fromAddress(), to: email, ...verificationEmail(code) });
    return true;
  } catch (e) {
    console.error("[mailer] যাচাই কোড পাঠানো যায়নি:", (e as Error).message);
    return false;
  }
}
