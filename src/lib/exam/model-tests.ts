/**
 * Level 3: Model Test তৈরি (ব্লুপ্রিন্ট অনুযায়ী) ও অনুমোদন।
 *
 * প্রতিটি টেস্ট:
 *  - বিষয়ভিত্তিক প্রশ্ন = ২০০ নম্বরের মানবণ্টন (exam.marks_distribution)
 *  - বিষয়ের ভেতরে টপিক-ভার = ধাপ ০৯-এর টপিকভিত্তিক আনুমানিক প্রশ্ন (Topic.estQuestions)
 *  - কঠিনতা-মিশ্রণ = স্তরভেদে l3.difficulty_mix (কঠিনতা অজানা হলে "মাঝারি" ধরা হয়)
 *  - পরপর l3.no_repeat_window টি টেস্টে একই প্রশ্ন নয়; প্রশ্ন কম পড়লে সবচেয়ে আগে ব্যবহৃত প্রশ্ন নেওয়া হয় এবং সতর্কতা রেকর্ড হয়
 *  - নতুন টেস্ট DRAFT; অ্যাডমিন দেখে অনুমোদন দিলে PUBLISHED (প্রকাশিত টেস্ট আর বদলায় না)
 * বীজ (seed) একই হলে ফল একই — পুনরুৎপাদনযোগ্য।
 */
import type { Difficulty, PrismaClient } from "@prisma/client";
import { loadRules } from "@/lib/rules";

type PoolQ = { id: string; subject: string; subjectOrder: number; topicId: number; diff: Difficulty };
export type GenSummary = { generated: number[]; skippedPublished: number[]; warnings: { no: number; message: string }[]; poolSize: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** সর্বোচ্চ-অবশিষ্ট পদ্ধতিতে মোট `total`-কে ওজন অনুযায়ী পূর্ণসংখ্যায় ভাগ। */
export function apportion(weights: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(weights);
  const sum = keys.reduce((a, k) => a + Math.max(0, weights[k]), 0) || keys.length;
  const raw = keys.map((k) => ({ k, v: ((sum === keys.length && !keys.some((x) => weights[x] > 0) ? 1 : Math.max(0, weights[k])) / sum) * total }));
  const out: Record<string, number> = Object.fromEntries(raw.map((r) => [r.k, Math.floor(r.v)]));
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))) {
    if (left-- <= 0) break;
    out[r.k]++;
  }
  return out;
}

export const tierOf = (no: number) => (no <= 50 ? 1 : no <= 100 ? 2 : 3);

