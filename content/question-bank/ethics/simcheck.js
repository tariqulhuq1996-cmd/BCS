// Level 2 importer-এর নিয়মে (trigram Jaccard ≥ 0.8, একই উপবিষয়ে) কাছাকাছি প্রশ্ন খোঁজা: node simcheck.js
const fs = require("fs"), path = require("path");
const norm = (s) => s.normalize("NFC").toLowerCase().replace(/[‐-―−]/g, "-").replace(/[^\p{L}\p{N}\p{M}\-+×÷*/√=<>%^²³().[\]{}'’]+/gu, "");
const tri = (s) => { const t = norm(s), set = new Set(); for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3)); return set; };
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
const BD = (s) => String(s);
const seen = {};
let bad = 0;
for (const b of fs.readdirSync(__dirname).filter((d) => /^batch\d+$/.test(d)).sort()) {
  JSON.parse(fs.readFileSync(path.join(__dirname, b, "questions.json"), "utf8")).questions.forEach((q, i) => {
    const t = tri(q.q + " " + q.o.join(" "));
    let best = { s: 0, id: "" };
    for (const e of seen[q.st] || []) { const s = jac(t, e.t); if (s > best.s) best = { s, id: e.id }; }
    if (best.s >= (+process.argv[2] || 0.8)) { bad++; console.log(`${b}#${i + 1} ${q.st} ${best.s.toFixed(2)} ~ ${best.id} | ${q.q.slice(0, 70)}`); }
    (seen[q.st] = seen[q.st] || []).push({ t, id: `${b}#${i + 1}` });
  });
}
console.log("flagged", bad);
