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
        const r = await tx.caChapter.upsert({ where: { bankKey_no: { bankKey, no: c.no } }, update: { nameBn: c.nameBn }, create: { bankKey, ...c } });
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

      await tx.caBank.create({
        data: { bankKey, name: p.name, title: p.title, version: p.version, verifiedBn: p.verifiedBn, verifiedOn: p.verifiedOn, howToUse: p.howToUse, questions: p.questions.length, importedBy: by ?? null },
      });
      return { bankKey, added, updated, reset, retired, chapters: p.chapters.length, revision: p.revision.length, sources: p.sources.length };
    },
    { timeout: 120_000 },
  );
}
