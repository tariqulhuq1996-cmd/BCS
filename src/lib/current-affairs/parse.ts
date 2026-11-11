/**
 * Current Affairs প্রশ্নব্যাংক (.docx) পড়া। নথির কাঠামো (সংস্করণ ১.০):
 *   ৩. বিষয়ভিত্তিক প্রশ্নব্যাংক — অধ্যায় (Heading 2) → "১. [A] ⚠ প্রশ্ন", i/ii/iii বিবৃতি, "নিচের কোনটি সঠিক?", ক)–ঘ) অপশন
 *   ৫. উত্তর ও ব্যাখ্যা — "সঠিক উত্তর: ক) …", "ব্যাখ্যা:", "মনে রাখুন:", "উৎস: … · ঘটনার/প্রকাশের তারিখ: … · যাচাই: …", "⚠ পরিবর্তনশীল: কারণ"
 *   ৬. Quick Revision — Heading 2 গোষ্ঠী + টেবিল (বিষয় ¦ তথ্য)
 *   ৭. তথ্যসূত্র — টেবিল (নং ¦ উৎস ¦ লিংক)
 * কিছু অনুমান করে বসানো হয় না: নথিতে যা নেই তা ফাঁকা থাকে; অমিল পেলে ত্রুটি/সতর্কতা।
 */
import JSZip from "jszip";

export type CaParsedQuestion = {
  no: number;
  chapterNo: number;
  priority: "A" | "B" | "C";
  text: string;
  statements: string[];
  stemTail: string | null;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  remember: string | null;
  sourceText: string | null;
  eventDate: string | null;
  verifiedBn: string | null;
  volatile: boolean;
  volatileReason: string | null;
};

export type CaParsed = {
  title: string;
  version: string | null;
  verifiedBn: string | null;
  verifiedOn: Date | null;
  howToUse: string[];
  chapters: { no: number; nameBn: string }[];
  questions: CaParsedQuestion[];
  revision: { group: string; topic: string; fact: string }[];
  sources: { no: number; name: string; url: string | null }[];
  errors: string[];
  warnings: string[];
};

const LETTERS = ["ক", "খ", "গ", "ঘ"];
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

export const bnToInt = (s: string) => Number(s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));

/** "১১ নভেম্বর ২০২৬" → Date (ঢাকার মধ্যরাত); না মিললে null */
export function parseBnDate(s: string | null | undefined): Date | null {
  const m = s?.match(/([০-৯\d]{1,2})\s+(\S+)\s+([০-৯\d]{4})/);
  if (!m) return null;
  const mon = BN_MONTHS.indexOf(m[2]);
  if (mon < 0) return null;
  return new Date(Date.UTC(bnToInt(m[3]), mon, bnToInt(m[1])) - 6 * 3600e3);
}

type Line = { kind: "P"; style: string; text: string } | { kind: "T"; cells: string[] };

