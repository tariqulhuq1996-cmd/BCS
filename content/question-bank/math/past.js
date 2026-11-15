// উপবিষয়ের বিগত বিসিএস প্রশ্ন ও উত্তর (সংক্ষেপে): node past.js BN.SA.RAB [BN.SA.NAZ ...]
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const rows = fs.readFileSync(path.join(ROOT, "dataset_step04.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const ak = new Map(fs.readFileSync(path.join(ROOT, "answer_key_v7.tsv"), "utf8").trim().split("\n").slice(1).map((l) => { const c = l.split("\t"); return [c[0] + "|" + c[1], c]; }));
for (const code of process.argv.slice(2)) {
  const list = rows.filter((r) => r[12] === code);
  console.log(`== ${code} (${list.length})`);
  for (const r of list) {
    const k = ak.get(r[0] + "|" + r[2]);
    const i = k ? "কখগঘ".indexOf(k[7]) : -1;
    console.log(`${r[0]}-${r[2]}: ${r[4].replace(/\s+/g, " ").slice(0, 110)} => ${i >= 0 ? r[5 + i] : (k ? k[7] : "?")}`);
  }
}
