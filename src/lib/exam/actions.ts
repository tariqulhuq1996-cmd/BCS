"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ExamError, acknowledgeReview, saveAnswer, startStep, submitAttempt } from "./service";

async function uid() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u.id;
}

function stepPath(taskKey: string) {
  const [lvl, kind, ref] = taskKey.split(":");
  if (lvl === "L1") return kind === "FINAL" ? "/level-1/final" : `/level-1/${ref}`;
  return "/dashboard";
}

/** ফর্ম থেকে: বর্তমান ধাপের পরীক্ষা শুরু/চালিয়ে যাওয়া। */
export async function startStepAction(fd: FormData) {
  const userId = await uid();
  const taskKey = String(fd.get("taskKey") ?? "");
  const mode = fd.get("mode") === "practice" ? "practice" : "step";
  let id: string;
  try {
    id = await startStep(prisma, userId, taskKey, mode);
  } catch (e) {
    if (e instanceof ExamError) redirect(`${stepPath(taskKey)}?e=${e.code}`);
    throw e;
  }
  redirect(`/test/${id}`);
}

/** পরীক্ষার পর্দা থেকে প্রতিটি উত্তর সংরক্ষণ। */
export async function saveAnswerAction(attemptId: string, qid: string, display: number | null, marked: boolean, unsure: boolean): Promise<{ ok: boolean; error?: string }> {
  const userId = await uid();
  try {
    await saveAnswer(prisma, userId, attemptId, qid, display, marked, unsure);
    return { ok: true };
  } catch (e) {
    if (e instanceof ExamError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function submitAttemptAction(attemptId: string) {
  const userId = await uid();
  try {
    await submitAttempt(prisma, userId, attemptId);
  } catch (e) {
    if (!(e instanceof ExamError && e.code === "SUBMITTED")) throw e; // আগেই জমা হলে সরাসরি ফলাফলে
  }
  redirect(`/result/${attemptId}`);
}

export async function acknowledgeReviewAction(fd: FormData) {
  const userId = await uid();
  const taskKey = String(fd.get("taskKey") ?? "");
  await acknowledgeReview(prisma, userId, taskKey);
  redirect(stepPath(taskKey));
}
