/**
 * প্রশ্ন বাছাই — বিশুদ্ধ ফাংশন (ডেটাবেস ছাড়া), তাই আলাদাভাবে পরীক্ষাযোগ্য।
 *
 * অগ্রাধিকার-স্কোর (প্রোটোটাইপের ওজন, অ্যাডমিন বদলাতে পারেন):
 *   সর্বশেষ উত্তর ভুল, মোট ভুলের সংখ্যা, Review-চিহ্ন, কম আত্মবিশ্বাসে সঠিক,
 *   Priority A উপবিষয়, অনেক দিন না দেখা — সঙ্গে সামান্য এলোমেলোতা যাতে প্রতিবার একই সেট না আসে।
 */
export type Candidate = { id: string; examNo: number; grade: string | null };
export type Stat = { wrong: number; lastCorrect: boolean | null; lowConfCorrect: number; marked: boolean; lastSeenAt: Date | null };
export type Weights = { wrongLast: number; wrongCount: number; marked: number; lowConf: number; priorityA: number; stale: number };

export function priority(c: Candidate, s: Stat | undefined, w: Weights, now: Date, rnd: () => number): number {
  let p = rnd() * 0.5;
  if (c.grade === "A") p += w.priorityA;
  if (!s) return p + w.stale; // কখনো দেখা হয়নি
  if (s.lastCorrect === false) p += w.wrongLast;
  p += w.wrongCount * Math.min(s.wrong, 3);
  if (s.marked) p += w.marked;
  if (s.lowConfCorrect > 0) p += w.lowConf;
  if (s.lastSeenAt) p += w.stale * Math.min(1, (now.getTime() - s.lastSeenAt.getTime()) / (30 * 864e5));
  return p;
}

export function rank(cands: Candidate[], stats: Map<string, Stat>, w: Weights, now: Date, rnd: () => number): Candidate[] {
  return cands
    .map((c) => ({ c, p: priority(c, stats.get(c.id), w, now, rnd) }))
    .sort((a, b) => b.p - a.p)
    .map((x) => x.c);
}

/** প্রথম সমাধানের স্কোর অনুযায়ী Revision-এর প্রশ্নসংখ্যা, যেমন {"85":15,"70":25,"50":35,"0":40}। */
export function revisionSize(bands: Record<string, number>, firstScore: number): number {
  const keys = Object.keys(bands).map(Number).sort((a, b) => b - a);
  for (const k of keys) if (firstScore >= k) return bands[String(k)];
  return bands[String(keys.at(-1))];
}

/** Cumulative: প্রতিটি পরীক্ষা থেকে ন্যূনতম কোটা, বাকি জায়গা সামগ্রিক অগ্রাধিকারে। */
export function pickCumulative(ranked: Candidate[], size: number, minPerExam: number): string[] {
  const chosen = new Set<string>();
  const byExam = new Map<number, Candidate[]>();
  for (const c of ranked) (byExam.get(c.examNo) ?? byExam.set(c.examNo, []).get(c.examNo)!).push(c);
  const exams = [...byExam.keys()].sort((a, b) => a - b);
  const quota = Math.min(minPerExam, Math.floor(size / Math.max(1, exams.length)));
  for (const e of exams) for (const c of byExam.get(e)!.slice(0, quota)) chosen.add(c.id);
  for (const c of ranked) {
    if (chosen.size >= size) break;
    chosen.add(c.id);
  }
  return [...chosen].slice(0, size);
}

/** Final: প্রতিটি পরীক্ষার যোগ্য প্রশ্নের অনুপাতে কোটা (অন্তত ১টি), প্রতিটির ভেতরে অগ্রাধিকার-ক্রমে। */
export function pickProportional(ranked: Candidate[], size: number): string[] {
  const byExam = new Map<number, Candidate[]>();
  for (const c of ranked) (byExam.get(c.examNo) ?? byExam.set(c.examNo, []).get(c.examNo)!).push(c);
  const total = ranked.length;
  const chosen: string[] = [];
  for (const [, list] of [...byExam].sort((a, b) => a[0] - b[0])) {
    const q = Math.max(1, Math.round((list.length / total) * size));
    chosen.push(...list.slice(0, q).map((c) => c.id));
  }
  const set = new Set(chosen);
  for (const c of ranked) {
    if (set.size >= size) break;
    set.add(c.id);
  }
  return [...set].slice(0, size);
}

/** পরীক্ষাকে সমান ভাগে ভাগ: ১০২টি → ৩৪+৩৪+৩৪, ১০০টি → ৫০+৫০। */
export function splitParts<T>(items: T[], maxPart: number): T[][] {
  const parts = Math.max(1, Math.ceil(items.length / maxPart));
  const base = Math.floor(items.length / parts);
  let extra = items.length % parts;
  const out: T[][] = [];
  let i = 0;
  for (let p = 0; p < parts; p++) {
    const n = base + (extra-- > 0 ? 1 : 0);
    out.push(items.slice(i, i + n));
    i += n;
  }
  return out;
}

/** "সবগুলো", "কোনটিই নয়", "উভয়" ধরনের অপশন থাকলে ক্রম বদলানো যায় না। */
const FIXED_ORDER = /(সবগুলো|সবকটি|সবকয়টি|উপরের|ওপরের|কোনটিই|কোনোটিই|কোনটি নয়|উভয়|ক ও খ|খ ও গ|ক, খ|all of|none of|both|above)/i;
export function optionPerm(options: string[], shuffle: boolean, rnd: () => number): number[] {
  const id = [0, 1, 2, 3];
  if (!shuffle || options.some((o) => FIXED_ORDER.test(o))) return id;
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [id[i], id[j]] = [id[j], id[i]];
  }
  return id;
}

export function shuffleArr<T>(a: T[], rnd: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
