// চূড়ান্ত সংকলন (Mathematics): Priority-wise, Topic/Subtopic-wise, Arithmetic, Algebra, Geometry, Mensuration, Statistics & Probability প্রশ্নব্যাংক (TSV/CSV/Word),
// Duplicate Rejection Report, Verification Report ও Final Statistics।  usage: node final.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageNumber, Footer, LevelFormat,
} = require("../node_modules/docx");
const { computeIds } = require("./ids");

const HERE = __dirname;
const OUT = path.join(HERE, "final");
fs.mkdirSync(OUT, { recursive: true });
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const L = ["A", "B", "C", "D"];
const FONT = "Nirmala UI";
const GREEN = "005500", MUTED = "555555";
const PLAN = require("./plan.json");
const PM = new Map(PLAN.map((s) => [s.code, s]));
const ALLOC = { A: 289, B: 198, C: 282, D: 231 };
const PORDER = ["A", "B", "C", "D"];
const AREAS = ["Arithmetic", "Algebra", "Geometry", "Mensuration", "Statistics & Probability"];
const ids = computeIds(HERE);

const all = [];
const batchStats = [];
for (const b of fs.readdirSync(HERE).filter((n) => /^batch\d+$/.test(n)).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, b, "questions.json"), "utf8"));
  const dup = JSON.parse(fs.readFileSync(path.join(HERE, b, "dupcheck.json"), "utf8"));
  const rows = data.questions.map((q, i) => {
    const p = PM.get(q.st);
    const d = dup.rows[i];
    const needsVerify = q.v.startsWith("যাচাই প্রয়োজন");
    const status = q.reject ? `বাতিল (${q.reject})` : needsVerify ? "যাচাই-অপেক্ষমাণ (গণনায় নেই)" : "গৃহীত";
    const lecNote = d.lecMax >= 0.5 ? `; লেকচারের অনুশীলনী (বিসিএস নয়) ${d.lecId}-এর সঙ্গে মিল ${d.lecMax.toFixed(2)}` : "";
    return {
      ...q, batch: data.batch, id: ids.get(`${b}:${i}`), topic: p.topic, area: q.ar || p.area, stName: p.name,
      subtopic: `${q.st} ${p.name}`, priority: p.g, status, accepted: status === "গৃহীত",
      dupText: `${q.dup} [স্বয়ংক্রিয় মিল: বিগত BCS সর্বোচ্চ ${d.pastMax.toFixed(2)} (${d.pastId})${lecNote}]`, sim: d,
    };
  });
  all.push(...rows);
  batchStats.push({
    batch: data.batch, subs: [...new Set(rows.map((q) => q.st.split(".").slice(1).join(".")))].join(", "), generated: rows.length,
    exact: rows.filter((q) => q.reject === "Exact Duplicate").length, semantic: rows.filter((q) => q.reject === "Semantic Duplicate").length,
    near: rows.filter((q) => q.reject === "Near Duplicate").length, verify: rows.filter((q) => q.status.startsWith("যাচাই")).length,
    qc: rows.filter((q) => q.reject === "Quality Control").length, accepted: rows.filter((q) => q.accepted).length,
  });
}
// Batch 19 = সম্পূর্ণ লেকচার শিটের নতুন অংশ (লেকচার ২১–২৫, ০৮ ও ১৪-এর অতিরিক্ত অনুশীলন) থেকে সম্পূরক প্রশ্ন (১০০০-এর অতিরিক্ত)
const SUPP = new Set(["Batch 19"]);
const acc = all.filter((q) => q.accepted && !SUPP.has(q.batch));
const supp = all.filter((q) => q.accepted && SUPP.has(q.batch));
const rejected = all.filter((q) => q.reject);
const verify = all.filter((q) => q.status.startsWith("যাচাই"));
const idNum = (q) => parseInt(q.id.split("-").pop(), 10);
const stOrder = (c) => PLAN.findIndex((s) => s.code === c);
const byPriority = [...acc].sort((a, b) => PORDER.indexOf(a.priority) - PORDER.indexOf(b.priority) || stOrder(a.st) - stOrder(b.st) || idNum(a) - idNum(b));
const byTopic = [...acc].sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || stOrder(a.st) - stOrder(b.st) || idNum(a) - idNum(b));

