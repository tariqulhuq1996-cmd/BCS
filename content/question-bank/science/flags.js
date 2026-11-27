// ব্যাচের গুরুতর মিল (বিগত ≥0.45, লেকচার ≥0.62, ভেতরে ≥0.62) ও উপবিষয়-গণনা
const B = process.argv[2];
const d = require("./" + B + "/dupcheck.json"), q = require("./" + B + "/questions.json").questions;
const c = {}; q.forEach((x) => (c[x.st] = (c[x.st] || 0) + 1)); console.log(JSON.stringify(c));
for (const r of d.rows) { const f = []; if (r.pastMax >= 0.45) f.push("PAST " + r.pastMax + ": " + r.pastText.slice(0, 50)); if (r.lecMax >= 0.62) f.push("LEC " + r.lecMax + ": " + r.lecText.slice(0, 50)); if (r.intMax >= 0.62) f.push("INT " + r.intMax + " " + r.intId); if (f.length) console.log("#" + r.n + " " + q[r.n - 1].q.slice(0, 50) + " | " + f.join(" | ")); }
const mx = (k) => Math.max(...d.rows.map((r) => r[k])); console.log("max past", mx("pastMax"), "lec", mx("lecMax"), "int", mx("intMax"));
