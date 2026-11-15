// একটি ব্যাচ থেকে: ১৪ ঘরের TSV ও CSV (Import-যোগ্য), লেকচারের ধাঁচে Word ফাইল, আর ব্যাচ-প্রতিবেদন।
// usage: node build.js <batch-dir>
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageNumber, Footer, LevelFormat,
} = require("../node_modules/docx");

const dir = path.resolve(process.argv[2]);
const data = JSON.parse(fs.readFileSync(path.join(dir, "questions.json"), "utf8"));
const dup = JSON.parse(fs.readFileSync(path.join(dir, "dupcheck.json"), "utf8"));
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const L = ["ক", "খ", "গ", "ঘ"];
const FONT = "Nirmala UI";
const GREEN = "005500", RED = "990000", MUTED = "555555";
const short = (c) => { const p = c.split("."); return p[2] === "OTH" ? p[1] + p[2] : p[2]; };

// ── প্রতিটি প্রশ্নের চূড়ান্ত অবস্থা
const counters = {};
const qs = data.questions.map((q, i) => {
  const st = data.subtopics[q.st];
  counters[q.st] = (counters[q.st] || 0) + 1;
  const d = dup.rows[i];
  const needsVerify = q.v.startsWith("যাচাই প্রয়োজন");
  const status = q.reject ? `বাতিল (${q.reject})` : needsVerify ? "যাচাই-অপেক্ষমাণ (গণনায় নেই)" : "গৃহীত";
  const lecNote = d.lecMax >= 0.5 ? `; লেকচারের অনুশীলনী (বিসিএস নয়) ${d.lecId}-এর সঙ্গে একই তথ্য (মিল ${d.lecMax.toFixed(2)})` : "";
  return {
    ...q,
    i,
    id: `BN52-${short(q.st)}-${String(counters[q.st] + ((data.idStart || {})[q.st] || 1) - 1).padStart(3, "0")}`,
    topic: st.topic,
    subtopic: `${q.st} ${st.name}`,
    priority: st.priority,
    status,
    accepted: status === "গৃহীত",
    dupText: `${q.dup} [স্বয়ংক্রিয় মিল: বিগত বিসিএস সর্বোচ্চ ${d.pastMax.toFixed(2)} (${d.pastId})${lecNote}]`,
    sim: d,
  };
});

