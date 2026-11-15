// সঠিক উত্তরের অবস্থান A–D-তে সমান করা: node balance.js batchNN
// - সংখ্যা/সালের বিকল্প: ছোট থেকে বড় ক্রমে সাজানো (উত্তরও সঙ্গে সরে)
// - "All of these", "Both A and B" ইত্যাদি থাকলে বা প্রশ্নে ক্রম জরুরি হলে অপরিবর্তিত
// - বাকিগুলো (fixed সহ) সমানভাবে বণ্টন
const fs = require("fs"), path = require("path");
const p = path.join(__dirname, process.argv[2], "questions.json");
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const num = (o) => { const m = String(o).replace(/[০-৯]/g, (c) => "০১২৩৪৫৬৭৮৯".indexOf(c)).match(/^\s*(\d+)/); return m ? +m[1] : null; };
const numeric = (q) => q.o.every((o) => num(o) !== null);
const locked = (q) => q.o.some((o) => /^(সবগুলো|কোনোটিই নয়|all of (the )?(these|above)|none of (the )?(these|above)|both .* and|no error|either .* or|neither .* nor)/i.test(o)) || /\b(in order|sequence)\b/i.test(q.q);
const c = [0, 0, 0, 0];
for (const q of d.questions) {
  if (numeric(q)) {
    const ans = q.o[q.a];
    q.o = [...q.o].sort((x, y) => num(x) - num(y) || String(x).localeCompare(String(y)));
    q.a = q.o.indexOf(ans);
  }
  if (numeric(q) || locked(q)) c[q.a]++;
}
let moved = 0;
for (const q of d.questions) {
  if (numeric(q) || locked(q)) continue;
  const t = c.indexOf(Math.min(...c));
  if (t !== q.a) { [q.o[t], q.o[q.a]] = [q.o[q.a], q.o[t]]; q.a = t; moved++; }
  c[q.a]++;
}
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log(`balanced: moved ${moved}, spread ${c.join("/")}`);
