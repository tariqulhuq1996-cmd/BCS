// গণিতের প্রশ্ন লেখার সহায়ক: উত্তর কোডে হিসাব করে বসানো হয় (calc), বিকল্প উত্তরের সঙ্গে মিলে গেলে থামে।
// N(st)(d, q, val, [ভুল বিকল্প], সমাধান, শর্টকাট, {u: "টাকা", pre: "", ar, dup, src}) — val সংখ্যা বা [লব, হর] বা স্ট্রিং
// T(st)(d, q, ans, [ভুল বিকল্প], সমাধান, শর্টকাট, {..}) — ধারণাভিত্তিক (লেখা) উত্তর
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const fr = (n, d) => { const g = gcd(n, d) || 1; let [p, q] = [n / g, d / g]; if (q < 0) [p, q] = [-p, -q]; return q === 1 ? `${p}` : `${p}/${q}`; };
const r2 = (x) => Math.round(x * 10000) / 10000;
const fmt = (v) => {
  if (Array.isArray(v)) return fr(v[0], v[1]);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("অসীম/অসংখ্যা মান");
    const x = Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : r2(v);
    return x < 0 ? `−${-x}` : `${x}`;
  }
  return String(v);
};
const key = (s) => String(s).replace(/\s+/g, "").replace(/−/g, "-");
const mkOpts = (val, dis, x) => {
  const u = x.u ? ` ${x.u}` : "", pre = x.pre || "";
  const o = [val, ...dis].map((v) => `${pre}${fmt(v)}${u}`);
  if (new Set(o.map(key)).size !== 4) throw new Error(`বিকল্প একই বা উত্তরের সমান: ${o.join(" | ")}`);
  return o;
};
const extra = (st, x, calc) => {
  const e = { st, calc };
  for (const k of ["ar", "dup", "src", "v", "reject"]) if (x[k]) e[k] = x[k];
  return e;
};
const N = (st) => (d, q, val, dis, e, t, x = {}) => [d, q, mkOpts(val, dis, x), 0, e, t, extra(st, x, true)];
const T = (st) => (d, q, ans, dis, e, t, x = {}) => [d, q, mkOpts(ans, dis, x), 0, e, t, extra(st, x, false)];
const nCr = (n, r) => { let v = 1; for (let i = 1; i <= r; i++) v = (v * (n - r + i)) / i; return Math.round(v); };
const nPr = (n, r) => { let v = 1; for (let i = 0; i < r; i++) v *= n - i; return v; };
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
module.exports = { N, T, gcd, lcm, fr, fmt, r2, nCr, nPr, fact };
