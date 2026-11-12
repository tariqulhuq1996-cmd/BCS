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
