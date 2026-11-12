import type { PrismaClient } from "@prisma/client";

/** শিক্ষার্থী এই প্রশ্নটি কোনো জমা দেওয়া পরীক্ষায় পেয়েছেন কি না — তবেই উত্তর দেখা, সংরক্ষণ বা অভিযোগ চলে। */
export async function answeredBy(db: PrismaClient, userId: string, questionId: string): Promise<boolean> {
  const a = await db.attemptAnswer.findFirst({ where: { questionId, attempt: { userId, submittedAt: { not: null } } }, select: { questionId: true } });
  return !!a;
}
