// বিসিএস লিখিত তথ্য-কার্ড: Excel ওয়ার্কবুক (নির্দেশনা + সারসংক্ষেপ + ৬টি বিষয়ের শিট)।  usage: node build.js
const path = require("path");
const ExcelJS = require(path.join(__dirname, "..", "..", "node_modules", "exceljs"));
const SUBJ = require("./cards.js");

const FONT = "Nirmala UI";
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
const INPUT_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const SEC_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0EA" } };
const thin = { style: "thin", color: { argb: "FFBFBFBF" } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const STATUS = ["বাকি", "চলমান", "সম্পূর্ণ"];

const wb = new ExcelJS.Workbook();
wb.creator = "BCS 52 Preparation";
wb.created = new Date();

const COLS = [
  { key: "id", header: "কার্ড আইডি", width: 11 },
  { key: "paper", header: "পত্র/অংশ", width: 18 },
  { key: "section", header: "সিলেবাস-অংশ", width: 30 },
  { key: "marks", header: "অংশের নম্বর", width: 11 },
  { key: "title", header: "কার্ডের শিরোনাম", width: 46 },
  { key: "type", header: "কার্ডের ধরন", width: 18 },
  { key: "info", header: "তথ্য (আপনি লিখবেন)", width: 70 },
  { key: "ref", header: "উৎস / রেফারেন্স", width: 26 },
  { key: "note", header: "নোট / মনে রাখার সূত্র", width: 30 },
  { key: "status", header: "অবস্থা", width: 11 },
];
const INPUT_KEYS = new Set(["info", "ref", "note", "status"]);

// ── নির্দেশনা শিট (প্রথমে তৈরি, পরে সামনে রাখা)
const guide = wb.addWorksheet("নির্দেশনা", { views: [{ showGridLines: false }] });
// ── সারসংক্ষেপ শিট
const sum = wb.addWorksheet("সারসংক্ষেপ", { views: [{ state: "frozen", ySplit: 3 }] });

// ── বিষয়ের শিট
const sheetInfo = [];
for (const s of SUBJ) {
  const SHORT = { BN: "BN বাংলা", EN: "EN ইংরেজি", BD: "BD বাংলাদেশ", IA: "IA আন্তর্জাতিক", MM: "MM গণিত ও মানসিক দক্ষতা", SC: "SC বিজ্ঞান ও প্রযুক্তি" };
  const name = SHORT[s.code];
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(1);
  COLS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = HEAD_FILL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  head.height = 30;
  let n = 0, r = 2;
  for (const [paper, section, marks, type, titles] of s.sections) {
    for (const title of titles) {
      n++;
      const row = ws.getRow(r++);
      row.values = { id: `${s.code}-${String(n).padStart(3, "0")}`, paper, section, marks: marks ?? "—", title, type, info: "", ref: "", note: "", status: "বাকি" };
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const key = COLS[col - 1].key;
        cell.font = { name: FONT, size: 11, bold: key === "title" };
        cell.alignment = { vertical: "top", wrapText: true, horizontal: key === "id" || key === "marks" || key === "status" ? "center" : "left" };
        cell.border = border;
        if (INPUT_KEYS.has(key)) cell.fill = INPUT_FILL;
        else if (key === "section" || key === "paper") cell.fill = SEC_FILL;
      });
      row.getCell("status").dataValidation = { type: "list", allowBlank: true, formulae: [`"${STATUS.join(",")}"`] };
      row.height = 45;
    }
  }
  if (n !== s.target) throw new Error(`${s.code}: ${n} ≠ ${s.target}`);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: n + 1, column: COLS.length } };
  sheetInfo.push({ s, name, last: n + 1 });
}

