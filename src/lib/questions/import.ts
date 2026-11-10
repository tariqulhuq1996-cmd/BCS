/**
 * টপিকভিত্তিক (Level 2) প্রশ্নের Bulk Import — CSV বা JSON।
 * Phase 08-এর অ্যাডমিন প্যানেলও এই একই ফাংশন ব্যবহার করবে।
 *
 * নিয়ম:
 *  - প্রতিটি সারি যাচাই: উপবিষয় কোড, প্রশ্ন, ৪টি ভিন্ন অপশন, সঠিক উত্তর।
 *  - হুবহু একই প্রশ্ন (লেখা + অপশন, ক্রম-নিরপেক্ষ) ডেটাবেসে বা একই ফাইলে থাকলে বাদ।
 *  - প্রায়-একই প্রশ্ন (একই উপবিষয়ে অক্ষর-ত্রয়ী মিল ≥ ৮০%) — "সামান্য পরিবর্তিত সংস্করণ" — খসড়া হিসেবে আসে,
 *    সঙ্গে কোন প্রশ্নের সঙ্গে মিল তার টীকা; অ্যাডমিন যাচাই করে সিদ্ধান্ত নেবেন।
 *  - ডিফল্ট অবস্থা DRAFT: যাচাই না হওয়া পর্যন্ত শিক্ষার্থীর পথে আসে না।
 */
import type { Difficulty, PrismaClient, QuestionStatus } from "@prisma/client";
import { normalizeOption, normalizeText, questionHash } from "./hash";

export type ImportRow = {
  uid?: string;
  subtopicCode: string;
  text: string;
  options: string[];
  answer: number;
  explanation?: string;
  difficulty?: Difficulty;
  source?: string;
  questionType?: string;
};
export type RowError = { row: number; message: string };
export type ImportReport = {
  rows: number;
  inserted: number;
  duplicates: { row: number; uid?: string; matches: string }[];
  nearDuplicates: { row: number; uid: string; matches: string; similarity: number }[];
  errors: RowError[];
  batchId?: number;
  dryRun: boolean;
};

const LETTER: Record<string, number> = { ক: 0, খ: 1, গ: 2, ঘ: 3, a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3, "১": 0, "২": 1, "৩": 2, "৪": 3 };
const DIFF: Record<string, Difficulty> = { easy: "EASY", medium: "MEDIUM", hard: "HARD", সহজ: "EASY", মাঝারি: "MEDIUM", কঠিন: "HARD" };

/** RFC 4180 CSV (উদ্ধৃতিচিহ্নের ভেতরে কমা/নতুন লাইন সমর্থিত)। */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Excel (.xlsx)-এর প্রথম শিট: প্রথম সারি কলামের নাম। */
export async function parseXlsx(buf: ArrayBuffer | Buffer): Promise<Record<string, string>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const head: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (head[i] = String(c.text ?? "").trim().toLowerCase()));
  const records: Record<string, string>[] = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const rec: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (c, i) => { if (head[i]) rec[head[i]] = String(c.text ?? "").trim(); });
    if (Object.values(rec).some((v) => v !== "")) records.push(rec);
  });
  return records;
}

