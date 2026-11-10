/** অনুমোদিত Level 2 লক্ষ্য CSV-তে (প্রশ্ন-তৈরির প্রম্পটে সংযুক্ত করার জন্য):  npx tsx scripts/export-level2-targets.ts */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
const db = new PrismaClient();
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
(async () => {
  const subs = await db.subtopic.findMany({ include: { topic: { include: { subject: true } } } });
  subs.sort((a, b) => ["A", "B", "C", "D"].indexOf(a.priorityGrade ?? "D") - ["A", "B", "C", "D"].indexOf(b.priorityGrade ?? "D") || a.topic.subject.order - b.topic.subject.order || (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  const lines = ["priority,subtopic_code,subject,topic,subtopic,target_new_questions,past_bcs_questions,tip"];
  for (const s of subs) lines.push([s.priorityGrade ?? "", s.code, q(s.topic.subject.nameBn), q(s.topic.nameBn), q(s.nameBn), s.targetQuestions ?? 0, s.histTotal ?? 0, q(s.tipBn ?? "")].join(","));
  const out = path.resolve(__dirname, "..", "docs", "level2_targets.csv");
  writeFileSync(out, "﻿" + lines.join("\n") + "\n");
  console.log(`${subs.length} সারি, মোট ${subs.reduce((a, s) => a + (s.targetQuestions ?? 0), 0)} → docs/level2_targets.csv`);
  await db.$disconnect();
})();
