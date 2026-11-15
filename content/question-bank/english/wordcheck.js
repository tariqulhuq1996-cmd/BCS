// নতুন প্রশ্নের মূল শব্দ (উদ্ধৃতির ভেতরের ছোট অংশ ও ছোট উত্তর) বিগত সব ইংরেজি প্রশ্নে (প্রশ্ন + বিকল্প) আছে কি না।
// usage: node wordcheck.js batchNN
const fs = require("fs"), path = require("path");
const rows = fs.readFileSync(path.join(__dirname, "../../dataset_step04.tsv"), "utf8").split("\n").map((l) => l.split("\t")).filter((r) => r[12] && r[12].startsWith("EN."));
const hay = rows.map((r) => ({ id: `${r[0]}-${r[2]}(${r[12].slice(3)})`, t: (r[4] + " | " + r.slice(5, 9).join(" | ")).toLowerCase(), q: r[4] }));
const d = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[2], "questions.json"), "utf8"));
const STOP = new Set(["the", "here", "means", "word", "which", "what", "this", "that", "with", "from", "choose", "appropriate", "correct", "form", "none", "both"]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
d.questions.forEach((q, i) => {
  const quoted = [...q.q.matchAll(/['‘]([^'’]+)['’]/g)].map((m) => m[1]);
  const keys = new Set();
  for (const s of quoted) if (s.split(/\s+/).length <= 3) keys.add(s.toLowerCase());
  const ans = q.o[q.a];
  if (ans.split(/\s+/).length <= 2) keys.add(ans.toLowerCase());
  for (const k of keys) {
    if (k.length < 4 || STOP.has(k)) continue;
    const re = new RegExp(`(^|[^a-z])${esc(k)}([^a-z]|$)`);
    const hits = hay.filter((h) => re.test(h.t));
    if (hits.length) console.log(`#${i + 1} '${k}' → ${hits.slice(0, 4).map((h) => h.id + ": " + h.q.slice(0, 45)).join(" || ")}`);
  }
});
