// সঠিক উত্তরের অবস্থান A–D-তে সমান করা: node balance.js batchNN
// - সংখ্যা/সালের বিকল্প: ছোট থেকে বড় ক্রমে সাজানো (উত্তরও সঙ্গে সরে)
// - "All of these", "Both A and B" ইত্যাদি থাকলে বা প্রশ্নে ক্রম জরুরি হলে অপরিবর্তিত
// - বাকিগুলো (fixed সহ) সমানভাবে বণ্টন
const fs = require("fs"), path = require("path");
const p = path.join(__dirname, process.argv[2], "questions.json");
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const num = (o) => { const t = String(o).replace(/[০-৯]/g, (c) => "০১২৩৪৫৬৭৮৯".indexOf(c)).replace(/−/g, "-").replace(/,/g, ""); const m = t.match(/^\s*(-?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/); return m ? (m[2] ? +m[1] / +m[2] : +m[1]) : null; };
// গণিত: সংখ্যার বিকল্পও অন্যগুলোর মতো সমবণ্টন (ক্রমে সাজালে উত্তর মাঝের ঘরে জমে যায়)
const numeric = () => false;
const locked = (q) => q.o.some((o) => /^(সবগুলো|কোনোটিই নয়|all of (the )?(these|above)|none of (the )?(these|above)|both .* and|no error|either .* or|neither .* nor)/i.test(o)) || /\b(in order|sequence)\b/i.test(q.q);
const c = [0, 0, 0, 0];
// গণিত: সংখ্যার বিকল্প ক্রমানুসারে (ঊর্ধ্ব বা অধঃ) — যে ক্রমে উত্তরের অবস্থান কম ব্যবহৃত, সেটি নেওয়া হয়
for (const q of d.questions) {
  if (numeric(q)) {
    const ans = q.o[q.a];
    const up = [...q.o].sort((x, y) => num(x) - num(y) || String(x).localeCompare(String(y)));
    const pu = up.indexOf(ans), pd = 3 - pu;
    q.o = c[pd] < c[pu] ? [...up].reverse() : up;
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