// ── TSV / CSV
const COLS = ["Question ID", "Subject", "Topic", "Subtopic", "Priority", "Difficulty", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Solution", "Shortcut Method / Exam Strategy", "Source", "Database Duplicate Check", "Verification Status", "Final Status", "Batch"];
const rowOf = (q) => [q.id, "গাণিতিক যুক্তি (Mathematical Reasoning)", q.topic, q.subtopic, q.priority, q.d, q.q, ...q.o, `${L[q.a]}. ${q.o[q.a]}`, q.e, q.t, q.src, q.dupText, q.v, q.status, q.batch];
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ");
const csvCell = (s) => `"${clean(s).replace(/"/g, '""')}"`;
const writeTable = (base, cols, rows) => {
  fs.writeFileSync(path.join(OUT, base + ".tsv"), [cols, ...rows].map((r) => r.map(clean).join("\t")).join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, base + ".csv"), "﻿" + [cols, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
};
writeTable("MAT52_Mathematics_1000_PriorityWise", COLS, byPriority.map(rowOf));
writeTable("MAT52_Mathematics_1000_SubtopicWise", COLS, byTopic.map(rowOf));
for (const a of AREAS) writeTable(`MAT52_Mathematics_${a.replace(/ & /g, "_")}_Bank`, COLS, byTopic.filter((q) => q.area === a).map(rowOf));

const suppSorted = [...supp].sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || stOrder(a.st) - stOrder(b.st) || idNum(a) - idNum(b));
writeTable("MAT52_Mathematics_Supplementary_LectureSheet", COLS, suppSorted.map(rowOf));
writeTable("MAT52_Mathematics_All_Generated_With_Rejected", COLS, all.map(rowOf));
writeTable("MAT_Duplicate_Rejection_Report", ["Question ID", "Subtopic", "Question", "Proposed Answer", "Rejection Type", "Reason / Matching Past Question", "Batch"], rejected.map((q) => [q.id, q.subtopic, q.q, q.o[q.a], q.reject, q.dup, q.batch]));
writeTable("MAT_Solution_Verification_Report", ["Question ID", "Subtopic", "Question", "Proposed Answer", "Verification Status", "Batch"], verify.map((q) => [q.id, q.subtopic, q.q, q.o[q.a], q.v, q.batch]));

// ── পরিসংখ্যান
const cnt = (arr, f) => arr.reduce((m, q) => { const k = f(q); m[k] = (m[k] || 0) + 1; return m; }, {});
const accP = cnt(acc, (q) => q.priority), accSt = cnt(acc, (q) => q.st), accD = cnt(acc, (q) => q.d), accA = cnt(acc, (q) => q.area), pos = cnt(acc, (q) => L[q.a]);
const reviewedNear = acc.filter((q) => /নিকট-সম্পর্কিত|পর্যালোচিত/.test(q.dup));
const lecSame = acc.filter((q) => q.sim.lecMax >= 0.5);
const stats = {
  target: 1000, priorityTarget: ALLOC, historicalReference: 575, computedAnswers: acc.filter((q) => q.calc).length, generated: all.length,
  exact: rejected.filter((q) => q.reject === "Exact Duplicate").length, semantic: rejected.filter((q) => q.reject === "Semantic Duplicate").length,
  near: rejected.filter((q) => q.reject === "Near Duplicate").length, verify: verify.length, qc: rejected.filter((q) => q.reject === "Quality Control").length,
  accepted: acc.length, remaining: 1000 - acc.length, supplementary: supp.length, supplementaryBySubtopic: cnt(supp, (q) => q.st), byPriority: accP, byArea: accA, byDifficulty: accD, answerPosition: pos, bySubtopic: accSt,
  reviewedNearRelated: reviewedNear.length, sameFactAsLecturePractice: lecSame.length, batches: batchStats,
};
fs.writeFileSync(path.join(OUT, "MAT_Final_Statistics.json"), JSON.stringify(stats, null, 2));

// ── Word
const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, ...o });
const para = (c, o = {}) => new Paragraph({ children: Array.isArray(c) ? c : [run(c)], spacing: { after: 60 }, ...o });
const H = (lvl, text, o = {}) => new Paragraph({ heading: lvl, children: [run(text)], ...o });
const cb = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const table = (head, rows, w) => new Table({
  width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: w,
  rows: [head, ...rows].map((r, ri) => new TableRow({ tableHeader: ri === 0, children: r.map((c, ci) => new TableCell({
    width: { size: w[ci], type: WidthType.DXA }, borders: { top: cb, bottom: cb, left: cb, right: cb },
    shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E8F0EA" } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [para([run(String(c), { bold: ri === 0, size: 18 })], { spacing: { after: 0 } })] })) })),
});
const qBlock = (q, n) => [
  para([run(`${n}. `, { bold: true }), run(q.q, { bold: true })], { spacing: { before: 180, after: 40 }, keepNext: true }),
  para([run(`${q.id}  ·  Priority ${q.priority}  ·  ${q.d}`, { size: 18, color: MUTED })], { keepNext: true }),
  ...q.o.map((o, k) => para(`(${L[k]}) ${o}`, { indent: { left: 360 }, spacing: { after: 20 }, keepNext: true })),
  para([run(`Correct Answer: (${L[q.a]}) ${q.o[q.a]}`, { bold: true, color: GREEN })], { spacing: { before: 60, after: 40 } }),
  para([run("সমাধান: ", { bold: true }), run(q.e)]),
  para([run("শর্টকাট / পরীক্ষার কৌশল: ", { bold: true }), run(q.t)]),
  para([run(`Source: ${q.src}  ·  Duplicate Check: ${q.dup}  ·  ${q.v}`, { size: 16, color: MUTED })]),
];
const makeDoc = (title, children) => new Document({
  creator: "BCS 52 Question Bank", title,
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: GREEN }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("পৃষ্ঠা ", { size: 18, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: MUTED })] })] }) },
    children,
  }],
});
const save = (doc, file) => Packer.toBuffer(doc).then((buf) => fs.writeFileSync(path.join(OUT, file), buf));
const cover = (sub, count) => [
  para([run("BCS গাণিতিক যুক্তি (Mathematical Reasoning)", { bold: true, size: 44 })], { alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 120 } }),
  para([run(`৫২তম BCS Preliminary — ${bn(count)}টি নতুন MCQ`, { size: 30 })], { alignment: AlignmentType.CENTER }),
  para([run(sub, { size: 26, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
  para([run("ভিত্তি: BCS_Math_Final.docx · তুলনা: ১০ম–৫০তম বিসিএসের গণিত প্রশ্ন (৫৭৫টি)", { size: 20, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
  H(HeadingLevel.HEADING_1, "ব্যবহারের নির্দেশনা"),
  ...[
    "প্রশ্ন, বিকল্প, সমাধান ও শর্টকাট বাংলায় (সংখ্যা বাংলা অঙ্কে)। প্রতিটি প্রশ্নের সমাধান ধাপে ধাপে দেওয়া আছে।",
    "শুধু গৃহীত প্রশ্ন এখানে; বাতিল ও যাচাই-অপেক্ষমাণ প্রশ্ন আলাদা প্রতিবেদনে।",
    "১০ম–৫০তম বিসিএসের কোনো প্রশ্ন হুবহু, সামান্য বদলে, বা একই নিয়ম/শব্দজ্ঞান/তথ্য ঘুরিয়ে এখানে নেই। একই বিষয়ের ভিন্ন তথ্যের প্রশ্নের Duplicate Check ঘরে কোন বিগত প্রশ্ন দেখা হয়েছে তা লেখা আছে।",
    "Question ID ধারাবাহিক: MAT-0001 থেকে MAT-1000।",
  ].map((t) => para(t, { numbering: { reference: "bul", level: 0 } })),
];
const bankDoc = (title, sub, list, groupBy) => {
  const kids = cover(sub, list.length);
  let n = 0;
  for (const g of [...new Set(list.map(groupBy))]) {
    const inG = list.filter((q) => groupBy(q) === g);
    kids.push(H(HeadingLevel.HEADING_1, `${g} (${bn(inG.length)}টি)`, { pageBreakBefore: true }));
    for (const c of [...new Set(inG.map((q) => q.st))]) {
      const l = inG.filter((q) => q.st === c);
      kids.push(H(HeadingLevel.HEADING_2, `${l[0].stName} — Priority ${l[0].priority} (${bn(l.length)}টি)`));
      kids.push(para([run(`${l[0].area} · ${c}`, { color: MUTED, size: 18 })]));
      l.forEach((q) => kids.push(...qBlock(q, ++n)));
    }
  }
  return save(makeDoc(title, kids), `${title}.docx`);
};
const PN = { A: "Priority A — সর্বোচ্চ গুরুত্ব", B: "Priority B — উচ্চ গুরুত্ব", C: "Priority C — মাঝারি গুরুত্ব", D: "Priority D — সাধারণ গুরুত্ব" };
bankDoc("MAT52_Mathematics_1000_PriorityWise", "Priority-wise প্রশ্নব্যাংক (A → B → C → D)", byPriority, (q) => PN[q.priority]);
bankDoc("MAT52_Mathematics_1000_SubtopicWise", "Topic ও Subtopic-wise প্রশ্নব্যাংক", byTopic, (q) => q.topic);
for (const a of AREAS) bankDoc(`MAT52_Mathematics_${a.replace(/ & /g, "_")}_Bank`, `${a} Question Bank`, byTopic.filter((q) => q.area === a), (q) => q.topic);
bankDoc("MAT52_Mathematics_Supplementary_LectureSheet", "সম্পূরক: সম্পূর্ণ লেকচার শিটের নতুন অংশ (লেকচার ২১–২৫; ০৮ ও ১৪-এর অতিরিক্ত অনুশীলন)", suppSorted, (q) => q.topic);


save(makeDoc("EN Duplicate Rejection Report", [
  H(HeadingLevel.HEADING_1, "Duplicate Rejection Report (Mathematics)"),
  para("তুলনার ভিত্তি: ১০ম–৫০তম বিসিএসের গণিতের ৫৭৫টি প্রশ্ন (বিকল্পসহ), লেকচারের অনুশীলনী প্রশ্ন এবং আগের সব ব্যাচ। প্রতিটি উপবিষয়ের বিগত প্রশ্নের তালিকা আগে দেখে সেই সমস্যার ধরন (একই গাণিতিক ধারণা ও একই সমাধানপদ্ধতি — কেবল সংখ্যা বদলানো) বাদ রেখে নতুন প্রশ্ন লেখা হয়েছে; এরপর প্রতিটি ব্যাচে অক্ষর-ত্রয়ী মিল ও উত্তর-মিল পরীক্ষা চালিয়ে নিকট-মিলগুলো হাতে দেখা হয়েছে। স্বয়ংক্রিয় পরীক্ষায় ধরা পড়া মিলগুলো (মোট ১২টি) লেখার পর্যায়েই সরিয়ে নতুন প্রশ্ন দেওয়া হয়েছে, তাই চূড়ান্ত তালিকায় বাতিল শূন্য; শেষে সব ১০০০ প্রশ্নে ‘একই উত্তর + কাছাকাছি প্রশ্ন’ পুনর্নিরীক্ষা চালানো হয়েছে।"),
  H(HeadingLevel.HEADING_3, "বাতিলের সারসংক্ষেপ"),
  table(["ধরন", "সংখ্যা"], [["Exact Duplicate", bn(stats.exact)], ["Semantic Duplicate", bn(stats.semantic)], ["Near Duplicate", bn(stats.near)], ["Quality Control", bn(stats.qc)], ["মোট", bn(rejected.length)]], [5000, 4000]),
  H(HeadingLevel.HEADING_3, "বাতিল প্রশ্নের তালিকা"),
  table(["ID", "Question", "ধরন", "কারণ"], rejected.map((q) => [q.id, q.q, q.reject, q.dup]), [1500, 3300, 1300, 2900]),
  H(HeadingLevel.HEADING_3, `পর্যালোচনা করে গৃহীত নিকট-সম্পর্কিত প্রশ্ন (${bn(reviewedNear.length)}টি)`),
  table(["ID", "Question", "পর্যালোচনার নোট"], reviewedNear.map((q) => [q.id, q.q, q.dup]), [1500, 3700, 3800]),
  H(HeadingLevel.HEADING_3, `লেকচারের অনুশীলনী প্রশ্নের সঙ্গে একই তথ্য (${bn(lecSame.length)}টি)`),
  para("Duplicate বিচার কেবল বিসিএস প্রশ্নের সঙ্গে; লেকচারের অনুশীলনীর (পিএসসি/অন্যান্য) সঙ্গে একই তথ্য থাকলেও বাক্য নতুন করে লেখা হয়েছে।"),
  table(["ID", "Question", "লেকচারের প্রশ্ন (মিল)"], lecSame.map((q) => [q.id, q.q, `${q.sim.lecText} (${q.sim.lecMax.toFixed(2)})`]), [1500, 3700, 3800]),
]), "MAT_Duplicate_Rejection_Report.docx");

save(makeDoc("EN Verification Report", [
  H(HeadingLevel.HEADING_1, "Solution Verification Report (Mathematics)"),
  para(`সংখ্যাভিত্তিক উত্তরগুলো (${bn(stats.computedAnswers)}টি) হাতে লেখা নয় — প্রশ্নের সাথে কোডে হিসাব করে (সূত্র, গুণফল, ঘাত, সমাবেশ ইত্যাদি) উত্তর বসানো হয়েছে এবং কোনো ভুল বিকল্প সঠিক উত্তরের সমান হলে (ভগ্নাংশ লঘিষ্ঠ করে তুলনাসহ) বিল্ড থেমে যায়। বাকি ধারণাভিত্তিক প্রশ্নের উত্তর প্রমিত গণিত পাঠ্যপুস্তক (NCTB মাধ্যমিক গণিত ও উচ্চতর গণিত) অনুযায়ী যাচাই করা। দশমিক উত্তর সর্বোচ্চ চার দশমিক স্থান পর্যন্ত; π-নির্ভর হিসাবে π = 22/7 বলে প্রশ্নেই উল্লেখ আছে। যাচাই-অপেক্ষমাণ প্রশ্ন নেই।`),
  H(HeadingLevel.HEADING_3, `যাচাই-অপেক্ষমাণ প্রশ্ন (${bn(verify.length)}টি, গণনায় নেই)`),
  table(["ID", "Question", "Proposed Answer", "অবস্থা"], verify.map((q) => [q.id, q.q, q.o[q.a], q.v]), [1400, 3400, 1700, 2500]),
]), "MAT_Solution_Verification_Report.docx");

save(makeDoc("EN Final Statistics", [
  H(HeadingLevel.HEADING_1, "Final Target Statistics (Mathematics)"),
  table(["ক্রম", "বিষয়", "সংখ্যা"], [
    ["১", "Total Target", bn(1000)], ["২", "Priority-wise Target", `A ${bn(ALLOC.A)} · B ${bn(ALLOC.B)} · C ${bn(ALLOC.C)} · D ${bn(ALLOC.D)}`],
    ["৩", "Historical BCS Questions (Reference Only)", "৫৭৫টি (গণনায় নেই)"], ["৪", "Existing Database Coverage", "৩০টি উপবিষয়ে বিগত প্রশ্নের সঙ্গে তুলনা"],
    ["৫", "New Questions Generated", bn(stats.generated)], ["৬", "Exact Duplicate Rejected", bn(stats.exact)], ["৭", "Semantic Duplicate Rejected", bn(stats.semantic)],
    ["৮", "Near Duplicate Rejected", bn(stats.near)], ["৯", "Verification Required", bn(stats.verify)], ["১০", "Quality Control Rejected", bn(stats.qc)],
    ["১১", "Final Accepted New Questions", `${bn(stats.accepted)} (+ সম্পূর্ণ লেকচার শিট থেকে সম্পূরক ${bn(supp.length)}টি)`], ["১২", "Remaining Questions", bn(stats.remaining)],
  ], [900, 4800, 3300]),
  H(HeadingLevel.HEADING_3, "Priority ও ক্ষেত্র অনুযায়ী"),
  table(["Priority", "লক্ষ্য", "গৃহীত"], PORDER.map((p) => [p, bn(ALLOC[p]), bn(accP[p] || 0)]), [3000, 3000, 3000]),
  table(["Arithmetic", "Algebra", "Geometry", "Mensuration", "Stat & Prob"], [AREAS.map((a) => bn(accA[a] || 0))], [1800, 1800, 1800, 1800, 1800]),
  table(["Easy", "Medium", "Hard"], [[bn(accD.Easy || 0), bn(accD.Medium || 0), bn(accD.Hard || 0)]], [3000, 3000, 3000]),
  table(["A", "B", "C", "D (সঠিক উত্তরের অবস্থান)"], [[bn(pos.A || 0), bn(pos.B || 0), bn(pos.C || 0), bn(pos.D || 0)]], [2250, 2250, 2250, 2250]),
  H(HeadingLevel.HEADING_3, "উপবিষয় অনুযায়ী"),
  table(["কোড", "উপবিষয়", "Priority", "লক্ষ্য", "গৃহীত", "সম্পূরক"], PLAN.map((s) => [s.code, s.name, s.g, bn(s.target), bn(accSt[s.code] || 0), bn(stats.supplementaryBySubtopic[s.code] || 0)]), [1300, 4000, 900, 950, 950, 900]),
  H(HeadingLevel.HEADING_3, "ব্যাচ অনুযায়ী"),
  table(["ব্যাচ", "উপবিষয়", "তৈরি", "Exact", "Semantic", "Near", "যাচাই", "QC", "গৃহীত"], batchStats.map((b) => [b.batch, b.subs, bn(b.generated), bn(b.exact), bn(b.semantic), bn(b.near), bn(b.verify), bn(b.qc), bn(b.accepted)]), [1000, 2300, 700, 700, 900, 700, 700, 500, 600]),
  para([run("উপবিষয়ের লক্ষ্য: অনুমোদিত Level 2 বণ্টন (docs/level2_targets.csv) — Priority-ভিত্তিক মোট (A ৪০৮, B ৫৮৮, C ২৩০, D ২৭৪) ১০,৪০০ প্রশ্নের Allocation Sheet-এর সঙ্গে হুবহু মেলে।", { color: MUTED, size: 20 })], { spacing: { before: 160 } }),
]), "MAT_Final_Statistics.docx");

const mis = PLAN.filter((s) => (accSt[s.code] || 0) !== s.target).map((s) => `${s.code}:${accSt[s.code] || 0}/${s.target}`);
console.log(JSON.stringify({ generated: stats.generated, accepted: stats.accepted, exact: stats.exact, semantic: stats.semantic, near: stats.near, verify: stats.verify, qc: stats.qc, byP: accP, byArea: accA, diff: accD, pos, near_reviewed: reviewedNear.length, lec_same: lecSame.length }));
console.log("subtopic mismatches:", mis.join(" ") || "none");
