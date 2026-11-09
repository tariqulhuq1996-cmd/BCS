import { createHash } from "node:crypto";

/** Duplicate শনাক্তকরণের জন্য প্রশ্নের লেখা স্বাভাবিক করা: Unicode NFC, ছোট হাতের অক্ষর,
 *  শুধু অক্ষর/সংখ্যা/মাত্রা রাখা (ফাঁকা জায়গা ও যতিচিহ্ন বাদ)। */
export function normalizeText(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}

/** প্রশ্ন + অপশন (ক্রম-নিরপেক্ষ) মিলিয়ে হ্যাশ — একই প্রশ্ন ভিন্ন ক্রমে অপশনসহ এলেও ধরা পড়ে। */
export function questionHash(text: string, options: string[]): string {
  const opts = options.map(normalizeText).sort().join("|");
  return createHash("sha256").update(normalizeText(text) + "##" + opts).digest("hex");
}