// ── সারসংক্ষেপ (সূত্রসহ; খোলামাত্র হালনাগাদ হয়)
sum.columns = [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }];
sum.mergeCells("A1:G1");
sum.getCell("A1").value = "বিসিএস লিখিত (সাধারণ ক্যাডার, ৯০০ নম্বর) — তথ্য-কার্ডের অগ্রগতি";
sum.getCell("A1").font = { name: FONT, bold: true, size: 14, color: { argb: "FF1F4E3D" } };
sum.getRow(2).height = 6;
const sh = ["বিষয়", "লিখিত নম্বর", "লক্ষ্য কার্ড", "মোট কার্ড", "তথ্য লেখা হয়েছে", "সম্পূর্ণ", "সম্পূর্ণের হার"];
sh.forEach((h, i) => {
  const c = sum.getRow(3).getCell(i + 1);
  c.value = h; c.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = HEAD_FILL;
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = border;
});
sum.getRow(3).height = 30;
sheetInfo.forEach(({ s, name, last }, i) => {
  const r = sum.getRow(4 + i);
  const ref = `'${name}'`;
  r.getCell(1).value = s.name;
  r.getCell(2).value = s.marks;
  r.getCell(3).value = s.target;
  r.getCell(4).value = { formula: `COUNTA(${ref}!E2:E${last})`, result: s.target };
  r.getCell(5).value = { formula: `COUNTIF(${ref}!G2:G${last},"?*")`, result: 0 };
  r.getCell(6).value = { formula: `COUNTIF(${ref}!J2:J${last},"সম্পূর্ণ")`, result: 0 };
  r.getCell(7).value = { formula: `IF(D${4 + i}=0,0,F${4 + i}/D${4 + i})`, result: 0 };
  r.getCell(7).numFmt = "0.0%";
  r.eachCell((c, col) => { c.font = { name: FONT, color: col === 3 || col === 2 ? { argb: "FF0000FF" } : undefined }; c.border = border; c.alignment = { horizontal: col === 1 ? "left" : "center" }; });
});
const tr = 4 + sheetInfo.length;
const tot = sum.getRow(tr);
tot.getCell(1).value = "মোট";
tot.getCell(2).value = { formula: `SUM(B4:B${tr - 1})`, result: SUBJ.reduce((a, s) => a + s.marks, 0) };
tot.getCell(3).value = { formula: `SUM(C4:C${tr - 1})`, result: SUBJ.reduce((a, s) => a + s.target, 0) };
tot.getCell(4).value = { formula: `SUM(D4:D${tr - 1})`, result: SUBJ.reduce((a, s) => a + s.target, 0) };
tot.getCell(5).value = { formula: `SUM(E4:E${tr - 1})`, result: 0 };
tot.getCell(6).value = { formula: `SUM(F4:F${tr - 1})`, result: 0 };
tot.getCell(7).value = { formula: `IF(D${tr}=0,0,F${tr}/D${tr})`, result: 0 };
tot.getCell(7).numFmt = "0.0%";
tot.eachCell((c, col) => { c.font = { name: FONT, bold: true }; c.border = border; c.fill = SEC_FILL; c.alignment = { horizontal: col === 1 ? "left" : "center" }; });
sum.getCell(`A${tr + 2}`).value = "নীল সংখ্যা = প্রদত্ত মান (লিখিত নম্বর: বিদ্যমান বিসিএস লিখিত বণ্টন; লক্ষ্য কার্ড: ব্যবহারকারীর নির্দেশনা — ২০০ নম্বরের বিষয়ে ১০০টি, ১০০ নম্বরের বিষয়ে ৫০টি)। কালো সংখ্যা সূত্রে হিসাব হয়।";
sum.getCell(`A${tr + 2}`).font = { name: FONT, italic: true, size: 10, color: { argb: "FF555555" } };
sum.mergeCells(`A${tr + 2}:G${tr + 2}`);
sum.getCell(`A${tr + 2}`).alignment = { wrapText: true };
sum.getRow(tr + 2).height = 32;

