// সঠিক উত্তরের অবস্থান ক–ঘ-তে সমান করা (সংখ্যা/ক্রমভিত্তিক বিকল্প বাদে): node balance.js batchNN
const fs = require("fs"), path = require("path");
const p = path.join(__dirname, process.argv[2], "questions.json");
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const ordered = (q) => q.fixed || q.o.every((o) => /[০-৯0-9]/.test(o)) || /যথাক্রমে|ক্রম কোনটি|সঠিক ক্রম/.test(q.q) || q.o.some((o) => /^(সবগুলো|কোনোটিই নয়|ক ও খ|খ ও গ|i ও ii|ii ও iii|i, ii ও iii)/.test(o));
const c = [0, 0, 0, 0];
d.questions.filter(ordered).forEach((q) => c[q.a]++);
let moved = 0;
for (const q of d.questions) {
  if (ordered(q)) continue;
  const t = c.indexOf(Math.min(...c));
  if (t !== q.a) { [q.o[t], q.o[q.a]] = [q.o[q.a], q.o[t]]; q.a = t; moved++; }
  c[q.a]++;
}
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log(`balanced: moved ${moved}, spread ${c.join("/")}`);
