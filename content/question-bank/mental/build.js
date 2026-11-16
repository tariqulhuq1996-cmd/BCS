// একটি ব্যাচ থেকে: মাস্টার-নির্দেশনার ঘরসহ TSV ও CSV, Word ফাইল ও ব্যাচ-প্রতিবেদন (১২টি হিসাব)।
// usage: node build.js <batch-dir>
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageNumber, Footer, LevelFormat,
} = require("../node_modules/docx");
const { computeIds, isAccepted } = require("./ids");

const ROOT = __dirname;
const dir = path.resolve(process.argv[2]);
const bname = path.basename(dir);
const data = JSON.parse(fs.readFileSync(path.join(dir, "questions.json"), "utf8"));
const dup = JSON.parse(fs.readFileSync(path.join(dir, "dupcheck.json"), "utf8"));
const PLAN = new Map(require("./plan.json").map((s) => [s.code, s]));
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const L = ["A", "B", "C", "D"];
const FONT = "Nirmala UI";
const GREEN = "005500", RED = "990000", MUTED = "555555";
const ids = computeIds(ROOT);

// ── প্রতিটি প্রশ্নের চূড়ান্ত অবস্থা
const qs = data.questions.map((q, i) => {
  const p = PLAN.get(q.st);
  const d = dup.rows[i];
  const needsVerify = q.v.startsWith("যাচাই প্রয়োজন");
  const status = q.reject ? `বাতিল (${q.reject})` : needsVerify ? "যাচাই-অপেক্ষমাণ (গণনায় নেই)" : "গৃহীত";
  const lecNote = d.lecMax >= 0.5 ? `; লেকচারের অনুশীলনী (বিসিএস নয়) ${d.lecId}-এর সঙ্গে মিল ${d.lecMax.toFixed(2)}` : "";
  return {
    ...q, i,
    id: ids.get(`${bname}:${i}`),
    topic: p.topic, area: q.ar || p.area, subtopic: `${q.st} ${p.name}`, priority: p.g,
    status, accepted: status === "গৃহীত",
    dupText: `${q.dup} [স্বয়ংক্রিয় মিল: বিগত BCS সর্বোচ্চ ${d.pastMax.toFixed(2)} (${d.pastId})${lecNote}]`,
    sim: d,
  };
});

