// কম্পিউটার ও তথ্যপ্রযুক্তি ব্যাচের সাধারণ সহায়ক: উপবিষয়ের নাম (plan.json), উৎস-লেবেল ও সংক্ষিপ্ত প্রশ্ন-লেখক
const PLAN = require("./plan.json");
const SUB = Object.fromEntries(PLAN.map((p) => [p.code, p.name]));
const subs = (...codes) => Object.fromEntries(codes.map((c) => [c, SUB[c]]));
const LEC = (n, what) => `লেকচার ${n} (${what}) ও Standard Reference (উচ্চমাধ্যমিক আইসিটি পাঠ্যবই, IEEE/ITU মানদণ্ড, সংশ্লিষ্ট প্রতিষ্ঠানের অফিশিয়াল ডকুমেন্টেশন, বাংলাদেশ সরকারের আইসিটি নীতি ও আইন)`;
// S(উপবিষয়, লেকচার, বিষয়)(d, প্রশ্ন, [সঠিক, ভুল, ভুল, ভুল], ব্যাখ্যা, শর্টকাট) — সঠিক উত্তর সবসময় প্রথমে লেখা হয়; balance.js অবস্থান সমান করে
const S = (st, n, w) => (d, q, o, e, t) => [d, q, o, 0, e, t, { st, src: LEC(n, w) }];
module.exports = { subs, LEC, S };
