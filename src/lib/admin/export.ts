/**
 * Data Export ও Backup — অ্যাডমিন প্যানেলের ডাউনলোড এবং `npm run backup` দুটোই এটি ব্যবহার করে।
 * পূর্ণ Backup-এ সক্রিয় সেশন ও রিসেট-টোকেন থাকে না (নিরাপত্তা); পাসওয়ার্ড শুধু হ্যাশ আকারে।
 * প্রোডাকশনে এর পাশাপাশি হোস্টেড PostgreSQL-এর নিজস্ব দৈনিক Backup (pg_dump) চালু রাখতে হবে।
 */
import type { PrismaClient } from "@prisma/client";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number | null | undefined)[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

export async function questionsCsv(db: PrismaClient) {
  const qs = await db.question.findMany({ orderBy: [{ kind: "asc" }, { uid: "asc" }], include: { subtopic: true, exam: true } });
  return toCsv([
    ["uid", "kind", "status", "subtopic_code", "question", "option_a", "option_b", "option_c", "option_d", "answer", "explanation", "explanation_status", "difficulty", "source", "bcs", "question_no", "verify_class"],
    ...qs.map((q) => [q.uid, q.kind, q.status, q.subtopic.code, q.text, ...q.options, q.correctIndex != null ? LETTERS[q.correctIndex] : "", q.explanation, q.explanationStatus, q.difficulty, q.source, q.exam?.bcsNo, q.examQNo, q.verifyClass]),
  ]);
}

export async function questionsJson(db: PrismaClient) {
  const qs = await db.question.findMany({ orderBy: [{ kind: "asc" }, { uid: "asc" }], include: { subtopic: { select: { code: true } }, exam: { select: { bcsNo: true } } } });
  return JSON.stringify(
    qs.map((q) => ({ uid: q.uid, kind: q.kind, status: q.status, subtopic_code: q.subtopic.code, question: q.text, options: q.options, answer: q.correctIndex, explanation: q.explanation, explanation_status: q.explanationStatus, difficulty: q.difficulty, source: q.source, bcs: q.exam?.bcsNo ?? null, question_no: q.examQNo, verify_class: q.verifyClass })),
    null,
    1,
  );
}

export async function progressCsv(db: PrismaClient) {
  const users = await db.user.findMany({ where: { role: "STUDENT" }, include: { profile: true }, orderBy: { createdAt: "asc" } });
  const [done, levelTotals, attempts] = await Promise.all([
    db.$queryRaw<{ userId: string; no: number; n: number }[]>`
      select p."userId", l.no, count(*)::int as n from "StudentTaskProgress" p join "LearningTask" t on t.id = p."taskId" join "LearningLevel" l on l.id = t."levelId"
      where p.state = 'COMPLETED' group by p."userId", l.no`,
    db.$queryRaw<{ no: number; n: number }[]>`select l.no, count(*)::int as n from "LearningTask" t join "LearningLevel" l on l.id = t."levelId" where t.active group by l.no`,
    db.testAttempt.groupBy({ by: ["userId"], where: { submittedAt: { not: null } }, _count: true }),
  ]);
  const tot = new Map(levelTotals.map((x) => [x.no, x.n]));
  const d = (u: string, no: number) => done.find((x) => x.userId === u && x.no === no)?.n ?? 0;
  return toCsv([
    ["email", "name", "phone", "joined", "last_login", `level1_done_of_${tot.get(1) ?? 0}`, `level2_done_of_${tot.get(2) ?? 0}`, `level3_done_of_${tot.get(3) ?? 0}`, "tests_submitted", "disabled"],
    ...users.map((u) => [u.email, u.profile?.name, u.profile?.phone, u.createdAt.toISOString(), u.lastLoginAt?.toISOString(), d(u.id, 1), d(u.id, 2), d(u.id, 3), attempts.find((a) => a.userId === u.id)?._count ?? 0, u.disabled ? "yes" : ""]),
  ]);
}

/** পূর্ণ Backup (JSON): পুনরুদ্ধারের জন্য প্রতিটি টেবিলের সারি। */
export async function fullBackup(db: PrismaClient) {
  const [users, profiles, subjects, topics, subtopics, exams, questions, families, familyLinks, batches, levels, tasks, prereqs, rules, progress, attempts, answers, stats, revisions, mastery, modelTests, mtq, bookmarks, achievements, userAch, audit] = await Promise.all([
    db.user.findMany(), db.studentProfile.findMany(), db.subject.findMany(), db.topic.findMany(), db.subtopic.findMany(), db.exam.findMany(),
    db.question.findMany(), db.repeatFamily.findMany(), db.questionFamily.findMany(), db.importBatch.findMany(), db.learningLevel.findMany(),
    db.learningTask.findMany(), db.taskPrerequisite.findMany(), db.ruleSetting.findMany(), db.studentTaskProgress.findMany(), db.testAttempt.findMany(),
    db.attemptAnswer.findMany(), db.questionStat.findMany(), db.revisionSession.findMany(), db.masteryRecord.findMany(), db.modelTest.findMany(),
    db.modelTestQuestion.findMany(), db.bookmark.findMany(), db.achievement.findMany(), db.userAchievement.findMany(), db.auditLog.findMany(),
  ]);
  return JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      note: "সক্রিয় সেশন ও পাসওয়ার্ড-রিসেট টোকেন ইচ্ছাকৃতভাবে বাদ। পাসওয়ার্ড শুধু bcrypt-হ্যাশ।",
      tables: { users, profiles, subjects, topics, subtopics, exams, questions, families, familyLinks, batches, levels, tasks, prereqs, rules, progress, attempts, answers, stats, revisions, mastery, modelTests, mtq, bookmarks, achievements, userAch, audit },
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
  );
}
