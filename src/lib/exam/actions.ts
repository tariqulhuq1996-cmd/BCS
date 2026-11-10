"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ExamError, acknowledgeModelTestReview, acknowledgeReview, addTime, saveAnswer, startMistakePractice, startRevision, startStep, submitAttempt } from "./service";

async function uid() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u.id;
}

/** কাজের key থেকে তার পাতার ঠিকানা। */
function stepPath(taskKey: string) {
  const [lvl, kind, ref] = taskKey.split(":");
  if (lvl === "L1") return kind === "FINAL" ? "/level-1/final" : `/level-1/${ref}`;
  if (lvl === "L2") return kind === "FINAL" ? "/level-2/final" : kind === "CHECKPOINT" ? `/level-2/checkpoint/${ref}` : `/level-2/${ref}`;
  if (lvl === "L3") return kind === "MT" ? `/level-3/${Number(ref)}` : "/level-3";
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

/** দৈনিক Revision-এর পরের সেট। */
export async function startRevisionAction() {
  const userId = await uid();
  let id: string;
  try {
    id = await startRevision(prisma, userId);
  } catch (e) {
    if (e instanceof ExamError) redirect(`/revision?e=${e.code}`);
    throw e;
  }
  redirect(`/test/${id}`);
}

/** ভুলের ভান্ডার থেকে অনুশীলন (ঐচ্ছিক: একটি বিষয়)। */
export async function startMistakeAction(fd: FormData) {
  const userId = await uid();
  const subject = String(fd.get("subject") ?? "") || undefined;
  let id: string;
  try {
    id = await startMistakePractice(prisma, userId, subject);
  } catch (e) {
    if (e instanceof ExamError) redirect(`/mistakes?e=${e.code}`);
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

/** একটি প্রশ্নে কাটানো সময় (মিলিসেকেন্ড) — প্রশ্ন বদলানোর সময় পর্দা থেকে। */
export async function addTimeAction(attemptId: string, qid: string, ms: number) {
  const userId = await uid();
  try {
    await addTime(prisma, userId, attemptId, qid, ms);
  } catch (e) {
    if (!(e instanceof ExamError)) throw e;
  }
}

/** Model Test-এর ভুলগুলো দেখা শেষ → টেস্ট সম্পন্ন, পরেরটি খোলে। */
export async function acknowledgeModelTestAction(fd: FormData) {
  const userId = await uid();
  const attemptId = String(fd.get("attemptId") ?? "");
  await acknowledgeModelTestReview(prisma, userId, attemptId);
  redirect(`/result/${attemptId}`);
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
