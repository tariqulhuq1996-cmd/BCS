"use server";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { lockedBy } from "@/lib/progress/access";
import { answerQuestion, type CaFeedback } from "./service";

export async function answerCaAction(questionId: string, choice: number): Promise<CaFeedback | null> {
  const user = await requireUser("/current-affairs");
  if (typeof questionId !== "string" || questionId.length > 40) return null;
  if (await lockedBy(user, "CA:GATE")) return null; // ধাপ ০ শেষ না হলে সাম্প্রতিক বিষয়াবলি বন্ধ
  return answerQuestion(prisma, user.id, questionId, Number(choice));
}
