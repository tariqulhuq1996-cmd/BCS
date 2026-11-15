// সংক্ষিপ্ত প্রশ্ন-ফাইল (src.js) → questions.json।  node mk.js batchNN
// src.js: module.exports = { batch, basis, subtopics, st, src, items: [[d, q, [ক,খ,গ,ঘ], ansIndex, ব্যাখ্যা, সূত্র, {extra}], ...] }
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, process.argv[2]);
const s = require(path.join(dir, "src.js"));
// চূড়ান্ত পুনর্নিরীক্ষার (audit.js) পর: overrides.js = { reject: [{ match, reject, dup, v }], add: [items] }
const ovPath = path.join(dir, "overrides.js");
const ov = fs.existsSync(ovPath) ? require(ovPath) : { reject: [], add: [] };
s.items = [...s.items, ...(ov.add || [])];
const D = { E: "Easy", M: "Medium", H: "Hard" };
const questions = s.items.map(([d, q, o, a, e, t, x = {}]) => ({
  st: x.st || s.st, d: D[d] || d, q, o, a, e, t,
  src: x.src || s.src || "সাধারণ প্রামাণ্য তথ্য",
  dup: x.dup || "পাস",
  v: x.v || "যাচাইকৃত",
  ...(x.fixed ? { fixed: true } : {}),
  ...(x.reject ? { reject: x.reject } : {}),
}));
for (const r of ov.reject || []) {
  const q = questions.find((q) => q.q.includes(r.match));
  if (!q) throw new Error("override match not found: " + r.match);
  if (r.reject) q.reject = r.reject;
  if (r.dup) q.dup = r.dup;
  if (r.v) q.v = r.v;
}
const out = { batch: s.batch, subject: "বাংলা ভাষা ও সাহিত্য", basis: s.basis, subtopics: s.subtopics, ...(s.idStart ? { idStart: s.idStart } : {}), questions };
fs.writeFileSync(path.join(dir, "questions.json"), JSON.stringify(out, null, 2));
console.log("written", questions.length);