function decode(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function runText(xml: string) {
  return decode(
    (xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
      .map((t) => (t.startsWith("<w:tab") ? " " : t.startsWith("<w:br") ? " " : t.replace(/<[^>]+>/g, "")))
      .join(""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function docxXmlToLines(xml: string): Line[] {
  const body = xml.slice(xml.indexOf("<w:body>"));
  const out: Line[] = [];
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const b = m[0];
    if (b.startsWith("<w:tbl>")) {
      for (const r of b.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [])
        out.push({ kind: "T", cells: (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runText).filter(Boolean).join(" ")) });
    } else {
      const text = runText(b);
      if (text) out.push({ kind: "P", style: b.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "", text });
    }
  }
  return out;
}

const Q_RE = /^([০-৯\d]+)\.\s*\[([ABC])\]\s*(⚠\s*)?(.+)$/;
const OPT_RE = /^([কখগঘ])\)\s*(.+)$/;
const STMT_RE = /^(i{1,3}|iv|v)\.\s*(.+)$/;

export async function parseCurrentAffairsDocx(buf: ArrayBuffer | Uint8Array | Buffer): Promise<CaParsed> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("এটি বৈধ .docx ফাইল নয় (word/document.xml নেই)।");
  return parseLines(docxXmlToLines(await doc.async("string")));
}

export function parseLines(lines: Line[]): CaParsed {
  const errors: string[] = [];
  const warnings: string[] = [];
  const res: CaParsed = { title: "", version: null, verifiedBn: null, verifiedOn: null, howToUse: [], chapters: [], questions: [], revision: [], sources: [], errors, warnings };

  // অধ্যায়-ভাগ: Heading1 "৩. …" ইত্যাদি
  const h1 = lines.map((l, i) => (l.kind === "P" && /^Heading1/.test(l.style) ? { i, n: bnToInt(l.text.match(/^([০-৯\d]+)\./)?.[1] ?? "0") } : null)).filter((x): x is { i: number; n: number } => !!x && x.n > 0);
  const part = (n: number) => {
    const k = h1.findIndex((h) => h.n === n);
    if (k < 0) return [];
    return lines.slice(h1[k].i + 1, k + 1 < h1.length ? h1[k + 1].i : lines.length);
  };

  // মলাট: শুরুর অনুচ্ছেদ, সারাংশ-টেবিল, সংস্করণ, "কীভাবে ব্যবহার করবেন"
  const firstH1 = h1.length ? h1[0].i : lines.length;
  const coverIdx = lines.findIndex((l) => l.kind === "T");
  res.title = lines.slice(0, coverIdx < 0 ? 3 : coverIdx).flatMap((l) => (l.kind === "P" ? [l.text] : [])).slice(0, 3).join(" — ") || "Current Affairs প্রশ্নব্যাংক";
  for (const l of lines.slice(0, firstH1)) {
    if (l.kind === "T" && /যাচাইয়ের তারিখ/.test(l.cells[0] ?? "")) res.verifiedBn = l.cells[1] ?? null;
    if (l.kind === "P" && /^সংস্করণ/.test(l.text)) res.version = l.text.split("·")[0].replace("সংস্করণ", "").trim() || null;
  }
  res.verifiedOn = parseBnDate(res.verifiedBn);
  const howIdx = lines.findIndex((l) => l.kind === "P" && l.text === "কীভাবে ব্যবহার করবেন");
  if (howIdx >= 0)
    for (const l of lines.slice(howIdx + 1)) {
      if (l.kind !== "P" || !/^ListParagraph/.test(l.style)) break;
      res.howToUse.push(l.text);
    }

  // ৩. প্রশ্ন
  let chapterNo = 0;
  let cur: CaParsedQuestion | null = null;
  const qs = new Map<number, CaParsedQuestion>();
  const push = () => {
    if (!cur) return;
    if (cur.options.length !== 4) errors.push(`প্রশ্ন ${cur.no}: ৪টি অপশন নেই (${cur.options.length}টি)`);
    if (qs.has(cur.no)) errors.push(`প্রশ্ন ${cur.no}: নম্বর দুবার আছে`);
    qs.set(cur.no, cur);
    cur = null;
  };
  for (const l of part(3)) {
    if (l.kind !== "P") continue;
    if (/^Heading2/.test(l.style)) {
      push();
      const m = l.text.match(/^([০-৯\d]+)\.\s*(.+?)(?:\s*\([^)]*প্রশ্ন\))?$/);
      if (m) {
        chapterNo = bnToInt(m[1]);
        res.chapters.push({ no: chapterNo, nameBn: m[2].trim() });
      }
      continue;
    }
    const q = l.text.match(Q_RE);
    if (q) {
      push();
      if (!chapterNo) errors.push(`প্রশ্ন ${q[1]}: কোনো অধ্যায়ের অধীনে নেই`);
      cur = { no: bnToInt(q[1]), chapterNo, priority: q[2] as "A" | "B" | "C", text: q[4].trim(), statements: [], stemTail: null, options: [], correctIndex: -1, explanation: null, remember: null, sourceText: null, eventDate: null, verifiedBn: null, volatile: !!q[3], volatileReason: null };
      continue;
    }
    if (!cur) continue;
    const o = l.text.match(OPT_RE);
    const s = l.text.match(STMT_RE);
    if (o) cur.options.push(o[2].trim());
    else if (s && !cur.options.length) cur.statements.push(`${s[1]}. ${s[2].trim()}`);
    else if (!cur.options.length) cur.stemTail = cur.stemTail ? `${cur.stemTail} ${l.text}` : l.text;
  }
  push();

  // ৫. উত্তর ও ব্যাখ্যা
  let ans: CaParsedQuestion | null = null;
  const seenAns = new Set<number>();
  for (const l of part(5)) {
    if (l.kind !== "P" || /^Heading/.test(l.style)) continue;
    const q = l.text.match(Q_RE);
    if (q) {
      const no = bnToInt(q[1]);
      ans = qs.get(no) ?? null;
      if (!ans) errors.push(`উত্তর-অংশে প্রশ্ন ${no} আছে, কিন্তু প্রশ্ন-অংশে নেই`);
      else seenAns.add(no);
      continue;
    }
    if (!ans) continue;
    const [label, ...rest] = l.text.split(":");
    const val = rest.join(":").trim();
    if (label === "সঠিক উত্তর") {
      const m = val.match(OPT_RE);
      const idx = m ? LETTERS.indexOf(m[1]) : -1;
      if (idx < 0) errors.push(`প্রশ্ন ${ans.no}: সঠিক উত্তর পড়া যায়নি`);
      else {
        ans.correctIndex = idx;
        if (ans.options[idx] && m && ans.options[idx] !== m[2].trim()) warnings.push(`প্রশ্ন ${ans.no}: উত্তরের লেখা অপশনের সঙ্গে হুবহু মেলে না ("${m[2].trim()}" বনাম "${ans.options[idx]}")`);
      }
    } else if (label === "ব্যাখ্যা") ans.explanation = val || null;
    else if (label === "মনে রাখুন") ans.remember = val || null;
    else if (label === "উৎস") {
      const parts = val.split(" · ");
      ans.sourceText = parts[0]?.trim() || null;
      for (const p of parts.slice(1)) {
        const [k, ...v] = p.split(":");
        if (/তারিখ/.test(k)) ans.eventDate = v.join(":").trim() || null;
        else if (/যাচাই/.test(k)) ans.verifiedBn = v.join(":").trim() || null;
      }
    } else if (/^⚠\s*পরিবর্তনশীল/.test(label)) {
      ans.volatile = true;
      ans.volatileReason = val || null;
    }
  }
  for (const q of qs.values()) {
    if (!seenAns.has(q.no)) errors.push(`প্রশ্ন ${q.no}: উত্তর-অংশে নেই`);
    else if (q.correctIndex < 0) errors.push(`প্রশ্ন ${q.no}: সঠিক উত্তর নেই`);
    if (!q.explanation) warnings.push(`প্রশ্ন ${q.no}: ব্যাখ্যা নেই`);
  }
  res.questions = [...qs.values()].sort((a, b) => a.no - b.no);

  // ৬. Quick Revision
  let group = "";
  for (const l of part(6)) {
    if (l.kind === "P" && /^Heading2/.test(l.style)) group = l.text;
    else if (l.kind === "T" && l.cells.length >= 2 && l.cells[0] !== "বিষয়" && group) res.revision.push({ group, topic: l.cells[0], fact: l.cells.slice(1).join(" — ") });
  }

  // ৭. তথ্যসূত্র
  for (const l of part(7)) {
    if (l.kind !== "T" || l.cells[0] === "নং") continue;
    const url = (l.cells[2] ?? "").trim();
    res.sources.push({ no: bnToInt(l.cells[0]) || res.sources.length + 1, name: l.cells[1] ?? "", url: /^https?:\/\//.test(url) ? url : null });
  }

  if (!res.questions.length) errors.push("কোনো প্রশ্ন পাওয়া যায়নি — নথির কাঠামো (অধ্যায় ৩ ও ৫) মিলিয়ে দেখুন।");
  return res;
}
