// চূড়ান্ত সংকলন: সব ব্যাচ মিলিয়ে Priority-wise ও Topic/Subtopic-wise প্রশ্নব্যাংক (TSV/CSV/Word),
// Duplicate Rejection Report, Verification Report ও Final Statistics।  usage: node final.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageNumber, Footer, LevelFormat,
} = require("../node_modules/docx");

const HERE = __dirname;
const OUT = path.join(HERE, "final");
fs.mkdirSync(OUT, { recursive: true });
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const L = ["ক", "খ", "গ", "ঘ"];
const FONT = "Nirmala UI";
const GREEN = "005500", RED = "990000", MUTED = "555555";
const short = (c) => { const p = c.split("."); return p[2] === "OTH" ? p[1] + p[2] : p[2]; };
const plan = require("./plan.json");
const PLAN = new Map((plan.subtopics || plan).map((s) => [s.code, s]));
const ALLOC = { A: 630, B: 330, C: 318, D: 222 };
const PORDER = ["A", "B", "C", "D"];

// ── সব ব্যাচ পড়া (build.js-এর একই নিয়মে ID ও অবস্থা)
const batches = fs.readdirSync(HERE).filter((n) => /^batch\d+$/.test(n)).sort();
const all = [];
const batchStats = [];
const targets = {};
const audit = fs.existsSync(path.join(HERE, "audit.json")) ? JSON.parse(fs.readFileSync(path.join(HERE, "audit.json"), "utf8")) : [];
for (const b of batches) {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, b, "questions.json"), "utf8"));
  const dup = JSON.parse(fs.readFileSync(path.join(HERE, b, "dupcheck.json"), "utf8"));
  const counters = {};
  const rows = data.questions.map((q, i) => {
    const st = data.subtopics[q.st];
    targets[q.st] = st.target;
    counters[q.st] = (counters[q.st] || 0) + 1;
    const d = dup.rows[i];
    const needsVerify = q.v.startsWith("যাচাই প্রয়োজন");
    const status = q.reject ? `বাতিল (${q.reject})` : needsVerify ? "যাচাই-অপেক্ষমাণ (গণনায় নেই)" : "গৃহীত";
    const lecNote = d.lecMax >= 0.5 ? `; লেকচারের অনুশীলনী (বিসিএস নয়) ${d.lecId}-এর সঙ্গে একই তথ্য (মিল ${d.lecMax.toFixed(2)})` : "";
    const p = PLAN.get(q.st) || {};
    return {
      ...q, batch: data.batch, bdir: b, n: i + 1,
      id: `BN52-${short(q.st)}-${String(counters[q.st] + ((data.idStart || {})[q.st] || 1) - 1).padStart(3, "0")}`,
      topic: p.topic || st.topic, stName: st.name, subtopic: `${q.st} ${st.name}`, priority: st.priority,
      status, accepted: status === "গৃহীত",
      dupText: `${q.dup} [স্বয়ংক্রিয় মিল: বিগত বিসিএস সর্বোচ্চ ${d.pastMax.toFixed(2)} (${d.pastId})${lecNote}]`,
      sim: d,
    };
  });
  all.push(...rows);
  const subs = Object.keys(data.subtopics).map((c) => short(c)).join(", ");
  batchStats.push({
    batch: data.batch, subs, generated: rows.length,
    exact: rows.filter((q) => q.reject === "Exact Duplicate").length,
    semantic: rows.filter((q) => q.reject === "Semantic Duplicate").length,
    near: rows.filter((q) => q.reject === "Near Duplicate").length,
    verify: rows.filter((q) => q.status.startsWith("যাচাই")).length,
    qc: rows.filter((q) => q.reject === "Quality Control").length,
    accepted: rows.filter((q) => q.accepted).length,
  });
}
const ids = new Set();
for (const q of all) { if (ids.has(q.id)) throw new Error("duplicate ID " + q.id); ids.add(q.id); }
const acc = all.filter((q) => q.accepted);
const rejected = all.filter((q) => q.reject);
const verify = all.filter((q) => q.status.startsWith("যাচাই"));

