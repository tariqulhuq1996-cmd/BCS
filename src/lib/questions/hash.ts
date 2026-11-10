import { createHash } from "node:crypto";

const unifyDashes = (s: string) => s.replace(/[‐-―−]/g, "-");

/**
 * প্রশ্নের লেখা (stem) তুলনার জন্য: Unicode NFC, ছোট হাতের অক্ষর, ফাঁকা জায়গা ও সাধারণ যতিচিহ্ন
 * (দাঁড়ি, কমা, প্রশ্নবোধক, উদ্ধৃতিচিহ্ন …) বাদ। গণিতের চিহ্ন (− + × ÷ / √ = < > % ^ ² ³ বন্ধনী, দশমিক)
 * ও apostrophe রাখা হয় — নইলে "৫" আর "−৫" বা "sister" আর "sister's" একই মনে হতো।
 */
export function normalizeText(s: string): string {
  return unifyDashes(s.normalize("NFC").toLowerCase()).replace(/[^\p{L}\p{N}\p{M}\-+×÷*/√=<>%^²³().[\]{}'’]+/gu, "");
}

/**
 * অপশন তুলনার জন্য আরও সতর্ক: শুধু NFC, ছোট হাতের অক্ষর, বিয়োগ-চিহ্ন একরূপ, আর একাধিক ফাঁকা জায়গা একটিতে।
 * যতিচিহ্ন ও ফাঁকা জায়গা থাকে — "some time" বনাম "sometime" বা কমার অবস্থান (বিরামচিহ্নের প্রশ্নে) আলাদা।
 */
export function normalizeOption(s: string): string {
  return unifyDashes(s.normalize("NFC").toLowerCase()).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** প্রশ্ন + অপশন (ক্রম-নিরপেক্ষ) মিলিয়ে হ্যাশ — একই প্রশ্ন ভিন্ন ক্রমে অপশনসহ এলেও ধরা পড়ে। */
export function questionHash(text: string, options: string[]): string {
  const opts = options.map(normalizeOption).sort().join("|");
  return createHash("sha256").update(normalizeText(text) + "##" + opts).digest("hex");
}
