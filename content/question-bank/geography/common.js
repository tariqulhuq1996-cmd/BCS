// ভূগোল ব্যাচের সাধারণ সহায়ক: উপবিষয়ের নাম (plan.json) ও উৎস-লেবেল
const PLAN = require("./plan.json");
const SUB = Object.fromEntries(PLAN.map((p) => [p.code, p.name]));
const subs = (...codes) => Object.fromEntries(codes.map((c) => [c, SUB[c]]));
const LEC = (n, what) => `লেকচার ${n} (${what}) ও Standard Geography Reference (মাধ্যমিক ভূগোল ও পরিবেশ, NCTB; বাংলাপিডিয়া)`;
module.exports = { subs, LEC };
