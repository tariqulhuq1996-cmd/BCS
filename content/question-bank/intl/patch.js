// src.js-এ লাইন বাদ/যোগ: node patch.js batchNN patch-file.js  (patch: { del: [substr...], add: [লাইন...] })
const fs = require("fs"), path = require("path");
const f = path.join(__dirname, process.argv[2], "src.js");
const p = require(path.resolve(process.argv[3]));
let L = fs.readFileSync(f, "utf8").split("\n");
for (const d of p.del || []) { const n = L.length; L = L.filter((l) => !l.includes(d)); if (L.length !== n - 1) throw new Error("del count " + (n - L.length) + ": " + d); }
const end = L.lastIndexOf("];");
L.splice(end, 0, ...(p.add || []));
fs.writeFileSync(f, L.join("\n"));
console.log("patched", (p.del || []).length, "-", (p.add || []).length, "+");
