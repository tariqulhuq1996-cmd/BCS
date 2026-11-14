import type { PrismaClient } from "@prisma/client";

/**
 * শিক্ষার্থী এই প্রশ্নটি কোনো জমা দেওয়া পরীক্ষায় পেয়েছেন কি না — তবেই উত্তর দেখা, সংরক্ষণ বা অভিযোগ চলে।
 * আগে সংরক্ষণ করা প্রশ্নও গণ্য (অগ্রগতি রিসেটের পর পরীক্ষার রেকর্ড মুছলেও সংরক্ষিত প্রশ্ন ও নোট ব্যবহার করা যায়)।
 */
export async function answeredBy(db: PrismaClient, userId: string, questionId: string): Promise<boolean> {
  if (await db.bookmark.findUnique({ where: { userId_questionId: { userId, questionId } }, select: { questionId: true } })) return true;
  const a = await db.attemptAnswer.findFirst({ where: { questionId, attempt: { userId, submittedAt: { not: null } } }, select: { questionId: true } });
  return !!a;
}