// ── নির্দেশনা
guide.columns = [{ width: 4 }, { width: 26 }, { width: 90 }];
const g = (r, a, b, opt = {}) => { const row = guide.getRow(r); row.getCell(2).value = a; row.getCell(3).value = b; row.getCell(2).font = { name: FONT, bold: true, ...opt }; row.getCell(3).font = { name: FONT, ...opt }; row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.getCell(2).alignment = { vertical: "top" }; };
guide.getCell("B1").value = "বিসিএস লিখিত (সাধারণ ক্যাডার) — তথ্য-কার্ড";
guide.getCell("B1").font = { name: FONT, bold: true, size: 16, color: { argb: "FF1F4E3D" } };
g(3, "কী আছে", "৬টি বিষয়ের মোট ৪৫০টি কার্ডের কাঠামো: প্রতিটি কার্ডে আইডি, পত্র, সিলেবাস-অংশ, শিরোনাম ও ধরন দেওয়া আছে। ২০০ নম্বরের বিষয় (বাংলা, ইংরেজি, বাংলাদেশ বিষয়াবলি) ১০০টি করে, ১০০ নম্বরের বিষয় (আন্তর্জাতিক বিষয়াবলি, গাণিতিক যুক্তি ও মানসিক দক্ষতা, সাধারণ বিজ্ঞান ও প্রযুক্তি) ৫০টি করে (সম্পর্কিত টপিক একত্র করে)।");
g(4, "আপনি কোথায় লিখবেন", "প্রতিটি বিষয়ের শিটে হলুদ ঘরগুলো: 'তথ্য', 'উৎস / রেফারেন্স', 'নোট / মনে রাখার সূত্র' এবং 'অবস্থা' (ড্রপডাউন: বাকি / চলমান / সম্পূর্ণ)। অন্য কলামগুলো কাঠামো — বদলাতে চাইলে বদলাতে পারেন।");
g(5, "অগ্রগতি", "'সারসংক্ষেপ' শিট নিজে থেকে গোনে: কতটি কার্ডে তথ্য লেখা হয়েছে এবং কতটি 'সম্পূর্ণ' চিহ্নিত।");
g(6, "সিলেবাস-অংশ ও নম্বর", "অংশগুলো বিদ্যমান বিসিএস লিখিত সিলেবাসের কাঠামো অনুযায়ী সাজানো। বাংলা, গাণিতিক যুক্তি/মানসিক দক্ষতা ও বিজ্ঞানের ভাগ-নম্বর পরিচিত বণ্টন থেকে; যেখানে অংশভিত্তিক নম্বর নিশ্চিত নয় সেখানে '—'। ৫২তম বিসিএসের বিজ্ঞপ্তি ও সিলেবাস প্রকাশ হলে মিলিয়ে নিতে হবে।");
g(7, "নতুন কার্ড যোগ", "শিটের শেষে নতুন সারিতে পরের আইডি দিয়ে লিখুন (যেমন BN-101)। সারসংক্ষেপের সূত্র নির্দিষ্ট সারি পর্যন্ত গোনে, তাই বেশি কার্ড যোগ করলে সূত্রের সারিসীমা বাড়িয়ে নিন।");
guide.getCell("B9").value = "উদাহরণ (এভাবে একটি কার্ড পূরণ করা যায়)";
guide.getCell("B9").font = { name: FONT, bold: true, size: 12, color: { argb: "FF1F4E3D" } };
const ex = [
  ["কার্ড আইডি", "BN-015"],
  ["সিলেবাস-অংশ", "ব্যাকরণ (১ম পত্র, ৩০ নম্বর)"],
  ["কার্ডের শিরোনাম", "ণত্ব বিধান"],
  ["তথ্য", "ঋ, র, ষ-এর পরে মূর্ধন্য ণ হয় (ঋণ, বর্ণ, বিষ্ণু)। ট-বর্গের সঙ্গে যুক্ত হলে ণ (কণ্টক, ঘণ্টা)। প্র, পরা, পরি, নির্ উপসর্গের পর নম্, নী, নদ্ ধাতুর ন ণ হয় (প্রণাম, পরিণাম)। বিদেশি শব্দে ণ হয় না (কোরান, গভর্নর)।"],
  ["উৎস / রেফারেন্স", "বাংলা একাডেমি প্রমিত বাংলা ব্যাকরণ; নবম-দশম শ্রেণির বাংলা ব্যাকরণ (NCTB)"],
  ["নোট / মনে রাখার সূত্র", "ঋ-র-ষ এর পরে ণ; বিদেশিতে কখনো না"],
  ["অবস্থা", "সম্পূর্ণ"],
];
ex.forEach(([a, b], i) => { g(10 + i, a, b); guide.getRow(10 + i).getCell(3).fill = INPUT_FILL; guide.getRow(10 + i).getCell(3).border = border; guide.getRow(10 + i).getCell(2).border = border; });
guide.getRow(13).height = 60;

// ক্রম: নির্দেশনা, সারসংক্ষেপ, তারপর বিষয়
wb.views = [{ activeTab: 0 }];
const out = path.join(__dirname, "BCS_Written_Info_Cards.xlsx");
wb.xlsx.writeFile(out).then(() => console.log("written", out, SUBJ.map((s) => `${s.code}:${s.target}`).join(" ")));
