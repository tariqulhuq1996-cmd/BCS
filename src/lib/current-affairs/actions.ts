"use server";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { answerQuestion, type CaFeedback } from "./service";

export async function answerCaAction(questionId: string, choice: number): Promise<CaFeedback | null> {
  const user = await requireUser("/current-affairs");
  if (typeof questionId !== "string" || questionId.length > 40) return null;
  return answerQuestion(prisma, user.id, questionId, Number(choice));
}
