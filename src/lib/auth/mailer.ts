import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * ইমেইল পাঠানো (SMTP) — যেকোনো সেবা চলে: Amazon SES, Brevo, Mailgun, Resend (SMTP), Zoho, Gmail Workspace ইত্যাদি।
 * পরিবেশ-চলক: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (যেমন "BCS ৫২ প্রস্তুতি <no-reply@example.com>")।
 * কনফিগার করা না থাকলে: ডেভেলপমেন্টে লিংক সার্ভারের টার্মিনালে ছাপা হয়; প্রোডাকশনে ত্রুটি লগ হয় (ইমেইল যায় না)।
 */
let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 587);
  cached = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  return cached;
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
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to: email, ...resetEmail(link) });
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
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to: email, ...verificationEmail(code) });
    return true;
  } catch (e) {
    console.error("[mailer] যাচাই কোড পাঠানো যায়নি:", (e as Error).message);
    return false;
  }
}
