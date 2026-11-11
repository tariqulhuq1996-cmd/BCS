/**
 * Current Affairs প্রশ্নব্যাংক (.docx) পড়া। দুই ধরনের নথি চলে:
 *  ক) উত্তর আলাদা অধ্যায়ে (সাধারণ Current Affairs, সংস্করণ ১.০):
 *     "৩. বিষয়ভিত্তিক প্রশ্নব্যাংক" → অধ্যায় = নম্বরযুক্ত Heading 2; প্রশ্ন + অপশন
 *     "৫. উত্তর ও ব্যাখ্যা" → একই নম্বরের প্রশ্নের উত্তর/ব্যাখ্যা/মনে রাখুন/উৎস
 *  খ) উত্তর প্রশ্নের ঠিক নিচে (বিএনপি সরকার ও রাজনীতি, সংস্করণ ১.০):
 *     প্রতিটি Heading 1 অধ্যায়ে সারসংক্ষেপ-টেবিল + "বহুনির্বাচনি প্রশ্ন" (প্রশ্ন, অপশন, সঠিক উত্তর, ব্যাখ্যা …)
 * প্রশ্নের লাইন: "১. [A] ⚠ প্রশ্ন"; অপশন "ক) …"; বিবৃতি "i. …"; উত্তর-অংশ "সঠিক উত্তর: ক) …", "ব্যাখ্যা:", "মনে রাখুন:",
 * "উৎস: … · ঘটনার/প্রকাশের তারিখ: … · যাচাই: …", "⚠ পরিবর্তনশীল: কারণ"।
 * অন্যান্য অংশ শিরোনাম দেখে: Quick Revision / এক নজরে (টেবিল বা তালিকা), "সাল, তারিখ ও সংখ্যা" (টেবিল),
 * তথ্যসূত্র (নং ¦ উৎস ¦ লিংক), "পরিবর্তনশীল" শিরোনামের টেবিল (নং ¦ প্রসঙ্গ ¦ কারণ), প্রশ্নের অধ্যায়ের সারসংক্ষেপ-টেবিল।
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
  /** মলাটের দ্বিতীয় লাইন — ছোট নাম */
  name: string;
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

export { bankKeyFromFilename, isValidBankKey } from "./bank-key";

type Line = { kind: "P"; style: string; text: string } | { kind: "T"; cells: string[]; head: boolean };

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
      (b.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).forEach((r, i) =>
        out.push({
          kind: "T",
          head: i === 0,
          cells: (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runText).filter(Boolean).join(" ")),
        }),
      );
    } else {
      const text = runText(b);
      if (text) out.push({ kind: "P", style: b.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "", text });
    }
  }
  return out;
}

export async function parseCurrentAffairsDocx(buf: ArrayBuffer | Uint8Array | Buffer): Promise<CaParsed> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("এটি বৈধ .docx ফাইল নয় (word/document.xml নেই)।");
  return parseLines(docxXmlToLines(await doc.async("string")));
}

const Q_RE = /^([০-৯\d]+)\.\s*\[([ABC])\]\s*(⚠\s*)?(.+)$/;
const OPT_RE = /^([কখগঘ])\)\s*(.+)$/;
const STMT_RE = /^(i{1,3}|iv|v)\.\s*(.+)$/;
const NUM_HEAD_RE = /^([০-৯\d]+)\.\s*(.+?)(?:\s*\([^)]*প্রশ্ন\))?$/;
const isH1 = (l: Line) => l.kind === "P" && /^Heading1/.test(l.style);
const isH2 = (l: Line) => l.kind === "P" && /^Heading2/.test(l.style);

