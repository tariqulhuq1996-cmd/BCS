/**
 * Performance Dashboard ও পরীক্ষা-পরবর্তী বিশ্লেষণের বিশুদ্ধ হিসাব (ডেটাবেস লাগে না):
 * রোগনির্ণয়, প্রবণতার ন্যূনতম পরীক্ষা, বিষয়ের অবস্থা, সময় নষ্ট হওয়া প্রশ্নের ভিত্তি।
 *   npx tsx scripts/test-performance.ts
 */
import { diagnose, findTimeWasters, levelOf, parseScope, splitTrend, splitTrendWeighted, subjectStatus, toFull, type Benchmarks } from "../src/lib/exam/performance";

let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const B: Benchmarks = { strongNet: 150, goodNet: 125, accHigh: 80, accLow: 65, attemptHigh: 90, attemptLow: 75, stableSd: 5, unstableSd: 10 };

// ── রোগনির্ণয়
check("শক্তিশালী: নেট ও Accuracy মানদণ্ডের ওপরে", diagnose(155, 85, 95, B).key === "strong");
check("ঝুঁকিপূর্ণ: Attempt বেশি, Accuracy কম", diagnose(100, 60, 95, B).key === "reckless");
check("অতি সতর্ক: Accuracy বেশি, Attempt কম", diagnose(110, 90, 60, B).key === "cautious");
check("ভিত্তি দুর্বল: দুটোই কম", diagnose(50, 55, 60, B).key === "foundation");
check("ভালো: নেট goodNet-এর ওপরে", diagnose(130, 78, 85, B).key === "balanced");
check("উন্নয়নশীল: বাকি সব", diagnose(110, 75, 85, B).key === "developing");
check("রোগনির্ণয়ে প্রমাণ (নেট) লেখা থাকে", diagnose(130, 78, 85, B).detail.includes("130.0"));

// ── প্রবণতা: একটি বা কম পরীক্ষা থেকে উন্নতি দাবি নয়
check("১টি পরীক্ষায় প্রবণতা নেই", splitTrend([140], 4) === null);
check("৩টি পরীক্ষায় (ন্যূনতম ৪) প্রবণতা নেই", splitTrend([100, 120, 140], 4) === null);
const tr = splitTrend([100, 110, 120, 130], 4);
check("৪টিতে শেষ ২ বনাম আগের ২", tr != null && tr.k === 2 && tr.recent === 125 && tr.before === 105 && tr.delta === 20, tr);
const tr12 = splitTrend(Array.from({ length: 12 }, (_, i) => i), 4);
check("১২টিতে k সর্বোচ্চ ৫", tr12?.k === 5 && tr12.before === 4 && tr12.recent === 9, tr12);

// ── বিষয়ের অবস্থা
check("তথ্য না থাকলে nodata (শূন্য নয়)", subjectStatus(null, null, B) === "nodata");
check("Accuracy ৮৫, Attempt ৯০ → শক্তিশালী", subjectStatus(85, 90, B) === "strong");
check("Accuracy ৮৫ কিন্তু Attempt ৫০ → মোটামুটি", subjectStatus(85, 50, B) === "ok");
check("Accuracy ৬০ → দুর্বল", subjectStatus(60, 95, B) === "weak");

// ── সময় নষ্ট হওয়া প্রশ্ন
const base = {
  byDiff: new Map([["MA|HARD", { n: 10, sec: 80 }], ["BN|EASY", { n: 10, sec: 15 }]]),
  bySubj: new Map([["MA", { n: 30, sec: 60 }], ["BN", { n: 30, sec: 20 }]]),
};
const items = [
  { no: 1, text: "", subject: "গণিত", code: "MA", difficulty: "HARD", sec: 100, status: "wrong" as const }, // কঠিন গণিতে ১০০ সে. — নিজের ৮০-র তুলনায় স্বাভাবিক
  { no: 2, text: "", subject: "বাংলা", code: "BN", difficulty: "EASY", sec: 50, status: "wrong" as const }, // সহজ বাংলায় ৫০ সে. — নিজের ১৫-র তিনগুণ
  { no: 3, text: "", subject: "গণিত", code: "MA", difficulty: null, sec: 95, status: "correct" as const }, // কঠিনতা অজানা → বিষয়ের গড় ৬০
  { no: 4, text: "", subject: "বাংলা", code: "BN", difficulty: "EASY", sec: null, status: "unanswered" as const }, // সময় নেই → বাদ
];
const w = findTimeWasters(items, base, 31.5);
check("৩১.৫ সেকেন্ডের বেশি হলেও কঠিন প্রশ্নে নিজের স্বাভাবিক সময় হলে তালিকায় নয়", !w.some((x) => x.no === 1), w);
check("সহজ প্রশ্নে নিজের সময়ের তিনগুণ → তালিকায়, ভিত্তি = বিষয় × কঠিনতা", w.find((x) => x.no === 2)?.baselineSource === "own_diff", w);
check("কঠিনতা অজানা হলে বিষয়ের গড় ভিত্তি", w.find((x) => x.no === 3)?.baselineSource === "own_subject", w);
check("সময় রেকর্ড না থাকা প্রশ্ন বাদ", !w.some((x) => x.no === 4));
const noHist = findTimeWasters([{ no: 1, text: "", subject: "গণিত", code: "MA", difficulty: "HARD", sec: 120, status: "wrong" }], { byDiff: new Map(), bySubj: new Map() }, 31.5);
check("ইতিহাস না থাকলে বরাদ্দ সময় ভিত্তি", noHist[0]?.baselineSource === "budget", noHist);

// ── ২০০-এর অনুপাত
check("৫০ প্রশ্নে ৩৮ নেট → ১৫২/২০০", toFull(38, 50) === 152);
check("২০০ প্রশ্নে নম্বর অপরিবর্তিত", toFull(141.5, 200) === 141.5);
check("২০ প্রশ্নে ১৫ নেট → ১৫০/২০০", toFull(15, 20) === 150);
check("প্রশ্ন না থাকলে ০ (ভাগে শূন্য নয়)", toFull(5, 0) === 0);
const wt = splitTrendWeighted([{ num: 1, den: 2 }, { num: 1, den: 2 }, { num: 18, den: 20 }, { num: 2, den: 20 }], 4);
check("ভারযুক্ত প্রবণতা: প্রশ্নসংখ্যার ভারে (৫০% → ৫০%)", wt != null && Math.abs(wt.before - 50) < 1e-9 && Math.abs(wt.recent - 50) < 1e-9, wt);

// ── কোন পরীক্ষা কোন Level-এর
check("L1 কাজের Mastery → Level ১", levelOf({ kind: "MASTERY", task: { kind: "L1_EXAM" } }) === "1");
check("L2 উপবিষয়ের Revision → Level ২", levelOf({ kind: "REVISION", task: { kind: "L2_SUBTOPIC" } }) === "2");
check("শুরুর মূল্যায়ন → ধাপ ০", levelOf({ kind: "DIAGNOSTIC", task: { kind: "L0_DIAGNOSTIC" } }) === "0" && levelOf({ kind: "DIAGNOSTIC", task: null }) === "0");
check("কাজ ছাড়া Model Test → Level ৩", levelOf({ kind: "MODEL_TEST", task: null }) === "3");
check("দৈনিক Revision → অন্যান্য", levelOf({ kind: "SRS_REVIEW", task: null }) === "other");
check("অজানা level মান → সব", parseScope("x") === "all" && parseScope("2") === "2");

console.log(fails ? `\n${fails}টি ব্যর্থ` : "\nসব পাস");
process.exitCode = fails ? 1 : 0;
