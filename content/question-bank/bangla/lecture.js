// Final লেকচারের মূল আলোচনা (অনুশীলনী/প্রশ্ন বাদ): node lecture.js 9 [from] [len]
const fs = require("fs"), path = require("path");
const x = fs.readFileSync(path.join(__dirname, "source/lecture_final_document.xml"), "utf8");
const paras = x.split(/<\/w:p>/).map((p) => ({ t: [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""), st: (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "" })).filter((p) => p.t);
const idx = []; paras.forEach((p, i) => { if (p.st === "Heading1" && p.t.startsWith("লেকচার")) idx.push(i); });
const n = +process.argv[2], from = +(process.argv[3] || 0), len = +(process.argv[4] || 1e9);
const a = idx[n - 1], b = idx[n] || paras.length;
const out = []; let skip = false;
for (const p of paras.slice(a, b)) {
  if (/^Heading[23]$/.test(p.st)) skip = /অনুশীলনী|MCQ|বিগত বিসিএস|পিএসসি|পূর্ববর্তী বছরের|সংক্ষিপ্ত প্রশ্নোত্তর/.test(p.t);
  if (!skip) out.push((p.st ? `[${p.st}] ` : "") + p.t);
}
const s = out.join("\n"); console.log(`(${s.length} chars)`); console.log(s.slice(from, from + len));
