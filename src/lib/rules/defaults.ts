/**
 * সব নিয়মের প্রাথমিক মান। ডেটাবেসের RuleSetting টেবিলে এগুলো বসানো হয়;
 * এরপর অ্যাডমিন প্যানেল থেকে বদলানো যায়। এখানে কিছু বদলালে `npm run db:seed`
 * শুধু অনুপস্থিত key যোগ করে — অ্যাডমিনের বদলানো মান মুছে দেয় না।
 *
 * অনুমোদিত সিদ্ধান্ত (Phase 01 পর্যালোচনা):
 *  - Level 1 ও 2-এর Threshold ৮০%
 *  - বাধ্যতামূলক পথে শুধু V ও C শ্রেণির প্রশ্ন; J ও S ঐচ্ছিক অনুশীলনে
 *  - Level 3 স্তর-গেট: শেষ ৫টি টেস্টের গড় নেট নম্বর ১২০ (স্তর ১→২) ও ১৪০ (স্তর ২→৩)
 */
export type RuleValue = number | boolean | string | number[] | string[] | Record<string, unknown>;

export const DEFAULT_RULES: Record<string, { value: RuleValue; noteBn: string }> = {
  // ── সাধারণ
  "attempt.limit": { value: 0, noteBn: "একটি পরীক্ষা সর্বোচ্চ কতবার দেওয়া যাবে (০ = সীমাহীন)" },
  "path.eligible_classes": { value: ["V", "C"], noteBn: "বাধ্যতামূলক পথে কোন যাচাই-শ্রেণির প্রশ্ন আসবে" },
  "path.practice_classes": { value: ["J", "S"], noteBn: "শুধু ঐচ্ছিক অনুশীলনে আসবে এমন শ্রেণি" },

  // ── Level 1
  "l1.threshold.mastery": { value: 80, noteBn: "প্রতিটি বিসিএসের Mastery Test-এ ন্যূনতম %" },
  "l1.threshold.cumulative": { value: 80, noteBn: "Cumulative Revision Test-এ ন্যূনতম %" },
  "l1.threshold.final": { value: 80, noteBn: "Level 1 Final Assessment-এ ন্যূনতম %" },
  "l1.solve.part_size": { value: 50, noteBn: "প্রথম সমাধানে প্রতি ভাগে প্রশ্ন" },
  "l1.revision.bands": {
    value: { "85": 15, "70": 25, "50": 35, "0": 40 },
    noteBn: "প্রথমবারের স্কোর (%) অনুযায়ী Revision Test-এর প্রশ্নসংখ্যা",
  },
  "l1.mastery.size": { value: 40, noteBn: "Mastery Test-এর প্রশ্নসংখ্যা" },
  "l1.cumulative.base": { value: 20, noteBn: "Cumulative Test: ভিত্তি প্রশ্নসংখ্যা" },
  "l1.cumulative.step": { value: 5, noteBn: "Cumulative Test: প্রতি সম্পন্ন পরীক্ষায় বাড়তি প্রশ্ন" },
  "l1.cumulative.max": { value: 100, noteBn: "Cumulative Test: সর্বোচ্চ প্রশ্ন" },
  "l1.cumulative.min_per_exam": { value: 2, noteBn: "Cumulative Test-এ প্রতিটি আগের বিসিএস থেকে ন্যূনতম প্রশ্ন" },
  "l1.final.size": { value: 100, noteBn: "Level 1 Final Assessment-এর প্রশ্নসংখ্যা" },
  "shuffle.options": { value: true, noteBn: "Revision/Mastery/Cumulative-এ অপশনের ক্রম এলোমেলো (\"সবগুলো\"/\"কোনটিই নয়\" ধরনের অপশন থাকলে নয়)" },

  // প্রশ্ন বাছাইয়ের ওজন (প্রোটোটাইপ থেকে)
  "select.weights": {
    value: { wrongLast: 5, wrongCount: 3, marked: 2, lowConf: 2, priorityA: 1.5, stale: 1 },
    noteBn: "Revision/Cumulative-এ প্রশ্ন বাছাইয়ের অগ্রাধিকার-ওজন",
  },

  // ── Level 2
  "l2.threshold.mastery": { value: 80, noteBn: "উপবিষয়ের Mastery Test-এ ন্যূনতম %" },
  "l2.threshold.checkpoint": { value: 80, noteBn: "Priority Phase Checkpoint-এ ন্যূনতম %" },
  "l2.threshold.final": { value: 80, noteBn: "Level 2 Final Assessment-এ ন্যূনতম %" },
  "l2.solve.chunk_size": { value: 25, noteBn: "উপবিষয়ের প্রথম সমাধানে প্রতি ভাগে প্রশ্ন" },
  "l2.final.size": { value: 200, noteBn: "Level 2 Final Assessment (নতুন মানবণ্টনে)" },
  "l2.revision.min": { value: 10, noteBn: "উপবিষয়ের Revision Test-এ ন্যূনতম প্রশ্ন" },
  "l2.revision.max": { value: 25, noteBn: "উপবিষয়ের Revision Test-এ সর্বোচ্চ প্রশ্ন" },
  "l2.mastery.size": { value: 20, noteBn: "উপবিষয়ের Mastery Test-এর প্রশ্নসংখ্যা" },
  "l2.checkpoint.size": { value: 50, noteBn: "Priority Phase Checkpoint-এর প্রশ্নসংখ্যা" },
  "srs.session_size": { value: 20, noteBn: "দৈনিক Revision-এর প্রতিটি সেটে প্রশ্ন" },
  "srs.intervals_days": { value: [1, 3, 7, 14, 30], noteBn: "Leitner বাক্স ১–৫-এর ব্যবধান (দিন)" },
  "srs.daily_cap": { value: 60, noteBn: "দিনে সর্বোচ্চ Revision প্রশ্ন" },
  "srs.block_new_when_due": { value: true, noteBn: "আজকের Revision বাকি থাকলে নতুন উপবিষয় শুরু করা যাবে না" },

  // ── Level 3
  "l3.duration_min": { value: 120, noteBn: "Model Test-এর সময় (মিনিট)" },
  "l3.negative_mark": { value: 0.5, noteBn: "প্রতিটি ভুলে কাটা নম্বর" },
  "l3.gate.window": { value: 5, noteBn: "স্তর-গেটে শেষ কতটি টেস্টের গড় ধরা হবে" },
  "l3.gate.tier1_net": { value: 120, noteBn: "স্তর ১ → ২: গড় নেট নম্বর" },
  "l3.gate.tier2_net": { value: 140, noteBn: "স্তর ২ → ৩: গড় নেট নম্বর" },
  "l3.require_review": { value: true, noteBn: "পরের টেস্ট খুলতে আগের টেস্টের ভুল Review বাধ্যতামূলক" },
  "l3.no_repeat_window": { value: 10, noteBn: "পরপর কতটি টেস্টে একই প্রশ্ন আসবে না" },
  "l3.difficulty_mix": {
    value: { "1": [50, 40, 10], "2": [30, 50, 20], "3": [20, 45, 35] },
    noteBn: "স্তরভেদে সহজ/মাঝারি/কঠিন (%)",
  },
  "exam.marks_distribution": {
    value: { BN: 30, EN: 30, BD: 25, IA: 25, GE: 10, SC: 15, IT: 15, MA: 20, MN: 15, ET: 15 },
    noteBn: "২০০ নম্বরের বিষয়ভিত্তিক মানবণ্টন (৫১তম থেকে; পিএসসি প্রজ্ঞাপনের সঙ্গে মিলিয়ে নিন)",
  },
};