export async function generateModelTests(db: PrismaClient, opts: { from: number; to: number; seed?: number }): Promise<GenSummary> {
  const rules = await loadRules(db);
  const marks = rules.get<Record<string, number>>("exam.marks_distribution");
  const mix = rules.get<Record<string, number[]>>("l3.difficulty_mix");
  const window = rules.get<number>("l3.no_repeat_window");
  const eligible = rules.get<string[]>("path.eligible_classes");
  const rnd = mulberry32(opts.seed ?? 52);

  const rows = await db.question.findMany({
    where: { status: "PUBLISHED", OR: [{ kind: "TOPIC" }, { kind: "HISTORICAL", verifyClass: { in: eligible } }] },
    select: { id: true, difficulty: true, subtopic: { select: { topicId: true, topic: { select: { subject: { select: { code: true, order: true } } } } } } },
    orderBy: { uid: "asc" },
  });
  const pool: PoolQ[] = rows.map((r) => ({ id: r.id, subject: r.subtopic.topic.subject.code, subjectOrder: r.subtopic.topic.subject.order, topicId: r.subtopic.topicId, diff: r.difficulty ?? "MEDIUM" }));
  const bySubject = new Map<string, PoolQ[]>();
  for (const q of pool) (bySubject.get(q.subject) ?? bySubject.set(q.subject, []).get(q.subject)!).push(q);
  const topics = await db.topic.findMany({ select: { id: true, estQuestions: true, subject: { select: { code: true } } } });

  // আগের টেস্টগুলোর ব্যবহার (প্রকাশিত হোক বা না হোক — পরিসরের বাইরেরগুলো)
  const existing = await db.modelTest.findMany({ include: { questions: { select: { questionId: true } } } });
  const lastUsed = new Map<string, number>();
  const useCount = new Map<string, number>();
  const published = new Set(existing.filter((m) => m.status !== "DRAFT").map((m) => m.no));
  for (const m of existing.filter((x) => x.status !== "DRAFT" || x.no < opts.from || x.no > opts.to).sort((a, b) => a.no - b.no)) {
    for (const q of m.questions) {
      lastUsed.set(q.questionId, Math.max(lastUsed.get(q.questionId) ?? 0, m.no));
      useCount.set(q.questionId, (useCount.get(q.questionId) ?? 0) + 1);
    }
  }
  // পরিসরের খসড়া টেস্ট মুছে নতুন করে
  await db.modelTest.deleteMany({ where: { status: "DRAFT", no: { gte: opts.from, lte: opts.to } } });

  const summary: GenSummary = { generated: [], skippedPublished: [], warnings: [], poolSize: pool.length };
  for (let no = opts.from; no <= opts.to; no++) {
    if (published.has(no)) { summary.skippedPublished.push(no); continue; }
    const tier = tierOf(no);
    const [pe, pm, ph] = mix[String(tier)];
    const chosen: PoolQ[] = [];
    const warn: string[] = [];
    const diffCount: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };

    for (const [code, quota] of Object.entries(marks)) {
      const sp = bySubject.get(code) ?? [];
      const tw = Object.fromEntries(topics.filter((t) => t.subject.code === code).map((t) => [String(t.id), t.estQuestions ?? 0]));
      const topicNeed = new Map(Object.entries(apportion(tw, quota)).map(([k, v]) => [Number(k), v]));
      const dNeed = apportion({ EASY: pe, MEDIUM: pm, HARD: ph }, quota) as Record<Difficulty, number>;
      const fresh = (q: PoolQ) => !lastUsed.has(q.id) || no - lastUsed.get(q.id)! > window;
      let cands = sp.filter(fresh);
      if (cands.length < quota) {
        warn.push(`${code}: পুনরাবৃত্তিহীন প্রশ্ন ${cands.length}টি (লাগে ${quota}); আগে ব্যবহৃত প্রশ্ন থেকে পূরণ`);
        cands = [...sp].sort((a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0));
      }
      if (cands.length < quota) warn.push(`${code}: মোট প্রশ্নই ${cands.length}টি (লাগে ${quota})`);
      const keyed = cands.map((q) => ({ q, r: rnd() }));
      const picked = new Set<string>();
      for (let k = 0; k < Math.min(quota, cands.length); k++) {
        let best: { q: PoolQ; s: number } | null = null;
        for (const { q, r } of keyed) {
          if (picked.has(q.id)) continue;
          const s = ((topicNeed.get(q.topicId) ?? 0) > 0 ? 4 : 0) + (dNeed[q.diff] > 0 ? 2 : 0) - Math.min(1.5, (useCount.get(q.id) ?? 0) * 0.5) + r;
          if (!best || s > best.s) best = { q, s };
        }
        if (!best) break;
        picked.add(best.q.id);
        chosen.push(best.q);
        topicNeed.set(best.q.topicId, (topicNeed.get(best.q.topicId) ?? 0) - 1);
        dNeed[best.q.diff]--;
        diffCount[best.q.diff]++;
      }
    }
    // বিসিএস প্রশ্নপত্রের মতো বিষয় অনুযায়ী সাজানো; বিষয়ের ভেতরে এলোমেলো
    chosen.sort((a, b) => a.subjectOrder - b.subjectOrder || rnd() - 0.5);
    for (const q of chosen) {
      lastUsed.set(q.id, no);
      useCount.set(q.id, (useCount.get(q.id) ?? 0) + 1);
    }
    const subjCount = Object.fromEntries(Object.keys(marks).map((c) => [c, chosen.filter((q) => q.subject === c).length]));
    const mt = await db.modelTest.create({
      data: {
        no, tier, status: "DRAFT",
        durationMin: rules.get<number>("l3.duration_min"),
        negativeMark: rules.get<number>("l3.negative_mark"),
        blueprint: { subjects: subjCount, target: marks, difficulty: diffCount, warnings: warn, seed: opts.seed ?? 52 },
        questions: { create: chosen.map((q, i) => ({ questionId: q.id, position: i + 1 })) },
      },
    });
    await db.learningTask.updateMany({ where: { key: `L3:MT:${String(no).padStart(3, "0")}` }, data: { modelTestId: mt.id } });
    summary.generated.push(no);
    for (const w of warn) summary.warnings.push({ no, message: w });
  }
  return summary;
}

/** অ্যাডমিনের অনুমোদন: খসড়া → প্রকাশিত (এরপর আর বদলায় না)। */
export async function approveModelTests(db: PrismaClient, from: number, to: number, adminId?: string) {
  const r = await db.modelTest.updateMany({ where: { status: { in: ["DRAFT", "APPROVED"] }, no: { gte: from, lte: to } }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await db.auditLog.create({ data: { actorId: adminId ?? null, action: "approve_model_tests", entity: "ModelTest", entityId: `${from}-${to}`, data: { count: r.count } } });
  return r.count;
}
