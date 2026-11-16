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
  lang?: "en" | "bn"; // পাঠের মূল ভাষা (ডিফল্ট en)
  paper?: string; // যেমন "প্রথম ও দ্বিতীয় পত্র"
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
      photo?: Img; cover?: Img | null; // লেখকের ছবি ও বইয়ের প্রচ্ছদ (null = প্রতীকী প্রচ্ছদ)
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
  /** মুক্ত কাঠামোর অংশ (বাংলা পাঠ ইত্যাদি) — নির্দিষ্ট অংশগুলোর পরে নম্বরসহ দেখায়। */
  sections?: { title: string; sub?: string; blocks: Block[] }[];
};

/** ছবি: public/ ফোল্ডারের পথ ও স্বীকৃতি (উৎস/লাইসেন্স) */
export type Img = { src: string; credit?: string };

/** মুক্ত কাঠামোর ব্লক */
export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "passage"; text: string; lang?: "en" | "bn" } // হাইলাইট করা মূল লেখা (ফাঁকা লাইন = নতুন অনুচ্ছেদ)
  | { t: "ul" | "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "tip"; label: string; text: string }
  | { t: "info"; rows: [string, string][] } // কী: মান তালিকা
  | { t: "cards"; items: { title: string; rows: [string, string][] }[] } // শব্দ/প্রবাদ ধাঁচের কার্ড-গ্রিড
  | { t: "quote"; text: string; author: string; source?: string; lang?: "en" | "bn" }
  | { t: "fix"; wrong: string; right: string } // ভুল → শুদ্ধ
  | { t: "answer"; label?: string; items: string[] } // লুকানো উত্তর
  | { t: "dialogue"; lines: { who: string; text: string }[] }
  | { t: "media"; items: { kind: "photo" | "cover"; title: string; sub?: string; src?: string; credit?: string }[] } // লেখকের ছবি / বইয়ের প্রচ্ছদ
  | { t: "write"; id: string; label: string; rows?: number; placeholder?: string; count?: "lines" | "words" };

export function asLesson(v: unknown): Lesson | null {
  return v && typeof v === "object" && typeof (v as Lesson).topic === "string" ? (v as Lesson) : null;
}
