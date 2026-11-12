import type { PrismaClient } from "@prisma/client";
import { isValidBankKey } from "./bank-key";
import type { CaParsed } from "./parse";

export type CaImportResult = { bankKey: string; added: number; updated: number; reset: number; retired: number; chapters: number; revision: number; sources: number };

/**
 * পার্স করা প্রশ্নব্যাংক ডেটাবেসে বসানো — শুধু নির্দিষ্ট ব্যাংকের (bankKey) ভেতরে; অন্য ব্যাংক অপরিবর্তিত।
 * প্রশ্ন চেনা হয় ব্যাংক + ক্রমিক নম্বর দিয়ে:
 *  - নতুন নম্বর → যোগ; আগের নম্বর → হালনাগাদ (শিক্ষার্থীর অগ্রগতি থাকে)
 *  - প্রশ্ন বা সঠিক উত্তর বদলালে সেই প্রশ্নের অগ্রগতি মুছে যায় (পুরোনো "ঠিক" আর ঠিক নয়)
 *  - নথিতে নেই এমন পুরোনো প্রশ্ন (এই ব্যাংকের) → নিষ্ক্রিয় (মোছা হয় না)
 * এই ব্যাংকের Quick Revision ও তথ্যসূত্র প্রতিবার নতুন করে।
 */
export async function importCurrentAffairs(db: PrismaClient, p: CaParsed, bankKey: string, by?: string): Promise<CaImportResult> {
  if (!isValidBankKey(bankKey)) throw new Error(`প্রশ্নব্যাংকের key সঠিক নয়: "${bankKey}" (ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও - চিহ্ন)`);
  if (p.errors.length) throw new Error(`নথিতে ${p.errors.length}টি ত্রুটি: ${p.errors.slice(0, 3).join("; ")}`);
  return db.$transaction(
    async (tx) => {
      const chapterId: Record<number, number> = {};
      for (const c of p.chapters) {
        // অ্যাডমিন যে অধ্যায়ের নাম বদলেছেন (nameLocked), সেটির নাম নথি থেকে আর বসে না
        const prev = await tx.caChapter.findUnique({ where: { bankKey_no: { bankKey, no: c.no } }, select: { nameLocked: true } });
        const r = await tx.caChapter.upsert({ where: { bankKey_no: { bankKey, no: c.no } }, update: prev?.nameLocked ? {} : { nameBn: c.nameBn }, create: { bankKey, ...c } });
        chapterId[c.no] = r.id;
      }
      const existing = new Map(
        (await tx.caQuestion.findMany({ where: { bankKey }, select: { id: true, no: true, text: true, correctIndex: true, options: true } })).map((q) => [q.no, q]),
      );
      let added = 0, updated = 0, reset = 0;
      for (const q of p.questions) {
        const data = {
          chapterId: chapterId[q.chapterNo],
          priority: q.priority,
          text: q.text,
          statements: q.statements.length ? q.statements : undefined,
          stemTail: q.stemTail,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          remember: q.remember,
          sourceText: q.sourceText,
          eventDate: q.eventDate,
          verifiedBn: q.verifiedBn,
          volatile: q.volatile,
          volatileReason: q.volatileReason,
          active: true,
        };
        const old = existing.get(q.no);
        if (!old) {
          await tx.caQuestion.create({ data: { bankKey, no: q.no, ...data } });
          added++;
          continue;
        }
        const changed = old.text !== q.text || old.correctIndex !== q.correctIndex || JSON.stringify(old.options) !== JSON.stringify(q.options);
        await tx.caQuestion.update({ where: { id: old.id }, data });
        if (changed) reset += (await tx.caAnswer.deleteMany({ where: { questionId: old.id } })).count > 0 ? 1 : 0;
        updated++;
      }
      const keep = p.questions.map((q) => q.no);
      const retired = (await tx.caQuestion.updateMany({ where: { bankKey, no: { notIn: keep }, active: true }, data: { active: false } })).count;

      await tx.caRevisionItem.deleteMany({ where: { bankKey } });
      if (p.revision.length) await tx.caRevisionItem.createMany({ data: p.revision.map((r, i) => ({ bankKey, order: i + 1, ...r })) });
      await tx.caSource.deleteMany({ where: { bankKey } });
      if (p.sources.length) await tx.caSource.createMany({ data: p.sources.map((s) => ({ bankKey, ...s })) });

      // অ্যাডমিন প্রশ্নব্যাংকের নাম বদলে থাকলে নতুন সংস্করণেও সেই নাম থাকে
      const named = await tx.caBank.findFirst({ where: { bankKey, nameLocked: true }, orderBy: { importedAt: "desc" }, select: { name: true, title: true } });
      await tx.caBank.create({
        data: { bankKey, name: named?.name ?? p.name, title: named?.title ?? p.title, nameLocked: !!named, version: p.version, verifiedBn: p.verifiedBn, verifiedOn: p.verifiedOn, howToUse: p.howToUse, questions: p.questions.length, importedBy: by ?? null },
      });
      return { bankKey, added, updated, reset, retired, chapters: p.chapters.length, revision: p.revision.length, sources: p.sources.length };
    },
    { timeout: 120_000 },
  );
}

/**
 * প্রশ্নব্যাংক ও অধ্যায়ের নাম বদল (অ্যাডমিন বা deploy-setup থেকে)। একই key-এর সব সংস্করণে বসে এবং "lock" হয় —
 * পরে নথি আবার Import করলেও এই নাম থাকে। chapters: অধ্যায় নম্বর → নতুন নাম (যেগুলো বদলায় শুধু সেগুলো)।
 */
export async function renameCaBank(db: PrismaClient, bankKey: string, names: { name?: string; title?: string; chapters?: Record<number, string> }) {
  const clean = (v?: string) => v?.replace(/\s+/g, " ").trim();
  const name = clean(names.name);
  const title = clean(names.title);
  if (name !== undefined && (name.length < 2 || name.length > 120)) throw new Error("প্রশ্নব্যাংকের নাম ২–১২০ অক্ষরের মধ্যে দিন।");
  if (title !== undefined && (title.length < 2 || title.length > 300)) throw new Error("পূর্ণ শিরোনাম ২–৩০০ অক্ষরের মধ্যে দিন।");
  return db.$transaction(async (tx) => {
    let bank = 0, chapters = 0;
    if (name !== undefined || title !== undefined)
      bank = (await tx.caBank.updateMany({ where: { bankKey }, data: { ...(name !== undefined ? { name } : {}), ...(title !== undefined ? { title } : {}), nameLocked: true } })).count;
    for (const [no, raw] of Object.entries(names.chapters ?? {})) {
      const nameBn = clean(raw);
      if (!nameBn) continue;
      if (nameBn.length > 160) throw new Error(`অধ্যায় ${no}-এর নাম ১৬০ অক্ষরের বেশি।`);
      const cur = await tx.caChapter.findUnique({ where: { bankKey_no: { bankKey, no: Number(no) } }, select: { nameBn: true } });
      if (!cur || cur.nameBn === nameBn) continue;
      await tx.caChapter.update({ where: { bankKey_no: { bankKey, no: Number(no) } }, data: { nameBn, nameLocked: true } });
      chapters++;
    }
    return { bank, chapters };
  });
}