// ── TSV / CSV (মাস্টার-নির্দেশনার ১৭টি ঘর + চূড়ান্ত অবস্থা)
const COLS = ["Question ID", "Subject", "Topic", "Subtopic", "Priority", "Difficulty", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Solution", "Shortcut Method / Exam Strategy", "Source", "Database Duplicate Check", "Verification Status", "Final Status"];
const rowOf = (q) => [q.id, "মানসিক দক্ষতা (Mental Ability)", q.topic, q.subtopic, q.priority, q.d, q.q, ...q.o, `${L[q.a]}. ${q.o[q.a]}`, q.e, q.t, q.src, q.dupText, q.v, q.status];
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ");
const name = data.batch.replace(/\s+/g, "_");
fs.writeFileSync(path.join(dir, `MEN52_${name}.tsv`), [COLS, ...qs.map(rowOf)].map((r) => r.map(clean).join("\t")).join("\n") + "\n");
const csvCell = (s) => `"${clean(s).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(dir, `MEN52_${name}.csv`), "﻿" + [COLS, ...qs.map(rowOf)].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");

// ── হিসাব (সব ব্যাচ মিলিয়ে)
const TOTAL = 800;
const ALLOC = { A: 451, B: 200, C: 29, D: 120 };
const cum = {};
for (const b of fs.readdirSync(ROOT).filter((n) => /^batch\d+$/.test(n)).sort()) {
  const f = path.join(ROOT, b, "questions.json");
  if (!fs.existsSync(f)) continue;
  const bd = b === bname ? data : JSON.parse(fs.readFileSync(f, "utf8"));
  if (b !== bname && !fs.existsSync(path.join(ROOT, b, "stats.json"))) continue;
  for (const q of bd.questions.filter(isAccepted)) { const g = PLAN.get(q.st).g; cum[g] = (cum[g] || 0) + 1; }
}
const cumTotal = Object.values(cum).reduce((a, b) => a + b, 0);
const histSubs = Object.keys(data.subtopics);
const stats = {
  target: TOTAL, priorityTarget: ALLOC,
  historicalReference: dup.comparedPast,
  coverage: histSubs.map((c) => `${c}: বিগত ${PLAN.get(c).hist200}টি (২০০-নম্বর যুগে)`).join("; "),
  generated: qs.length,
  exact: qs.filter((q) => q.reject === "Exact Duplicate").length,
  semantic: qs.filter((q) => q.reject === "Semantic Duplicate").length,
  near: qs.filter((q) => q.reject === "Near Duplicate").length,
  verify: qs.filter((q) => q.status.startsWith("যাচাই")).length,
  qc: qs.filter((q) => q.reject === "Quality Control").length,
  accepted: qs.filter((q) => q.accepted).length,
  cumulative: cumTotal, remaining: Math.max(0, TOTAL - cumTotal), supplementary: Math.max(0, cumTotal - TOTAL), cumByPriority: cum,
};
fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(stats, null, 2));

// ── Word
const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, ...o });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: 60 }, ...o });
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const table = (head, rows, widths) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
  rows: [head, ...rows].map((r, ri) => new TableRow({
    tableHeader: ri === 0,
    children: r.map((c, ci) => new TableCell({
      width: { size: widths[ci], type: WidthType.DXA },
      borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
      shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E8F0EA" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [para([run(String(c), { bold: ri === 0, size: 19 })], { spacing: { after: 0 } })],
    })),
  })),
});
const questionBlock = (q, n) => {
  const out = [
    para([run(`${n}. `, { bold: true }), run(q.q, { bold: true })], { spacing: { before: 200, after: 40 }, keepNext: true }),
    para([run(`${q.id}  ·  Priority ${q.priority}  ·  ${q.d}`, { size: 18, color: MUTED })], { keepNext: true }),
    ...q.o.map((o, k) => para(`(${L[k]}) ${o}`, { indent: { left: 360 }, spacing: { after: 20 }, keepNext: true })),
    para([run(`Correct Answer: (${L[q.a]}) ${q.o[q.a]}`, { bold: true, color: GREEN })], { spacing: { before: 60, after: 40 } }),
    para([run("সমাধান: ", { bold: true }), run(q.e)]),
    para([run("শর্টকাট / পরীক্ষার কৌশল: ", { bold: true }), run(q.t)]),
    para([run(`Source: ${q.src}  ·  Duplicate Check: ${q.dup}  ·  ${q.v}`, { size: 18, color: MUTED })]),
  ];
  if (!q.accepted && !q.reject) out.push(para([run(`[${q.v}। এ প্রশ্নটি চূড়ান্ত গণনায় ধরা হয়নি।]`, { color: RED })]));
  return out;
};
const kids = [
  para([run("BCS মানসিক দক্ষতা (Mental Ability)", { bold: true, size: 40 })], { alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 } }),
  para([run("৫২তম BCS Preliminary — নতুন MCQ প্রশ্নব্যাংক", { size: 28 })], { alignment: AlignmentType.CENTER }),
  para([run(`${data.batch}: ${data.basis}`, { size: 24, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
];
for (const code of histSubs) {
  const st = PLAN.get(code);
  const list = qs.filter((q) => q.st === code && !q.reject);
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(st.name)] }));
  kids.push(para([run(`${st.area} · ${code} · Priority ${st.g} · লক্ষ্য ${bn(st.target)}টি`, { color: MUTED })]));
  list.forEach((q, k) => kids.push(...questionBlock(q, k + 1)));
}
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(`${data.batch}: প্রতিবেদন`)] }));
const S = stats;
kids.push(table(["ক্রম", "বিষয়", "সংখ্যা"], [
  ["১", "Total Target (Mental Ability)", bn(S.target)],
  ["২", "Priority-wise Target", `A ${bn(ALLOC.A)} · B ${bn(ALLOC.B)} · C ${bn(ALLOC.C)} · D ${bn(ALLOC.D)}`],
  ["৩", "Historical BCS Questions (Reference Only)", `${bn(S.historicalReference)}টি (গণনায় নেই)`],
  ["৪", "Existing Database Coverage", S.coverage],
  ["৫", "New Questions Generated (এ ব্যাচে)", bn(S.generated)],
  ["৬", "Exact Duplicate Rejected", bn(S.exact)],
  ["৭", "Semantic Duplicate Rejected", bn(S.semantic)],
  ["৮", "Near Duplicate Rejected", bn(S.near)],
  ["৯", "Verification Required", bn(S.verify)],
  ["১০", "Quality Control Rejected", bn(S.qc)],
  ["১১", "Final Accepted New Questions (এ ব্যাচে)", bn(S.accepted)],
  ["১২", "Remaining Questions", `${bn(S.remaining)} (মোট গৃহীত ${bn(S.cumulative)}${S.supplementary ? ` = মূল ${bn(TOTAL)} + সিলেবাস-ফাঁক পূরণের সম্পূরক ${bn(S.supplementary)}` : ""})`],
], [900, 4200, 3900]));
const rej = qs.filter((q) => q.reject);
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("বাতিল প্রশ্ন")] }));
kids.push(table(["ID", "Question", "কারণ"], rej.length ? rej.map((q) => [q.id, q.q, q.dup]) : [["—", "কোনো প্রশ্ন বাতিল হয়নি", "—"]], [1700, 3900, 3400]));
const ver = qs.filter((q) => !q.reject && q.v !== "যাচাইকৃত");
if (ver.length) {
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("যাচাই-অপেক্ষমাণ")] }));
  kids.push(table(["ID", "অবস্থা"], ver.map((q) => [q.id, q.v]), [2200, 6800]));
}
const doc = new Document({
  creator: "BCS 52 Question Bank", title: `BCS Mental Ability — ${data.batch}`,
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true, color: GREEN }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("পৃষ্ঠা ", { size: 18, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: MUTED })] })] }) },
    children: kids,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(dir, `MEN52_${name}.docx`), buf);
  const { coverage, ...short } = stats;
  console.log(JSON.stringify(short));
});
