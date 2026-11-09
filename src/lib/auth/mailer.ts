import "server-only";

/**
 * পাসওয়ার্ড-রিসেট লিংক পাঠানো।
 * এখনও কোনো ইমেইল-সেবা যুক্ত হয়নি (Phase 10-এ সিদ্ধান্ত): ততদিন লিংকটি সার্ভারের টার্মিনালে ছাপা হয়।
 * প্রোডাকশনে ইমেইল-সেবা ছাড়া চালালে রিসেট কাজ করবে না — তাই সেখানে স্পষ্ট ত্রুটি লগ হয়।
 */
export async function sendPasswordResetLink(email: string, link: string) {
  if (process.env.NODE_ENV === "production") {
    console.error("[mailer] ইমেইল-সেবা কনফিগার করা হয়নি; রিসেট লিংক পাঠানো যায়নি:", email);
    return;
  }
  console.log(`\n[পাসওয়ার্ড রিসেট] ${email}\n  ${link}\n`);
}
