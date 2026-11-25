// সব ব্যাচ মিলিয়ে Question ID: গৃহীত প্রশ্ন ব্যাচের ক্রমে EN-0001, EN-0002 …; বাতিল/যাচাই-অপেক্ষমাণ প্রশ্ন EN-X-<ব্যাচ>-<ক্রম>
const fs = require("fs"), path = require("path");
const isAccepted = (q) => !q.reject && !q.v.startsWith("যাচাই প্রয়োজন");
function computeIds(root) {
  const map = new Map();
  let n = 0;
  const batches = fs.readdirSync(root).filter((d) => /^batch\d+$/.test(d)).sort();
  for (const b of batches) {
    const f = path.join(root, b, "questions.json");
    if (!fs.existsSync(f)) continue;
    JSON.parse(fs.readFileSync(f, "utf8")).questions.forEach((q, i) => {
      map.set(`${b}:${i}`, isAccepted(q) ? `IAF-${String(++n).padStart(4, "0")}` : `IAF-X-${b.slice(5)}-${String(i + 1).padStart(3, "0")}`);
    });
  }
  return map;
}
module.exports = { computeIds, isAccepted };
