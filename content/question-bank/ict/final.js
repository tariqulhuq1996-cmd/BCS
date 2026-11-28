// চূড়ান্ত সংকলন (কম্পিউটার ও তথ্যপ্রযুক্তি): উপবিষয়ভিত্তিক TSV/CSV, পরিসংখ্যান এবং Level 2-এর geography.json
// usage: node final.js [platform/data/source/level2/geography.json]
const fs = require("fs");
const path = require("path");
const { computeIds, isAccepted } = require("./ids");

const HERE = __dirname;
const OUT = path.join(HERE, "final");
fs.mkdirSync(OUT, { recursive: true });
const PLAN = require("./plan.json");
const PM = new Map(PLAN.map((p) => [p.code, p]));
const L = ["A", "B", "C", "D"];
const ids = computeIds(HERE);

const all = [];
for (const b of fs.readdirSync(HERE).filter((n) => /^batch\d+$/.test(n)).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, b, "questions.json"), "utf8"));
  data.questions.forEach((q, i) => all.push({ ...q, batch: data.batch, id: ids.get(`${b}:${i}`) }));
}
const acc = all.filter(isAccepted);
const order = new Map(PLAN.map((p, i) => [p.code, i]));
acc.sort((a, b) => order.get(a.st) - order.get(b.st) || parseInt(a.id.split("-")[1]) - parseInt(b.id.split("-")[1]));

// ── TSV / CSV
const COLS = ["Question ID", "Subject", "Topic", "Subtopic", "Priority", "Difficulty", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Solution", "Shortcut Method / Exam Strategy", "Source", "Database Duplicate Check", "Verification Status"];
const rowOf = (q) => { const p = PM.get(q.st); return [q.id, "কম্পিউটার ও তথ্যপ্রযুক্তি", p.topic, `${q.st} ${p.name}`, p.g, q.d, q.q, ...q.o, `${L[q.a]}. ${q.o[q.a]}`, q.e, q.t, q.src, q.dup, q.v]; };
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ");
const csvCell = (s) => `"${clean(s).replace(/"/g, '""')}"`;
const base = "ICT52_ComputerICT_SubtopicWise";
fs.writeFileSync(path.join(OUT, base + ".tsv"), [COLS, ...acc.map(rowOf)].map((r) => r.map(clean).join("\t")).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, base + ".csv"), "﻿" + [COLS, ...acc.map(rowOf)].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");

// ── পরিসংখ্যান
const cnt = (xs, f) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const bySt = cnt(acc, (q) => q.st);
const gaps = PLAN.filter((p) => (bySt[p.code] || 0) !== p.target).map((p) => ({ code: p.code, target: p.target, got: bySt[p.code] || 0 }));
const stats = {
  total: all.length, accepted: acc.length, target: PLAN.reduce((a, p) => a + p.target, 0),
  byPriority: cnt(acc, (q) => PM.get(q.st).g), byDifficulty: cnt(acc, (q) => q.d), answerPosition: cnt(acc, (q) => L[q.a]),
  bySubtopic: bySt, targetMismatch: gaps,
};
fs.writeFileSync(path.join(OUT, "ICT_Final_Statistics.json"), JSON.stringify(stats, null, 2));

// ── Level 2 JSON
const D = { Easy: "easy", Medium: "medium", Hard: "hard" };
const next = {};
const level2 = acc.map((q) => {
  next[q.st] = (next[q.st] || 0) + 1;
  return {
    uid: `T-${q.st}-${String(next[q.st]).padStart(4, "0")}`, subtopic_code: q.st, question: q.q, options: q.o, answer: L[q.a],
    explanation: `${q.e}\nশর্টকাট / পরীক্ষার কৌশল: ${q.t}`, difficulty: D[q.d], source: `${q.id} · ${q.src}`,
  };
});
if (level2.some((r) => !/^[ABCD]$/.test(r.answer) || !r.difficulty || r.options.length !== 4)) throw new Error("bad level2 row");
const dest = process.argv[2];
if (dest) fs.writeFileSync(dest, JSON.stringify(level2, null, 1) + "\n");
console.log(JSON.stringify({ accepted: acc.length, target: stats.target, mismatch: gaps, byPriority: stats.byPriority, answerPosition: stats.answerPosition, wrote: dest || "(none)" }));
