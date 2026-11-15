// নতুন প্রশ্ন বনাম বিগত বিসিএস (বাংলা) + লেকচারের MCQ + একই ব্যাচের অন্য প্রশ্ন — লেখার মিল যাচাই।
// মিল = অক্ষর-ত্রয়ী (character trigram) Jaccard, প্রশ্ন ও সঠিক উত্তর মিলিয়ে।
// usage: node dupcheck.js <batch-dir> <lecture document.xml>
const fs = require("fs");
const path = require("path");
const [, , batchDir, lectureXml] = process.argv;
const ROOT = path.resolve(__dirname, "../..");

const norm = (s) =>
  String(s || "")
    .normalize("NFC")
    .replace(/[‘’'"“”`।,;:!?()\[\]{}\-–—_.…॥\/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const grams = (s) => {
  const t = ` ${norm(s)} `;
  const g = new Set();
  for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3));
  return g;
};
const jac = (a, b) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n || 1);
};

// বিগত বিসিএস (বাংলা উপবিষয়, BN.*) — প্রশ্ন + চারটি বিকল্প
const rows = fs.readFileSync(path.join(ROOT, "dataset_step04.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const past = rows
  .filter((r) => r[12] && r[12].startsWith("EN."))
  .map((r) => ({ id: `${r[0]}-${r[2]}`, code: r[12], text: r[4], full: `${r[4]} ${r.slice(5, 9).join(" ")}`, opts: r.slice(5, 9).map((o) => norm(o)).filter(Boolean) }));
// ছাঁচ-প্রশ্ন (যেমন "কোনটি শুদ্ধ বানান?"): প্রশ্নের লেখা নয়, উত্তরসহ পূর্ণ রূপ তুলনা
const isTemplate = (s) => norm(s).length < 70 && /synonym|antonym|meaning|spelling|correctly spelt|one word|substitut|preposition|idiom|phrase|analogy|fill|blank|plural|feminine|form of|part of speech|correct sentence|which of the following|sentence is correct|correct sentence|is correct?|identify|choose the correct|select the correct/i.test(s);

// লেকচারের MCQ
const lec = [];
if (lectureXml && fs.existsSync(lectureXml)) {
  const x = fs.readFileSync(lectureXml, "utf8");
  const paras = x.split(/<\/w:p>/).map((p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")).filter(Boolean);
  for (let i = 0; i < paras.length; i++) {
    const m = paras[i].match(/^প্রশ্ন ([০-৯]+)।\s*(.*)$/);
    if (m) lec.push({ id: `লেকচার-প্রশ্ন${m[1]}`, text: m[2], full: [m[2], ...paras.slice(i + 1, i + 6).filter((p) => /^[কখগঘ]\.|সঠিক উত্তর/.test(p))].join(" ") });
  }
}

const data = JSON.parse(fs.readFileSync(path.join(batchDir, "questions.json"), "utf8"));
const qs = data.questions.map((q, i) => ({ ...q, n: i, text: q.q, full: `${q.q} ${q.o[q.a]}` }));
// আগের অন্য ব্যাচের প্রশ্ন (বাতিল ছাড়া)
const others = fs.readdirSync(__dirname).filter((n) => /^batch[0-9]+$/.test(n) && path.resolve(__dirname, n) !== path.resolve(batchDir)).flatMap((n) => {
  const f = path.join(__dirname, n, "questions.json");
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, "utf8")).questions.filter((q) => !q.reject).map((q, i) => ({ id: `${n}#${i + 1}`, text: q.q, full: `${q.q} ${q.o[q.a]}` }));
});
const othersG = others.map((p) => ({ ...p, g: grams(p.text), fg: grams(p.full) }));
const pastG = past.map((p) => ({ ...p, g: grams(p.text), fg: grams(p.full) }));
const lecG = lec.map((p) => ({ ...p, g: grams(p.text), fg: grams(p.full) }));

const qsG = qs.map((o) => ({ id: `নতুন#${o.n + 1}`, n: o.n, text: o.text, g: grams(o.text), fg: grams(o.full) }));
const out = [];
for (const q of qs) {
  const tmpl = isTemplate(q.text);
  const g = tmpl ? grams(q.full) : grams(q.text);
  const fg = grams(q.full);
  const best = (list) => {
    let top = { id: "-", s: 0, text: "" };
    for (const p of list) {
      if (p.n === q.n && p.id.startsWith("নতুন")) continue;
      const s = tmpl ? jac(fg, p.fg) : Math.max(jac(g, p.g), jac(fg, p.fg));
      if (s > top.s) top = { id: p.id, s, text: p.text };
    }
    return top;
  };
  const bp = best(pastG);
  const bl = best(lecG);
  const bi = best([...qsG, ...othersG]);
  const ans = norm(q.o[q.a]);
  const ansHit = ans.length >= 5 ? past.filter((p) => p.opts.includes(ans)).map((p) => p.id) : [];
  out.push({ n: q.n + 1, q: q.q, past: bp, lecture: bl, internal: bi, ansHit });
}
const EXACT = 0.85, NEAR = 0.5;
const flag = (s) => (s >= EXACT ? "EXACT?" : s >= NEAR ? "NEAR?" : "");
const rep = out.map((r) => ({
  n: r.n,
  pastMax: +r.past.s.toFixed(3), pastId: r.past.id, pastFlag: flag(r.past.s),
  lecMax: +r.lecture.s.toFixed(3), lecId: r.lecture.id, lecFlag: flag(r.lecture.s),
  intMax: +r.internal.s.toFixed(3), intId: r.internal.id, intFlag: flag(r.internal.s),
  pastText: r.past.text, lecText: r.lecture.text, ansHit: r.ansHit,
}));
fs.writeFileSync(path.join(batchDir, "dupcheck.json"), JSON.stringify({ comparedPast: past.length, comparedLecture: lec.length, thresholds: { EXACT, NEAR }, rows: rep }, null, 1));
console.log(`বিগত ${past.length}টি, লেকচারের ${lec.length}টি প্রশ্নের সঙ্গে তুলনা`);
for (const r of rep.filter((r) => r.pastFlag || r.lecFlag || r.intFlag || r.pastMax >= 0.35 || r.lecMax >= 0.35))
  console.log(`#${r.n} past ${r.pastMax} ${r.pastId} ${r.pastFlag} | lec ${r.lecMax} ${r.lecId} ${r.lecFlag} | int ${r.intMax} ${r.intId}\n   new: ${qs[r.n - 1].q.slice(0, 70)}\n   past: ${r.pastText.slice(0, 70)}\n   lec: ${r.lecText.slice(0, 70)}`);
const mx = (k) => Math.max(...rep.map((r) => r[k]));
console.log(`সর্বোচ্চ মিল — বিগত: ${mx("pastMax")}, লেকচার: ${mx("lecMax")}, ব্যাচের ভেতরে: ${mx("intMax")}`);
