// নৈতিকতা ব্যাচের সাধারণ সহায়ক: উপবিষয়ের নাম (plan.json) ও উৎস-লেবেল
const PLAN = require("./plan.json");
const SUB = Object.fromEntries(PLAN.map((p) => [p.code, p.name]));
const subs = (...codes) => Object.fromEntries(codes.map((c) => [c, SUB[c]]));
const LEC = (n, what) => `লেকচার ${n} (${what}) ও Standard Reference (বাংলাদেশের সংবিধান, জাতীয় শুদ্ধাচার কৌশল ২০১২, সংশ্লিষ্ট আইন)`;
module.exports = { subs, LEC };