// ── TSV / CSV
const COLS = ["Question ID", "বিষয়", "Topic", "Subtopic", "Priority", "Difficulty", "প্রশ্ন", "ক", "খ", "গ", "ঘ", "সঠিক উত্তর", "ব্যাখ্যা", "পরীক্ষার কৌশল / মনে রাখার সূত্র", "Source", "Database Duplicate Check", "Verification Status", "চূড়ান্ত অবস্থা"];
const rowOf = (q) => [q.id, data.subject, q.topic, q.subtopic, q.priority, q.d, q.q, ...q.o, `${L[q.a]}. ${q.o[q.a]}`, q.e, q.t, q.src, q.dupText, q.v, q.status];
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ");
const name = data.batch.replace(/\s+/g, "_");
const batchBn = bn(data.batch.replace("Batch", "ব্যাচ"));
fs.writeFileSync(path.join(dir, `BN52_Bangla_${name}.tsv`), [COLS, ...qs.map(rowOf)].map((r) => r.map(clean).join("\t")).join("\n") + "\n");
const csvCell = (s) => `"${clean(s).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(dir, `BN52_Bangla_${name}.csv`), "﻿" + [COLS, ...qs.map(rowOf)].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");

// ── হিসাব
const TOTAL = 1500;
const ALLOC = { A: 630, B: 330, C: 318, D: 222 };
const prevPath = path.join(dir, "..", "progress.json");
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : { accepted: {}, batches: [] };
const thisAcc = {};
for (const q of qs.filter((q) => q.accepted)) thisAcc[q.priority] = (thisAcc[q.priority] || 0) + 1;
const root = path.join(dir, "..");
const cum = {}; const allBatches = [];
for (const b of fs.readdirSync(root).filter((n) => /^batch[0-9]+$/.test(n)).sort()) {
  const f = path.join(root, b, "questions.json");
  if (!fs.existsSync(f)) continue;
  const bd = b === path.basename(dir) ? data : JSON.parse(fs.readFileSync(f, "utf8"));
  if (b !== path.basename(dir) && !fs.existsSync(path.join(root, b, "stats.json"))) continue;
  allBatches.push(bd.batch);
  for (const q of bd.questions.filter((q) => !q.reject && !q.v.startsWith("যাচাই প্রয়োজন"))) { const p = bd.subtopics[q.st].priority; cum[p] = (cum[p] || 0) + 1; }
}
const cumTotal = Object.values(cum).reduce((a, b) => a + b, 0);
const stats = {
  target: TOTAL,
  priorityTarget: ALLOC,
  generated: qs.length,
  exact: qs.filter((q) => q.reject === "Exact Duplicate").length,
  semantic: qs.filter((q) => q.reject === "Semantic Duplicate").length,
  near: qs.filter((q) => q.reject === "Near Duplicate").length,
  verify: qs.filter((q) => q.status.startsWith("যাচাই")).length,
  qc: qs.filter((q) => q.reject === "Quality Control").length,
  accepted: qs.filter((q) => q.accepted).length,
  cumulative: cumTotal,
  remaining: TOTAL - cumTotal,
  cumByPriority: cum,
};
fs.writeFileSync(prevPath, JSON.stringify({ accepted: cum, batches: allBatches }, null, 2));
fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(stats, null, 2));

// ── Word (লেকচারের ধাঁচ)
const run = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: 60 }, ...o });
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const table = (head, rows, widths) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [head, ...rows].map(
      (r, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          children: r.map(
            (c, ci) =>
              new TableCell({
                width: { size: widths[ci], type: WidthType.DXA },
                borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
                shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E8F0EA" } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [para([run(String(c), { bold: ri === 0, size: 20 })], { spacing: { after: 0 } })],
              }),
          ),
        }),
    ),
  });

const questionBlock = (q, n) => {
  const out = [
    para([run(`প্রশ্ন ${bn(n)}। `, { bold: true }), run(q.q, { bold: true })], { spacing: { before: 200, after: 40 }, keepNext: true }),
    para([run(`${q.id}  ·  Priority ${q.priority}  ·  ${q.d}`, { size: 18, color: MUTED })], { keepNext: true }),
    ...q.o.map((o, k) => para(`${L[k]}. ${o}`, { indent: { left: 360 }, spacing: { after: 20 }, keepNext: true })),
    para([run(`সঠিক উত্তর: ${L[q.a]}. ${q.o[q.a]}`, { bold: true, color: GREEN })], { spacing: { before: 60, after: 40 } }),
    para([run("ব্যাখ্যা: ", { bold: true }), run(q.e)]),
    para([run("মনে রাখার সূত্র: ", { bold: true }), run(q.t)]),
    para([run(`উৎস: ${q.src}  ·  Duplicate Check: ${q.dup}  ·  ${q.v}`, { size: 18, color: MUTED })]),
  ];
  if (q.status.startsWith("যাচাই")) out.push(para([run(`[${q.v}। এ প্রশ্নটি চূড়ান্ত গণনায় ধরা হয়নি।]`, { color: RED })]));
  return out;
};

const kids = [];
kids.push(para([run("বিসিএস বাংলা ভাষা ও সাহিত্য", { bold: true, size: 40 })], { alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 } }));
kids.push(para([run("৫২তম BCS Preliminary — নতুন MCQ প্রশ্নব্যাংক", { size: 28 })], { alignment: AlignmentType.CENTER }));
kids.push(para([run(`${batchBn}: ${data.basis}`, { size: 24, color: MUTED })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }));

kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run("ব্যবহারের নির্দেশনা")] }));
for (const t of [
  "এ ব্যাচের সব প্রশ্ন নতুন করে লেখা; ১০ম–৫০তম বিসিএসের কোনো প্রশ্ন হুবহু বা সামান্য বদলে এখানে নেই। বিগত প্রশ্নে যে তথ্য জানতে চাওয়া হয়েছে, সেই তথ্যের প্রশ্নও বাদ।",
  "প্রতিটি প্রশ্নের নিচে সঠিক উত্তর (সবুজ), ব্যাখ্যা ও মনে রাখার সূত্র; তার নিচে ছোট লেখায় Question ID, Priority, Difficulty, উৎস, Duplicate Check ও যাচাইয়ের অবস্থা।",
  "যেসব প্রশ্নের তথ্য মূল সূত্রে আরও মিলিয়ে দেখা দরকার, সেগুলোর নিচে লাল রঙে উল্লেখ আছে; এগুলো চূড়ান্ত গণনায় ধরা হয়নি।",
  "লেকচারের দু-একটি তথ্যে ভুল পাওয়া গেছে; প্রশ্নে সংশোধিত তথ্য ব্যবহার করা হয়েছে এবং উৎসের ঘরে তা উল্লেখ আছে।",
]) kids.push(para(t, { numbering: { reference: "bul", level: 0 } }));

const groups = Object.keys(data.subtopics);
for (const code of groups) {
  const st = data.subtopics[code];
  const list = qs.filter((q) => q.st === code && !q.reject);
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(`${st.name}`)] }));
  kids.push(para([run(`${st.topic} · উপবিষয় কোড ${code} · Priority ${st.priority} · এ উপবিষয়ের লক্ষ্য ${bn(st.target)}টি`, { color: MUTED })]));
  for (const diff of ["Easy", "Medium", "Hard"]) {
    const sub = list.filter((q) => q.d === diff);
    if (!sub.length) continue;
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run(`${{ Easy: "সহজ", Medium: "মাঝারি", Hard: "কঠিন" }[diff]} (${diff}) — ${bn(sub.length)}টি`)] }));
    sub.forEach((q) => kids.push(...questionBlock(q, list.indexOf(q) + 1)));
  }
}

// ── প্রতিবেদন
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(`${batchBn}: প্রতিবেদন`)] }));
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("লক্ষ্য ও হিসাব")] }));
const S = stats;
kids.push(
  table(
    [run("ক্রম").text ?? "ক্রম", "বিষয়", "সংখ্যা"].map(String),
    [
      ["১", "Target Questions (বাংলা)", bn(S.target)],
      ["২", "Priority-wise Target", `A ${bn(ALLOC.A)} · B ${bn(ALLOC.B)} · C ${bn(ALLOC.C)} · D ${bn(ALLOC.D)}`],
      ["৩", "Questions Generated (এ ব্যাচে)", bn(S.generated)],
      ["৪", "Exact Duplicate Rejected", bn(S.exact)],
      ["৫", "Semantic Duplicate Rejected", bn(S.semantic)],
      ["৬", "Near Duplicate Rejected", bn(S.near)],
      ["৭", "Verification Required", bn(S.verify)],
      ["৮", "Quality Control Rejected", bn(S.qc)],
      ["৯", "Final Accepted New Questions (এ ব্যাচে)", bn(S.accepted)],
      ["১০", "Remaining Questions", `${bn(S.remaining)} (মোট গৃহীত ${bn(S.cumulative)})`],
    ],
    [900, 5400, 2700],
  ),
);
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("Priority অনুযায়ী অগ্রগতি")] }));
kids.push(
  table(
    ["Priority", "লক্ষ্য", "গৃহীত (মোট)", "বাকি"],
    ["A", "B", "C", "D"].map((p) => [p, bn(ALLOC[p]), bn(cum[p] || 0), bn(ALLOC[p] - (cum[p] || 0))]),
    [2250, 2250, 2250, 2250],
  ),
);
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("Duplicate Rejection Report")] }));
kids.push(para(`তুলনা করা হয়েছে বিগত বিসিএসের বাংলা বিষয়ের ${bn(dup.comparedPast)}টি প্রশ্ন, লেকচারের ${bn(dup.comparedLecture)}টি অনুশীলনী প্রশ্ন এবং এ ব্যাচের অন্য প্রশ্নের সঙ্গে। প্রতিটি নিকট-মিল হাতে পড়ে দেখা হয়েছে: একই তথ্য জানতে চাইলে বাতিল, ভিন্ন তথ্য হলে গৃহীত।`));
const rej = qs.filter((q) => q.reject);
kids.push(table(["Question ID", "প্রশ্ন", "কারণ"], rej.length ? rej.map((q) => [q.id, q.q, q.dup]) : [["—", "কোনো প্রশ্ন বাতিল হয়নি", "—"]], [1700, 3900, 3400]));
const near = qs.filter((q) => !q.reject && /নিকট-সম্পর্কিত|পর্যালোচিত/.test(q.dup));
kids.push(para([run(`পর্যালোচনা করে গৃহীত (বিগত প্রশ্নের সঙ্গে বিষয়গত সম্পর্ক আছে, তথ্য ভিন্ন): ${bn(near.length)}টি — ${near.map((q) => q.id).join(", ")}`)], { spacing: { before: 120 } }));
const lecSame = qs.filter((q) => !q.reject && q.sim.lecMax >= 0.5);
kids.push(para([run(`লেকচারের অনুশীলনী প্রশ্নের (পিএসসি ইত্যাদি, বিসিএস নয়) সঙ্গে একই তথ্য: ${bn(lecSame.length)}টি — ${lecSame.map((q) => q.id).join(", ")}। নির্দেশনা অনুযায়ী Duplicate যাচাই শুধু বিসিএস-প্রশ্নের সঙ্গে; তাই এগুলো গৃহীত, তবে আলাদা করে দেখানো হলো।`)]));
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run("Verification Report")] }));
const ver = qs.filter((q) => !q.reject && q.v !== "যাচাইকৃত");
kids.push(table(["Question ID", "অবস্থা"], ver.map((q) => [q.id, q.v]), [2200, 6800]));
kids.push(para([run("যাচাইয়ের পদ্ধতি: প্রতিটি তথ্য লেকচারের মূল আলোচনা ও প্রচলিত সাহিত্য-ইতিহাসের তথ্যের সঙ্গে মিলিয়ে দেখা হয়েছে। লেকচারে ভুল বা অসংগতি পেলে সংশোধিত তথ্য নেওয়া হয়েছে এবং উৎস/যাচাইয়ের ঘরে তা উল্লেখ আছে। মুদ্রিত গ্রন্থের সঙ্গে পৃষ্ঠা-ধরে মেলানো হয়নি; ‘যাচাই প্রয়োজন’ চিহ্নিত প্রশ্ন মূল সূত্রে মিলিয়ে নিলে গৃহীত গণনায় যোগ হবে।", { color: MUTED, size: 20 })], { spacing: { before: 120 } }));

const doc = new Document({
  creator: "BCS 52 Question Bank",
  title: `বিসিএস বাংলা — ${data.batch}`,
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true, color: GREEN }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("পৃষ্ঠা ", { size: 18, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: MUTED })] })] }) },
      children: kids,
    },
  ],
});
Packer.toBuffer(doc).then((buf) => {
  const out = path.join(dir, `BN52_Bangla_${name}.docx`);
  fs.writeFileSync(out, buf);
  console.log(JSON.stringify(stats));
  console.log("docx:", out);
});