/** বিভিন্ন নামের কলাম/কী থেকে একটি সাধারণ রূপে আনা। */
export function normalizeRecord(rec: Record<string, unknown>, rowNo: number): ImportRow | RowError {
  const g = (...keys: string[]) => {
    for (const k of keys) {
      const v = rec[k] ?? rec[k.toLowerCase()];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return undefined;
  };
  const options = Array.isArray(rec.options)
    ? (rec.options as unknown[]).map((o) => String(o ?? "").trim())
    : [g("option_a", "a", "ক", "option1"), g("option_b", "b", "খ", "option2"), g("option_c", "c", "গ", "option3"), g("option_d", "d", "ঘ", "option4")].map((o) => o ?? "");
  const subtopicCode = g("subtopic_code", "subtopiccode", "subtopic", "উপবিষয় কোড");
  const text = g("question", "text", "প্রশ্ন");
  const ansRaw = g("answer", "correct", "উত্তর");
  if (!subtopicCode) return { row: rowNo, message: "উপবিষয় কোড নেই" };
  if (!text) return { row: rowNo, message: "প্রশ্নের লেখা নেই" };
  if (options.length !== 4 || options.some((o) => !o)) return { row: rowNo, message: "ঠিক ৪টি অপশন লাগবে (কোনোটি ফাঁকা নয়)" };
  if (new Set(options.map(normalizeOption)).size !== 4) return { row: rowNo, message: "দুটি অপশন একই" };
  let answer = ansRaw != null ? LETTER[ansRaw.toLowerCase()] : undefined;
  if (answer == null && ansRaw != null) {
    const i = options.findIndex((o) => normalizeOption(o) === normalizeOption(ansRaw));
    if (i >= 0) answer = i;
  }
  if (answer == null) return { row: rowNo, message: `সঠিক উত্তর বোঝা যায়নি ("${ansRaw ?? ""}") — ক/খ/গ/ঘ, A–D, ১–৪ অথবা অপশনের লেখা দিন` };
  const diffRaw = g("difficulty", "কঠিনতা");
  if (diffRaw && !DIFF[diffRaw.toLowerCase()]) return { row: rowNo, message: `কঠিনতা বোঝা যায়নি ("${diffRaw}")` };
  return {
    uid: g("uid", "id"),
    subtopicCode: subtopicCode.toUpperCase(),
    text,
    options,
    answer,
    explanation: g("explanation", "ব্যাখ্যা"),
    difficulty: diffRaw ? DIFF[diffRaw.toLowerCase()] : undefined,
    source: g("source", "উৎস"),
    questionType: g("question_type", "type", "ধরন"),
  };
}

const trigrams = (s: string) => {
  const t = normalizeText(s);
  const set = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
  return set;
};
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export async function importQuestions(
  db: PrismaClient,
  records: Record<string, unknown>[],
  opts: { source: string; format: string; status?: QuestionStatus; dryRun?: boolean; createdBy?: string; nearThreshold?: number },
): Promise<ImportReport> {
  const status = opts.status ?? "DRAFT";
  const near = opts.nearThreshold ?? 0.8;
  const report: ImportReport = { rows: records.length, inserted: 0, duplicates: [], nearDuplicates: [], errors: [], dryRun: !!opts.dryRun };

  const subs = new Map((await db.subtopic.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]));
  const existing = await db.question.findMany({ select: { uid: true, textHash: true, text: true, options: true, subtopicId: true } });
  const byHash = new Map(existing.map((q) => [q.textHash, q.uid]));
  const uids = new Set(existing.map((q) => q.uid));
  const bySub = new Map<number, { uid: string; tri: Set<string> }[]>();
  for (const q of existing) {
    const list = bySub.get(q.subtopicId) ?? [];
    list.push({ uid: q.uid, tri: trigrams(q.text + " " + q.options.join(" ")) });
    bySub.set(q.subtopicId, list);
  }
  const seq = new Map<string, number>();

  type Ready = ImportRow & { rowNo: number; subtopicId: number; hash: string; uidFinal: string; note?: string; status: QuestionStatus };
  const ready: Ready[] = [];
  records.forEach((rec, i) => {
    const rowNo = i + 2; // CSV-এ মাথার সারি ১
    const r = normalizeRecord(rec, rowNo);
    if ("message" in r) return void report.errors.push(r);
    const subtopicId = subs.get(r.subtopicCode);
    if (!subtopicId) return void report.errors.push({ row: rowNo, message: `অজানা উপবিষয় কোড "${r.subtopicCode}"` });
    const hash = questionHash(r.text, r.options);
    const dupOf = byHash.get(hash);
    if (dupOf) return void report.duplicates.push({ row: rowNo, uid: r.uid, matches: dupOf });

    let uidFinal = r.uid;
    if (uidFinal && uids.has(uidFinal)) return void report.errors.push({ row: rowNo, message: `uid "${uidFinal}" আগে থেকেই আছে` });
    if (!uidFinal) {
      let n = seq.get(r.subtopicCode) ?? existing.filter((q) => q.subtopicId === subtopicId && q.uid.startsWith(`T-${r.subtopicCode}-`)).length;
      do uidFinal = `T-${r.subtopicCode}-${String(++n).padStart(4, "0")}`;
      while (uids.has(uidFinal));
      seq.set(r.subtopicCode, n);
    }
    uids.add(uidFinal);
    byHash.set(hash, uidFinal);

    const tri = trigrams(r.text + " " + r.options.join(" "));
    let best = { uid: "", s: 0 };
    for (const e of bySub.get(subtopicId) ?? []) {
      const s = jaccard(tri, e.tri);
      if (s > best.s) best = { uid: e.uid, s };
    }
    let rowStatus = status;
    let note: string | undefined;
    if (best.s >= near) {
      report.nearDuplicates.push({ row: rowNo, uid: uidFinal, matches: best.uid, similarity: Math.round(best.s * 100) });
      rowStatus = "DRAFT";
      note = `সম্ভাব্য প্রায়-একই প্রশ্ন: ${best.uid} (মিল ${Math.round(best.s * 100)}%)`;
    }
    const list = bySub.get(subtopicId) ?? [];
    list.push({ uid: uidFinal, tri });
    bySub.set(subtopicId, list);
    ready.push({ ...r, rowNo, subtopicId, hash, uidFinal, note, status: rowStatus });
  });

  if (opts.dryRun) {
    report.inserted = ready.length;
    return report;
  }
  const batch = await db.importBatch.create({ data: { source: opts.source, format: opts.format, rows: records.length, inserted: 0, duplicates: report.duplicates.length, createdBy: opts.createdBy } });
  report.batchId = batch.id;
  for (let i = 0; i < ready.length; i += 500) {
    await db.question.createMany({
      data: ready.slice(i, i + 500).map((r) => ({
        uid: r.uidFinal,
        kind: "TOPIC" as const,
        text: r.text,
        options: r.options,
        correctIndex: r.answer,
        explanation: r.explanation ?? null,
        explanationStatus: r.explanation ? ("DRAFT" as const) : ("NONE" as const),
        subtopicId: r.subtopicId,
        difficulty: r.difficulty ?? null,
        questionType: r.questionType ?? null,
        source: r.source ?? null,
        status: r.status,
        verifyNote: r.note ?? null,
        textHash: r.hash,
        importBatchId: batch.id,
      })),
    });
  }
  report.inserted = ready.length;
  await db.importBatch.update({
    where: { id: batch.id },
    data: { inserted: report.inserted, errors: report.errors.length || report.nearDuplicates.length ? { errors: report.errors, nearDuplicates: report.nearDuplicates } : undefined },
  });
  return report;
}