export function parseLines(lines: Line[]): CaParsed {
  const errors: string[] = [];
  const warnings: string[] = [];
  const res: CaParsed = { name: "", title: "", version: null, verifiedBn: null, verifiedOn: null, howToUse: [], chapters: [], questions: [], revision: [], sources: [], errors, warnings };

  // ── মলাট: প্রথম টেবিলের আগের অনুচ্ছেদ, সারাংশ-টেবিল, সংস্করণ, "কীভাবে ব্যবহার করবেন"
  const firstH1 = lines.findIndex(isH1);
  const cover = lines.slice(0, firstH1 < 0 ? lines.length : firstH1);
  const firstTable = cover.findIndex((l) => l.kind === "T");
  const coverP = cover.slice(0, firstTable < 0 ? 3 : firstTable).flatMap((l) => (l.kind === "P" ? [l.text] : []));
  res.title = coverP.slice(0, 3).join(" — ") || "Current Affairs প্রশ্নব্যাংক";
  res.name = coverP[1] ?? coverP[0] ?? res.title;
  for (const l of cover) {
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

  // ── এক পাসে: প্রশ্ন (প্রথম দেখা যেখানে, সেটিই অধ্যায়), উত্তর-অংশ, টেবিল ও তালিকা শিরোনাম অনুযায়ী
  type H = { no: number; title: string };
  let h1: H | null = null;
  let h2 = "";
  let numberedH2: H | null = null;
  let cur: CaParsedQuestion | null = null;
  const qs = new Map<number, CaParsedQuestion>();
  const answered = new Set<number>();
  const chapterNames = new Map<number, string>();
  const qSections = new Set<number>(); // যেসব Heading 1 অংশে প্রশ্ন প্রথম এসেছে
  const volatileReasons = new Map<number, string>();
  const sectionTables: { h1: H; head: string[]; rows: string[][] }[] = [];
  const revisionLater: { group: string; topic: string; fact: string }[] = [];

  const h1Kind = () => {
    const t = h1?.title ?? "";
    if (/তথ্যসূত্র|Reference/i.test(t)) return "sources";
    if (/Quick Revision|এক নজরে/i.test(t)) return "revision";
    if (/সাল|তারিখ ও সংখ্যা/.test(t)) return "dates";
    if (/Priority/i.test(t)) return "priority";
    return "other";
  };

  for (const l of lines.slice(firstH1 < 0 ? lines.length : firstH1)) {
    if (isH1(l) && l.kind === "P") {
      const m = l.text.match(NUM_HEAD_RE);
      h1 = m ? { no: bnToInt(m[1]), title: m[2].trim() } : { no: 0, title: l.text };
      h2 = "";
      numberedH2 = null;
      cur = null;
      continue;
    }
    if (isH2(l) && l.kind === "P") {
      h2 = l.text;
      const m = l.text.match(NUM_HEAD_RE);
      if (m && h1Kind() === "other") numberedH2 = { no: bnToInt(m[1]), title: m[2].trim() };
      cur = null;
      continue;
    }

    if (l.kind === "T") {
      cur = null;
      if (/পরিবর্তনশীল/.test(h2) || /পরিবর্তনশীল/.test(h1?.title ?? "")) {
        if (!l.head && l.cells.length >= 3) {
          const no = bnToInt(l.cells[0]);
          if (no) volatileReasons.set(no, l.cells[l.cells.length - 1]);
        }
        continue;
      }
      const kind = h1Kind();
      if (kind === "sources") {
        if (l.head || l.cells.length < 2) continue;
        const url = (l.cells[2] ?? "").trim();
        res.sources.push({ no: bnToInt(l.cells[0]) || res.sources.length + 1, name: l.cells[1] ?? "", url: /^https?:\/\//.test(url) ? url : null });
      } else if (kind === "revision" || kind === "dates") {
        if (!l.head && l.cells.length >= 2) revisionLater.push({ group: h2 || h1!.title, topic: l.cells[0], fact: l.cells.slice(1).filter(Boolean).join(" — ") });
      } else if (kind === "other" && h1) {
        // অধ্যায়ের সারসংক্ষেপ-টেবিল — অধ্যায়ে প্রশ্ন থাকলে পরে Quick Revision-এ যোগ হবে
        const last = sectionTables.at(-1);
        if (l.head || !last || last.h1 !== h1) sectionTables.push({ h1, head: l.head ? l.cells : [], rows: l.head ? [] : [l.cells] });
        else last.rows.push(l.cells);
      }
      continue;
    }

    // অনুচ্ছেদ
    const kind = h1Kind();
    if ((kind === "revision" || kind === "dates") && /^ListParagraph/.test(l.style)) {
      const i = l.text.indexOf(" — ");
      revisionLater.push({ group: h2 || h1!.title, topic: i > 0 ? l.text.slice(0, i).trim() : "", fact: i > 0 ? l.text.slice(i + 3).trim() : l.text });
      continue;
    }
    if (kind === "priority" || kind === "sources") continue;

    const q = l.text.match(Q_RE);
    if (q) {
      const no = bnToInt(q[1]);
      const seen = qs.get(no);
      if (seen) {
        cur = seen;
        if (q[3]) seen.volatile = true;
        continue;
      }
      const ch = numberedH2 ?? h1;
      if (!ch || !ch.no) {
        errors.push(`প্রশ্ন ${no}: কোনো নম্বরযুক্ত অধ্যায়ের অধীনে নেই`);
        cur = null;
        continue;
      }
      if (!chapterNames.has(ch.no)) chapterNames.set(ch.no, ch.title);
      if (!numberedH2 && h1) qSections.add(h1.no);
      cur = { no, chapterNo: ch.no, priority: q[2] as "A" | "B" | "C", text: q[4].trim(), statements: [], stemTail: null, options: [], correctIndex: -1, explanation: null, remember: null, sourceText: null, eventDate: null, verifiedBn: null, volatile: !!q[3], volatileReason: null };
      qs.set(no, cur);
      continue;
    }
    if (!cur) continue;

    const colon = l.text.indexOf(":");
    const label = colon > 0 ? l.text.slice(0, colon).trim() : "";
    const val = colon > 0 ? l.text.slice(colon + 1).trim() : "";
    if (label === "সঠিক উত্তর") {
      answered.add(cur.no);
      const m = val.match(OPT_RE);
      const idx = m ? LETTERS.indexOf(m[1]) : -1;
      if (idx < 0) errors.push(`প্রশ্ন ${cur.no}: সঠিক উত্তর পড়া যায়নি`);
      else {
        cur.correctIndex = idx;
        if (cur.options[idx] && m && cur.options[idx] !== m[2].trim()) warnings.push(`প্রশ্ন ${cur.no}: উত্তরের লেখা অপশনের সঙ্গে হুবহু মেলে না ("${m[2].trim()}" বনাম "${cur.options[idx]}")`);
      }
      continue;
    }
    if (label === "ব্যাখ্যা") {
      cur.explanation = val || null;
      continue;
    }
    if (label === "মনে রাখুন") {
      cur.remember = val || null;
      continue;
    }
    if (label === "উৎস") {
      const parts = val.split(" · ");
      cur.sourceText = parts[0]?.trim() || null;
      for (const p of parts.slice(1)) {
        const [k, ...v] = p.split(":");
        if (/তারিখ/.test(k)) cur.eventDate = v.join(":").trim() || null;
        else if (/যাচাই/.test(k)) cur.verifiedBn = v.join(":").trim() || null;
      }
      continue;
    }
    if (/^⚠\s*পরিবর্তনশীল/.test(label)) {
      cur.volatile = true;
      cur.volatileReason = val || null;
      continue;
    }
    if (answered.has(cur.no)) continue; // উত্তরের পরের অন্য লেখা
    const o = l.text.match(OPT_RE);
    const s = l.text.match(STMT_RE);
    if (o) {
      if (cur.options.length < 4) cur.options.push(o[2].trim());
    } else if (s && !cur.options.length) cur.statements.push(`${s[1]}. ${s[2].trim()}`);
    else if (!cur.options.length) cur.stemTail = cur.stemTail ? `${cur.stemTail} ${l.text}` : l.text;
  }

  // ── যাচাই
  for (const q of qs.values()) {
    if (q.options.length !== 4) errors.push(`প্রশ্ন ${q.no}: ৪টি অপশন নেই (${q.options.length}টি)`);
    if (!answered.has(q.no)) errors.push(`প্রশ্ন ${q.no}: সঠিক উত্তর নেই`);
    if (!q.explanation) warnings.push(`প্রশ্ন ${q.no}: ব্যাখ্যা নেই`);
    if (!q.volatileReason && volatileReasons.has(q.no)) {
      q.volatile = true;
      q.volatileReason = volatileReasons.get(q.no)!;
    }
  }
  for (const no of volatileReasons.keys()) if (!qs.has(no)) warnings.push(`পরিবর্তনশীল-তালিকায় প্রশ্ন ${no} আছে, কিন্তু প্রশ্নটি নেই`);
  res.questions = [...qs.values()].sort((a, b) => a.no - b.no);
  res.chapters = [...chapterNames.entries()].sort((a, b) => a[0] - b[0]).map(([no, nameBn]) => ({ no, nameBn }));

  // ── Quick Revision: আগে প্রশ্নের অধ্যায়গুলোর সারসংক্ষেপ-টেবিল, তারপর Revision/তারিখ-অংশ
  for (const t of sectionTables) {
    if (!qSections.has(t.h1.no)) continue;
    for (const r of t.rows) {
      if (!r[0]) continue;
      const fact = r
        .slice(1)
        .map((c, i) => (c ? (t.head[i + 1] ? `${t.head[i + 1]}: ${c}` : c) : ""))
        .filter(Boolean)
        .join("; ");
      if (fact) res.revision.push({ group: t.h1.title, topic: r[0], fact });
    }
  }
  res.revision.push(...revisionLater);

  if (!res.questions.length) errors.push("কোনো প্রশ্ন পাওয়া যায়নি — নথির কাঠামো মিলিয়ে দেখুন।");
  return res;
}
