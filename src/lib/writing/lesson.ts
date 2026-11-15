/**
 * সাজানো পাঠ (Daily English Writing Practice ধাঁচ) — content/written-cards/lessons/<কার্ড আইডি>.json।
 * প্রতিটি অংশ ঐচ্ছিক; যে অংশ নেই তা পাতায় দেখায় না।
 */
export type Lesson = {
  series?: string; // যেমন "Daily English Writing Practice"
  day?: string; // "Day 02"
  exam?: string; // "52nd BCS Written"
  lessonNo?: string; // "Lesson 02"
  theme?: string; // "Climate & Environment"
  topic: string; // আজকের বিষয়
  intro?: string[];
  paragraph?: { title: string; words?: number; pattern?: string; text: string; note?: string; sources?: string[]; tip?: string };
  structure?: { step: string; what: string }[];
  vocabulary?: { word: string; bn: string; pos: string; synonym?: string; antonym?: string; example: string; exampleBn: string }[];
  vocabularyRemember?: string[]; // "মনে রাখবে" তালিকা
  prepositional?: { phrase: string; bn: string; example: string; exampleBn: string }[];
  idioms?: { items: { phrase: string; bn: string; example: string }[]; tip?: string };
  writers?: {
    intro?: string;
    items: {
      name: string; nationality: string; identity: string; book: string; published: string; genre: string;
      summary: string; characters: { name: string; desc: string }[]; message: string[]; sources?: string[]; bcsUse: string[];
    }[];
    takeaway?: string[];
  };
  quote?: { text: string; author: string; work?: string; bn: string; explanation: string; useIn: string[] };
  sentences?: { en: string; bn: string; notes?: string[] }[];
  wordChoice?: { items: { title: string; rows: { word: string; meaning: string }[]; examples: string[]; note?: string }[]; tip?: string };
  grammar?: { title: string; structure: string; usage?: string; example: string; explanation: string; wrong?: string; right?: string; note?: string; more?: string[] }[];
  collocations?: { expr: string; bn: string }[];
  connectors?: { word: string; bn: string; use: string }[];
  connectorsExample?: string;
  transformation?: { label: string; text: string }[];
  transformationNote?: string;
  translation?: { bnToEn: { q: string; a: string }[]; enToBn: { q: string; a: string }[]; note?: string };
  assignment?: { intro: string; expressions: string[]; criteria: string[]; note?: string };
  finalGoal?: { title?: string; text: string[]; remember?: string; principle?: string };
};

export function asLesson(v: unknown): Lesson | null {
  return v && typeof v === "object" && typeof (v as Lesson).topic === "string" ? (v as Lesson) : null;
}
