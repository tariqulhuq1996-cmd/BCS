// কঠোর পুনর্নিরীক্ষা: একই উত্তর + কাছাকাছি প্রশ্ন (বিগত বিসিএস ও ব্যাচগুলোর ভেতরে)
// usage: node audit.js  → audit.json ও কনসোলে সন্দেহজনক তালিকা
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const norm = (s) => String(s || "").replace(/[‘’'"“”\-–—,।?!:;()\s.]/g, "").replace(/্‌/g, "্").trim();
const tri = (s) => { const t = norm(s); const set = new Set(); for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3)); return set; };
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

const ds = fs.readFileSync(path.join(ROOT, "dataset_step04.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const key = new Map();
for (const r of fs.readFileSync(path.join(ROOT, "answer_key_v7.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"))) key.set(`${r[0]}-${r[1]}`, r[8]);
const past = ds.filter((r) => r[12] && r[12].startsWith("BN.")).map((r) => {
  const id = `${parseInt(r[0], 10)}-${r[2]}`;
  const ans = key.get(id) || "";
  return { id, q: r[4], ans, nAns: norm(ans), tq: tri(r[4]) };
});

const batches = fs.readdirSync(__dirname).filter((n) => /^batch\d+$/.test(n)).sort();
const all = [];
for (const b of batches) {
  const f = path.join(__dirname, b, "questions.json");
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  d.questions.forEach((q, i) => {
    if (q.reject || q.v.startsWith("যাচাই প্রয়োজন")) return;
    const ans = q.o[q.a];
    all.push({ b, i: i + 1, st: q.st, q: q.q, ans, nAns: norm(ans), tq: tri(q.q), tqa: tri(q.q + " " + ans) });
  });
}

const flags = [];
for (const x of all) {
  for (const p of past) {
    if (!p.nAns || !x.nAns) continue;
    const sameAns = p.nAns === x.nAns || (x.nAns.length > 3 && (p.nAns.includes(x.nAns) || x.nAns.includes(p.nAns)));
    if (!sameAns) continue;
    const s = jac(x.tq, p.tq);
    if (s >= 0.3) flags.push({ kind: "PAST", s: +s.toFixed(2), a: `${x.b}#${x.i}`, st: x.st, q: x.q, ans: x.ans, other: `${p.id}: ${p.q} => ${p.ans}` });
  }
}
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const x = all[i], y = all[j];
  if (x.nAns !== y.nAns) continue;
  const s = jac(x.tq, y.tq);
  if (s >= 0.45) flags.push({ kind: "INT", s: +s.toFixed(2), a: `${x.b}#${x.i}`, st: x.st, q: x.q, ans: x.ans, other: `${y.b}#${y.i}: ${y.q}` });
}
flags.sort((a, b) => b.s - a.s);
fs.writeFileSync(path.join(__dirname, "audit.json"), JSON.stringify(flags, null, 1));
console.log("accepted", all.length, "flags", flags.length);
for (const f of flags) console.log(f.kind, f.s, f.a, f.q.slice(0, 60), "=>", f.ans, "|", f.other.slice(0, 90));