const idNum = (q) => parseInt(q.id.split("-").pop(), 10);
const stOrder = (code) => (plan.subtopics || plan).findIndex((s) => s.code === code);
const byPriority = [...acc].sort((a, b) => PORDER.indexOf(a.priority) - PORDER.indexOf(b.priority) || stOrder(a.st) - stOrder(b.st) || idNum(a) - idNum(b));
const TOPICS = ["বাংলা সাহিত্য", "ভাষা ও ব্যাকরণ"];
const byTopic = [...acc].sort((a, b) => TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic) || a.stName.localeCompare(b.stName, "bn") || idNum(a) - idNum(b));

// ── TSV / CSV
const COLS = ["Question ID", "বিষয়", "Topic", "Subtopic", "Priority", "Difficulty", "প্রশ্ন", "ক", "খ", "গ", "ঘ", "সঠিক উত্তর", "ব্যাখ্যা", "পরীক্ষার কৌশল / মনে রাখার সূত্র", "Source", "Database Duplicate Check", "Verification Status", "চূড়ান্ত অবস্থা", "ব্যাচ"];
const rowOf = (q) => [q.id, "বাংলা ভাষা ও সাহিত্য", q.topic, q.subtopic, q.priority, q.d, q.q, ...q.o, `${L[q.a]}. ${q.o[q.a]}`, q.e, q.t, q.src, q.dupText, q.v, q.status, q.batch];
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ");
const csvCell = (s) => `"${clean(s).replace(/"/g, '""')}"`;
const writeTable = (base, cols, rows) => {
  fs.writeFileSync(path.join(OUT, base + ".tsv"), [cols, ...rows].map((r) => r.map(clean).join("\t")).join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, base + ".csv"), "﻿" + [cols, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
};
writeTable("BN52_Bangla_1500_PriorityWise", COLS, byPriority.map(rowOf));
writeTable("BN52_Bangla_1500_SubtopicWise", COLS, byTopic.map(rowOf));
writeTable("BN52_Bangla_All_Generated_With_Rejected", COLS, all.map(rowOf));
writeTable("Duplicate_Rejection_Report", ["Question ID", "Subtopic", "প্রশ্ন", "প্রস্তাবিত উত্তর", "বাতিলের ধরন", "কারণ / মিলে যাওয়া বিগত প্রশ্ন", "ব্যাচ"], rejected.map((q) => [q.id, q.subtopic, q.q, q.o[q.a], q.reject, q.dup, q.batch]));
writeTable("Verification_Report", ["Question ID", "Subtopic", "প্রশ্ন", "প্রস্তাবিত উত্তর", "যাচাইয়ের অবস্থা", "ব্যাচ"], verify.map((q) => [q.id, q.subtopic, q.q, q.o[q.a], q.v, q.batch]));

// ── পরিসংখ্যান
const cnt = (arr, f) => arr.reduce((m, q) => { const k = f(q); m[k] = (m[k] || 0) + 1; return m; }, {});
const accP = cnt(acc, (q) => q.priority);
const accSt = cnt(acc, (q) => q.st);
const accD = cnt(acc, (q) => q.d);
const ansPos = cnt(acc, (q) => L[q.a]);
const reviewedNear = acc.filter((q) => /নিকট-সম্পর্কিত|পর্যালোচিত/.test(q.dup));
const lecSame = acc.filter((q) => q.sim.lecMax >= 0.5);
const stats = {
  target: 1500, priorityTarget: ALLOC,
  generated: all.length,
  exact: rejected.filter((q) => q.reject === "Exact Duplicate").length,
  semantic: rejected.filter((q) => q.reject === "Semantic Duplicate").length,
  near: rejected.filter((q) => q.reject === "Near Duplicate").length,
  verify: verify.length,
  qc: rejected.filter((q) => q.reject === "Quality Control").length,
  accepted: acc.length,
  remaining: 1500 - acc.length,
  acceptedByPriority: accP, acceptedByDifficulty: accD, answerPosition: ansPos,
  acceptedBySubtopic: accSt, subtopicTargets: targets,
  reviewedNearRelated: reviewedNear.length, sameFactAsLecturePractice: lecSame.length,
  auditFlagsRemaining: audit.length,
  batches: batchStats,
};
fs.writeFileSync(path.join(OUT, "Final_Statistics.json"), JSON.stringify(stats, null, 2));

// ── Word সহায়ক
const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, ...o });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: 60 }, ...o });
const H = (lvl, text, o = {}) => new Paragraph({ heading: lvl, children: [run(text)], ...o });
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const table = (head, rows, widths) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: widths,
  rows: [head, ...rows].map((r, ri) => new TableRow({
    tableHeader: ri === 0,
    children: r.map((c, ci) => new TableCell({
      width: { size: widths[ci], type: WidthType.DXA },
      borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
      shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E8F0EA" } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: [para([run(String(c), { bold: ri === 0, size: 18 })], { spacing: { after: 0 } })],
    })),
  })),
});
const questionBlock = (q, n) => [
  para([run(`প্রশ্ন ${bn(n)}। `, { bold: true }), run(q.q, { bold: true })], { spacing: { before: 180, after: 40 }, keepNext: true }),
  para([run(`${q.id}  ·  Priority ${q.priority}  ·  ${q.d}`, { size: 18, color: MUTED })], { keepNext: true }),
  ...q.o.map((o, k) => para(`${L[k]}. ${o}`, { indent: { left: 360 }, spacing: { after: 20 }, keepNext: true })),
  para([run(`সঠিক উত্তর: ${L[q.a]}. ${q.o[q.a]}`, { bold: true, color: GREEN })], { spacing: { before: 60, after: 40 } }),
  para([run("ব্যাখ্যা: ", { bold: true }), run(q.e)]),
  para([run("মনে রাখার সূত্র: ", { bold: true }), run(q.t)]),
  para([run(`উৎস: ${q.src}  ·  Duplicate Check: ${q.dup}  ·  ${q.v}`, { size: 16, color: MUTED })]),
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
const cover = (sub) => [
  para([run("বিসিএস বাংলা ভাষা ও সাহিত্য", { bold: true, size: 44 })], { alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 120 } }),
  para([run("৫২তম BCS Preliminary — ১৫০০টি নতুন MCQ", { size: 30 })], { alignment: AlignmentType.CENTER }),
  para([run(sub, { size: 26, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
  para([run("ভিত্তি: BCS_Bangla_Lecture_01-20_Final.docx · তুলনা: ১০ম–৫০তম বিসিএসের বাংলা প্রশ্ন", { size: 20, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
  H(HeadingLevel.HEADING_1, "ব্যবহারের নির্দেশনা"),
  ...[
    "এখানে কেবল গৃহীত ১৫০০টি প্রশ্ন আছে। বাতিল ও যাচাই-অপেক্ষমাণ প্রশ্ন আলাদা প্রতিবেদনে।",
    "প্রতিটি প্রশ্নের নিচে সঠিক উত্তর (সবুজ), ব্যাখ্যা ও মনে রাখার সূত্র; ছোট লেখায় Question ID, Priority, Difficulty, উৎস, Duplicate Check ও যাচাইয়ের অবস্থা।",
    "১০ম–৫০তম বিসিএসের কোনো প্রশ্ন হুবহু, সামান্য বদলে বা একই তথ্য ঘুরিয়ে এখানে নেই। একই বিষয়ের ভিন্ন তথ্যের প্রশ্নের Duplicate Check ঘরে কোন বিগত প্রশ্ন দেখা হয়েছে তা লেখা আছে।",
    "সব ১৪টি ঘরসহ পূর্ণ তথ্য TSV/CSV ফাইলে; Excel বা Google Sheets-এ সরাসরি খোলা যাবে।",
  ].map((t) => para(t, { numbering: { reference: "bul", level: 0 } })),
];
const PNAME = { A: "Priority A — সর্বোচ্চ গুরুত্ব", B: "Priority B — উচ্চ গুরুত্ব", C: "Priority C — মাঝারি গুরুত্ব", D: "Priority D — সাধারণ গুরুত্ব" };

// ── ১. Priority-wise ব্যাংক
{
  const kids = cover("Priority-wise প্রশ্নব্যাংক (A → B → C → D)");
  kids.push(table(["Priority", "লক্ষ্য", "গৃহীত"], PORDER.map((p) => [p, bn(ALLOC[p]), bn(accP[p] || 0)]), [3000, 3000, 3000]));
  let n = 0;
  for (const p of PORDER) {
    kids.push(H(HeadingLevel.HEADING_1, PNAME[p], { pageBreakBefore: true }));
    const codes = [...new Set(byPriority.filter((q) => q.priority === p).map((q) => q.st))];
    for (const c of codes) {
      const list = byPriority.filter((q) => q.st === c);
      kids.push(H(HeadingLevel.HEADING_2, `${list[0].stName} (${bn(list.length)}টি)`));
      kids.push(para([run(`${list[0].topic} · উপবিষয় কোড ${c}`, { color: MUTED, size: 18 })]));
      list.forEach((q) => kids.push(...questionBlock(q, ++n)));
    }
  }
  save(makeDoc("বিসিএস বাংলা — Priority-wise ১৫০০", kids), "BN52_Bangla_1500_PriorityWise.docx");
}
// ── ২. Topic/Subtopic-wise ব্যাংক
{
  const kids = cover("Topic ও Subtopic-wise প্রশ্নব্যাংক");
  for (const t of TOPICS) {
    const inT = byTopic.filter((q) => q.topic === t);
    kids.push(H(HeadingLevel.HEADING_1, `${t} (${bn(inT.length)}টি)`, { pageBreakBefore: true }));
    const codes = [...new Set(inT.map((q) => q.st))];
    for (const c of codes) {
      const list = inT.filter((q) => q.st === c);
      kids.push(H(HeadingLevel.HEADING_2, `${list[0].stName} — Priority ${list[0].priority} (${bn(list.length)}টি)`));
      for (const diff of ["Easy", "Medium", "Hard"]) {
        const sub = list.filter((q) => q.d === diff);
        if (!sub.length) continue;
        kids.push(H(HeadingLevel.HEADING_3, `${{ Easy: "সহজ", Medium: "মাঝারি", Hard: "কঠিন" }[diff]} (${diff}) — ${bn(sub.length)}টি`));
        sub.forEach((q, i) => kids.push(...questionBlock(q, list.indexOf(q) + 1)));
      }
    }
  }
  save(makeDoc("বিসিএস বাংলা — Subtopic-wise ১৫০০", kids), "BN52_Bangla_1500_SubtopicWise.docx");
}
// ── ৩. Duplicate Rejection Report
{
  const kids = [H(HeadingLevel.HEADING_1, "Duplicate Rejection Report"),
    para(`তুলনার ভিত্তি: ১০ম–৫০তম বিসিএসের বাংলা বিষয়ের ${bn(1002)}টি প্রশ্ন (বিকল্পসহ), লেকচারের অনুশীলনী প্রশ্ন এবং আগের সব ব্যাচ। প্রতিটি ব্যাচে স্বয়ংক্রিয় অক্ষর-ত্রয়ী মিল (Exact ≥ ০.৮৫, Near ≥ ০.৫) ও উত্তর-মিল পরীক্ষার পর নিকট-মিলগুলো হাতে পড়ে দেখা হয়েছে। শেষে সব ১৫০০ প্রশ্নের ওপর ‘একই উত্তর + কাছাকাছি প্রশ্ন’ ভিত্তিক কঠোর পুনর্নিরীক্ষা (audit) চালিয়ে আরও কয়েকটি পুনরাবৃত্তি বাতিল ও প্রতিস্থাপন করা হয়েছে।`),
    H(HeadingLevel.HEADING_3, "বাতিলের সারসংক্ষেপ"),
    table(["ধরন", "সংখ্যা"], [["Exact Duplicate", bn(stats.exact)], ["Semantic Duplicate", bn(stats.semantic)], ["Near Duplicate", bn(stats.near)], ["Quality Control", bn(stats.qc)], ["মোট বাতিল", bn(rejected.length)]], [5000, 4000]),
    H(HeadingLevel.HEADING_3, "বাতিল প্রশ্নের তালিকা"),
    table(["ID", "প্রশ্ন", "ধরন", "কারণ"], rejected.map((q) => [q.id, q.q, q.reject, q.dup]), [1500, 3300, 1300, 2900]),
    H(HeadingLevel.HEADING_3, `পর্যালোচনা করে গৃহীত নিকট-সম্পর্কিত প্রশ্ন (${bn(reviewedNear.length)}টি)`),
    para("এগুলোর বিষয় বিগত কোনো প্রশ্নের কাছাকাছি, কিন্তু জিজ্ঞাস্য তথ্য ভিন্ন—তাই গৃহীত। কোন বিগত প্রশ্নের সঙ্গে মেলানো হয়েছে তা পাশে লেখা।"),
    table(["ID", "প্রশ্ন", "পর্যালোচনার নোট"], reviewedNear.map((q) => [q.id, q.q, q.dup]), [1500, 3700, 3800]),
    H(HeadingLevel.HEADING_3, `লেকচারের অনুশীলনী প্রশ্নের সঙ্গে একই তথ্য (${bn(lecSame.length)}টি)`),
    para("নির্দেশনা অনুযায়ী Duplicate বিচার কেবল বিসিএস প্রশ্নের সঙ্গে। লেকচারের অনুশীলনীতে (পিএসসি/অন্যান্য পরীক্ষা) একই তথ্য থাকলেও প্রশ্ন নতুন করে লেখা হয়েছে; তালিকাটি স্বচ্ছতার জন্য দেওয়া হলো।"),
    table(["ID", "প্রশ্ন", "লেকচারের প্রশ্ন (মিল)"], lecSame.map((q) => [q.id, q.q, `${q.sim.lecText || q.sim.lecId} (${q.sim.lecMax.toFixed(2)})`]), [1500, 3700, 3800]),
  ];
  save(makeDoc("Duplicate Rejection Report", kids), "Duplicate_Rejection_Report.docx");
}
// ── ৪. Verification Report
{
  const kids = [H(HeadingLevel.HEADING_1, "Verification Report"),
    para("প্রতিটি তথ্য লেকচারের মূল আলোচনা ও প্রচলিত সাহিত্য-ইতিহাস/ব্যাকরণগ্রন্থের তথ্যের সঙ্গে মিলিয়ে দেখা হয়েছে। মুদ্রিত গ্রন্থের সঙ্গে পৃষ্ঠা ধরে মেলানো হয়নি। যেসব তথ্যে সূত্রভেদ বা অনিশ্চয়তা আছে সেগুলো ‘যাচাই প্রয়োজন’ চিহ্নিত করে গণনার বাইরে রাখা হয়েছে এবং প্রতিস্থাপন প্রশ্ন দিয়ে লক্ষ্য পূরণ করা হয়েছে।"),
    H(HeadingLevel.HEADING_3, "লেকচারে পাওয়া ভুল ও সংশোধন"),
    ...["‘পঁউআ খাল’ (পদ্মা)-এর উল্লেখ ভুসুকুপার পদে।", "বিজয় গুপ্তের ‘পদ্মাপুরাণ’ রচনা শুরু ১৪৯৪ সালে।", "রবীন্দ্রনাথের ‘কবিকাহিনী’ প্রকাশ ১৮৭৮ সালে।", "নজরুলের ‘ধূমকেতু’ প্রকাশ ১৯২২ সালে।"].map((t) => para(t, { numbering: { reference: "bul", level: 0 } })),
    H(HeadingLevel.HEADING_3, `যাচাই-অপেক্ষমাণ প্রশ্ন (${bn(verify.length)}টি, গণনায় নেই)`),
    table(["ID", "প্রশ্ন", "প্রস্তাবিত উত্তর", "অবস্থা"], verify.map((q) => [q.id, q.q, q.o[q.a], q.v]), [1400, 3400, 1700, 2500]),
  ];
  save(makeDoc("Verification Report", kids), "Verification_Report.docx");
}
// ── ৫. Final Statistics
{
  const S = stats;
  const kids = [H(HeadingLevel.HEADING_1, "Final Statistics"),
    table(["ক্রম", "বিষয়", "সংখ্যা"], [
      ["১", "Target Questions (বাংলা)", bn(S.target)],
      ["২", "Priority-wise Target", `A ${bn(ALLOC.A)} · B ${bn(ALLOC.B)} · C ${bn(ALLOC.C)} · D ${bn(ALLOC.D)}`],
      ["৩", "Questions Generated", bn(S.generated)],
      ["৪", "Exact Duplicate Rejected", bn(S.exact)],
      ["৫", "Semantic Duplicate Rejected", bn(S.semantic)],
      ["৬", "Near Duplicate Rejected", bn(S.near)],
      ["৭", "Verification Required", bn(S.verify)],
      ["৮", "Quality Control Rejected", bn(S.qc)],
      ["৯", "Final Accepted New Questions", bn(S.accepted)],
      ["১০", "Remaining Questions", bn(S.remaining)],
    ], [900, 5400, 2700]),
    H(HeadingLevel.HEADING_3, "Priority অনুযায়ী"),
    table(["Priority", "লক্ষ্য", "গৃহীত"], PORDER.map((p) => [p, bn(ALLOC[p]), bn(accP[p] || 0)]), [3000, 3000, 3000]),
    H(HeadingLevel.HEADING_3, "Difficulty ও উত্তরের অবস্থান"),
    table(["Easy", "Medium", "Hard", "ক", "খ", "গ", "ঘ"], [[bn(accD.Easy || 0), bn(accD.Medium || 0), bn(accD.Hard || 0), bn(ansPos["ক"] || 0), bn(ansPos["খ"] || 0), bn(ansPos["গ"] || 0), bn(ansPos["ঘ"] || 0)]], [1285, 1285, 1285, 1285, 1285, 1285, 1290]),
    H(HeadingLevel.HEADING_3, "উপবিষয় অনুযায়ী"),
    table(["কোড", "উপবিষয়", "Priority", "লক্ষ্য", "গৃহীত"],
      [...PLAN.values()].sort((a, b) => PORDER.indexOf(a.g) - PORDER.indexOf(b.g)).map((s) => [s.code, s.name, s.g, bn(targets[s.code] ?? s.target), bn(accSt[s.code] || 0)]),
      [1500, 4500, 900, 1050, 1050]),
    H(HeadingLevel.HEADING_3, "ব্যাচ অনুযায়ী"),
    table(["ব্যাচ", "উপবিষয়", "তৈরি", "Exact", "Semantic", "Near", "যাচাই", "QC", "গৃহীত"],
      batchStats.map((b) => [b.batch, b.subs, bn(b.generated), bn(b.exact), bn(b.semantic), bn(b.near), bn(b.verify), bn(b.qc), bn(b.accepted)]),
      [1100, 2100, 700, 700, 900, 700, 700, 500, 600]),
    para([run("বণ্টন-নোট: Priority A-র মোট ৬৩০ ঠিক রেখে ভেতরে পুনর্বণ্টন—BDL ৮৫, MUK ৫৫, অন্যগুলো ৭০ করে। D থেকে ৪টি কমিয়ে মোট ১৫০০ মেলানো হয়েছে (ব্যবহারকারীর সিদ্ধান্ত)।", { color: MUTED, size: 20 })], { spacing: { before: 160 } }),
  ];
  save(makeDoc("Final Statistics", kids), "Final_Statistics.docx");
}
console.log(JSON.stringify({ generated: stats.generated, accepted: stats.accepted, exact: stats.exact, semantic: stats.semantic, near: stats.near, verify: stats.verify, qc: stats.qc, byP: accP, diff: accD, pos: ansPos, near_reviewed: reviewedNear.length, lec_same: lecSame.length }));
const short2 = Object.entries(targets).filter(([c, t]) => (accSt[c] || 0) !== t).map(([c, t]) => `${c}:${accSt[c] || 0}/${t}`);
console.log("subtopic mismatches:", short2.join(" ") || "none");
