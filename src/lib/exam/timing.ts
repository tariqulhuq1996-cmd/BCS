/**
 * বাস্তব BCS Preliminary-র আদলে পরীক্ষা-পরবর্তী বিশ্লেষণ: সময় ব্যবস্থাপনা, Intelligent Guessing ও বিষয়ভিত্তিক হিসাব।
 * - সমাধানের সময় = প্রশ্নে কাটানো প্রকৃত সময় (পরীক্ষার পর্দা থেকে মাপা)।
 * - উত্তরপত্রে চিহ্নিত করার সময় (markSec) কেবল উত্তর দেওয়া প্রশ্নে একবার করে যোগ হয়, Skip-এ নয় — দ্বিগুণ গণনা হয় না।
 * - সময়ের তথ্য না থাকলে (পুরনো পরীক্ষা) সেই অংশ "তথ্য নেই" — কিছুই অনুমান করে বসানো হয় না।
 */
export type TimingItem = {
  status: "correct" | "wrong" | "unanswered";
  mode: "DIRECT" | "GUESS" | "SKIP" | null;
  selected: number | null;
  correct: number | null;
  eliminated: number[];
  timeMs: number | null;
  subject: string;
  subtopic: string;
};
export type TimingInput = {
  items: TimingItem[];
  attempts: { startedAt: string; submittedAt: string | null; deadlineAt: string | null }[];
  secPerQ: number;
  markSec: number;
  negativeMark: number;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

export function analyzeTiming({ items, attempts, secPerQ, markSec, negativeMark }: TimingInput) {
  const n = items.length;
  const correct = items.filter((i) => i.status === "correct").length;
  const wrong = items.filter((i) => i.status === "wrong").length;
  const unanswered = n - correct - wrong;
  const answered = correct + wrong;
  const net = correct - negativeMark * wrong;

  // ── উত্তরের ধরন
  const modeOf = (i: TimingItem) => (i.selected == null ? "SKIP" : i.mode === "GUESS" ? "GUESS" : "DIRECT");
  const direct = items.filter((i) => modeOf(i) === "DIRECT").length;
  const guessItems = items.filter((i) => modeOf(i) === "GUESS");
  const skip = n - direct - guessItems.length;

  // ── সময়
  const timed = items.map((it, idx) => ({ it, idx, sec: it.timeMs == null ? null : it.timeMs / 1000 })).filter((x) => x.sec != null && x.sec > 0) as { it: TimingItem; idx: number; sec: number }[];
  const hasTime = timed.length > 0;
  const solveSec = timed.reduce((a, x) => a + x.sec, 0);
  const markTotal = answered * markSec;
  const totalOf = (x: { it: TimingItem; sec: number }) => x.sec + (x.it.selected != null ? markSec : 0);
  const answeredTimed = timed.filter((x) => x.it.selected != null);
  const within = answeredTimed.filter((x) => totalOf(x) <= secPerQ).length;
  const over = answeredTimed.length - within;
  const fastest = answeredTimed.length ? answeredTimed.reduce((a, b) => (b.sec < a.sec ? b : a)) : null;
  const slowest = answeredTimed.length ? answeredTimed.reduce((a, b) => (b.sec > a.sec ? b : a)) : null;
  const allowedSec = n * secPerQ;
  const usedSec = attempts.reduce((a, x) => (x.submittedAt ? a + Math.max(0, (new Date(x.submittedAt).getTime() - new Date(x.startedAt).getTime()) / 1000) : a), 0);
  const limitSec = attempts.reduce((a, x) => (x.deadlineAt ? a + Math.max(0, (new Date(x.deadlineAt).getTime() - new Date(x.startedAt).getTime()) / 1000) : a), 0) || null;

  // ── Intelligent Guessing
  const g = guessItems.map((i) => {
    const elimOk = i.eliminated.length === 2 && i.correct != null && !i.eliminated.includes(i.correct);
    return { right: i.status === "correct", elimOk, elimKnown: i.eliminated.length === 2 && i.correct != null };
  });
  const gRight = g.filter((x) => x.right).length;
  const elimBoth = g.filter((x) => x.elimKnown && x.elimOk).length;
  const elimLost = g.filter((x) => x.elimKnown && !x.elimOk).length;
  const rightAfterGoodElim = g.filter((x) => x.elimOk && x.right).length;

  // ── বিষয়ভিত্তিক
  const subjects = new Map<string, { subject: string; total: number; correct: number; wrong: number; guess: number; skip: number; secs: number[] }>();
  for (const it of items) {
    const s = subjects.get(it.subject) ?? { subject: it.subject, total: 0, correct: 0, wrong: 0, guess: 0, skip: 0, secs: [] };
    s.total++;
    if (it.status === "correct") s.correct++;
    if (it.status === "wrong") s.wrong++;
    if (modeOf(it) === "GUESS") s.guess++;
    if (modeOf(it) === "SKIP") s.skip++;
    if (it.timeMs != null && it.timeMs > 0) s.secs.push(it.timeMs / 1000);
    subjects.set(it.subject, s);
  }
  const subjectRows = [...subjects.values()].map((s) => ({ ...s, accuracy: pct(s.correct, s.total), avgSec: avg(s.secs) }));

  // ── সবচেয়ে বেশি সময় নেওয়া উপবিষয় (প্রশ্নের ধরন)
  const subt = new Map<string, number[]>();
  for (const x of timed) subt.set(x.it.subtopic, [...(subt.get(x.it.subtopic) ?? []), x.sec]);
  const slowTypes = [...subt.entries()].map(([name, xs]) => ({ name, avgSec: avg(xs)!, n: xs.length })).filter((x) => x.avgSec + markSec > secPerQ).sort((a, b) => b.avgSec - a.avgSec).slice(0, 3);

  const avgSolve = avg(timed.map((x) => x.sec));
  const avgTotal = answeredTimed.length ? avg(answeredTimed.map(totalOf)) : null;
  return {
    n, correct, wrong, unanswered, answered, net, negativeMark,
    correctPct: pct(correct, n), wrongPct: pct(wrong, n),
    direct, guess: guessItems.length, skip,
    hasTime, secPerQ, markSec, allowedSec, limitSec, usedSec, solveSec, markTotal,
    avgSolve, avgTotal, within, over,
    fastest: fastest && { no: fastest.idx + 1, sec: fastest.sec }, slowest: slowest && { no: slowest.idx + 1, sec: slowest.sec },
    guessTotal: g.length, guessRight: gRight, guessWrong: g.length - gRight, guessAcc: pct(gRight, g.length),
    elimBoth, elimLost, pickAcc: pct(rightAfterGoodElim, elimBoth),
    subjects: subjectRows, slowTypes,
  };
}

export type TimingReport = ReturnType<typeof analyzeTiming>;

/** বিশ্লেষণ থেকে কৌশলগত মূল্যায়ন — শুধু মাপা তথ্যের ভিত্তিতে। */
export function strategicNotes(r: TimingReport): { q: string; a: string }[] {
  const f1 = (x: number | null) => (x == null ? "—" : x.toFixed(1));
  const notes: { q: string; a: string }[] = [];
  const timedSubjects = r.subjects.filter((s) => s.avgSec != null);
  if (r.hasTime) {
    const share = r.within + r.over ? (r.within / (r.within + r.over)) * 100 : 0;
    const level = share >= 80 ? "ভালো" : share >= 60 ? "মোটামুটি" : "দুর্বল";
    notes.push({ q: "সময় ব্যবস্থাপনায় কতটা দক্ষ?", a: `উত্তর দেওয়া প্রশ্নের ${share.toFixed(0)}% বরাদ্দ ${r.secPerQ} সেকেন্ডের মধ্যে (চিহ্নিত করার ${r.markSec} সেকেন্ডসহ) শেষ হয়েছে — সময় ব্যবস্থাপনা ${level}। গড়ে প্রতি প্রশ্নে সমাধান ${f1(r.avgSolve)} সেকেন্ড, চিহ্নিত করাসহ ${f1(r.avgTotal)} সেকেন্ড।` });
    const slowS = [...timedSubjects].sort((a, b) => (b.avgSec ?? 0) - (a.avgSec ?? 0))[0];
    if (slowS) notes.push({ q: "কোন বিষয়ে সবচেয়ে বেশি সময় যাচ্ছে?", a: `${slowS.subject} — প্রতি প্রশ্নে গড়ে ${f1(slowS.avgSec)} সেকেন্ড।` });
  } else notes.push({ q: "সময় ব্যবস্থাপনা", a: "এই পরীক্ষায় প্রশ্নভিত্তিক সময়ের তথ্য নেই, তাই সময়ের মূল্যায়ন করা হয়নি।" });
  const lowS = [...r.subjects].filter((s) => s.total >= 2).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0];
  if (lowS) notes.push({ q: "কোন বিষয়ে Accuracy সবচেয়ে কম?", a: `${lowS.subject} — ${lowS.total}টির মধ্যে ${lowS.correct}টি সঠিক (${f1(lowS.accuracy)}%)।` });
  notes.push({
    q: "Intelligent Guessing-এ কতটা সফল?",
    a: r.guessTotal
      ? `${r.guessTotal}টি Guess-এর ${r.guessRight}টি সঠিক (${f1(r.guessAcc)}%)। ${r.elimBoth}বার দুটি ভুল অপশনই ঠিকঠাক বাদ দিয়েছেন, ${r.elimLost}বার সঠিক উত্তর বাদ পড়েছে।${r.guessAcc != null ? (r.guessAcc >= 50 ? " অনুমান লাভজনক — ভুলে নম্বর কাটা গেলেও গড়ে লাভ থাকছে।" : " অনুমানে সফলতা ৫০%-এর কম — বাদ দেওয়ার আগে অপশনগুলো আরেকটু যাচাই করুন।") : ""}`
      : "এই পরীক্ষায় কোনো Guess করা হয়নি।",
  });
  if (r.slowTypes.length) notes.push({ q: "কোন ধরনের প্রশ্নে সময় বেশি যাচ্ছে?", a: r.slowTypes.map((t) => `${t.name} (গড়ে ${f1(t.avgSec)} সেকেন্ড)`).join("; ") + "।" });
  const per200 = r.n ? (r.net / r.n) * 200 : 0;
  notes.push({ q: "বাস্তব Preliminary-তে বর্তমান অবস্থা কতটা কার্যকর?", a: `এই হারে ২০০ প্রশ্নে নেট নম্বর প্রায় ${per200.toFixed(0).replace("-", "−")} (প্রতি ভুলে ${r.negativeMark} কাটা ধরে)।${r.hasTime && r.avgTotal != null ? ` চিহ্নিত করাসহ গড় সময় ধরে ২০০ প্রশ্ন শেষ করতে লাগবে প্রায় ${Math.round((r.avgTotal * 200) / 60)} মিনিট (সময়সীমা ১২০ মিনিট)।` : ""}` });
  const improve = [...r.subjects].filter((s) => s.total >= 2).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).slice(0, 2).map((s) => s.subject);
  if (improve.length) notes.push({ q: "পরের মক টেস্টে কোথায় উন্নতি দরকার?", a: `${improve.join(" ও ")}-এ নির্ভুলতা বাড়ান${r.hasTime && r.over ? `; আর ${r.over}টি প্রশ্নে বরাদ্দ সময় পেরিয়েছে — দ্রুত সিদ্ধান্ত নেওয়া (দরকারে Skip/Guess) অনুশীলন করুন` : ""}।` });
  return notes;
}
