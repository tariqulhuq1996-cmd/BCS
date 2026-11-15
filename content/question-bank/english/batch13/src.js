// Batch 13 — EN.VO.ANT Antonym (B, ৪৪) ও EN.VO.SYN Synonym (B, ৪২)
const seed = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const pickFrom = (pool, ans, key) => { const c = pool.filter((p) => p !== ans); const o = []; let k = seed(key); while (o.length < 3) { const v = c[k % c.length]; if (!o.includes(v)) o.push(v); k += 13; } return o; };
const ANT = [
  ["abundant", "scarce", "প্রচুর ↔ দুষ্প্রাপ্য"], ["adversity", "prosperity", "দুর্দশা ↔ সমৃদ্ধি"], ["affirm", "deny", "নিশ্চিত করা ↔ অস্বীকার করা"],
  ["amateur", "professional", "শখের ↔ পেশাদার"], ["ancient", "modern", "প্রাচীন ↔ আধুনিক"], ["benign", "malignant", "নিরীহ/নিরাময়যোগ্য ↔ মারাত্মক"],
  ["compulsory", "optional", "বাধ্যতামূলক ↔ ঐচ্ছিক"], ["conceal", "reveal", "লুকানো ↔ প্রকাশ করা"], ["concise", "lengthy", "সংক্ষিপ্ত ↔ দীর্ঘ"],
  ["cordial", "hostile", "আন্তরিক ↔ বৈরী"], ["credible", "implausible", "বিশ্বাসযোগ্য ↔ অবিশ্বাস্য"], ["deficit", "surplus", "ঘাটতি ↔ উদ্বৃত্ত"],
  ["diminish", "augment", "কমা ↔ বাড়ানো"], ["exodus", "influx", "দলে দলে প্রস্থান ↔ আগমন"], ["expand", "contract", "প্রসারিত হওয়া ↔ সংকুচিত হওয়া"],
  ["extravagant", "thrifty", "অমিতব্যয়ী ↔ মিতব্যয়ী"], ["fragile", "sturdy", "ভঙ্গুর ↔ মজবুত"], ["genuine", "spurious", "খাঁটি ↔ নকল"],
  ["humility", "arrogance", "বিনয় ↔ ঔদ্ধত্য"], ["inferior", "superior", "নিকৃষ্ট ↔ উৎকৃষ্ট"], ["lenient", "strict", "নরম ↔ কঠোর"],
  ["melancholy", "cheerful", "বিষণ্ণ ↔ প্রফুল্ল"], ["mortal", "immortal", "নশ্বর ↔ অমর"], ["optimist", "pessimist", "আশাবাদী ↔ নৈরাশ্যবাদী"],
  ["orthodox", "heterodox", "গোঁড়া/প্রচলিত মতাবলম্বী ↔ ভিন্নমতাবলম্বী"], ["prohibit", "permit", "নিষেধ করা ↔ অনুমতি দেওয়া"], ["rigid", "flexible", "অনমনীয় ↔ নমনীয়"],
  ["shallow", "deep", "অগভীর ↔ গভীর"], ["transparent", "opaque", "স্বচ্ছ ↔ অস্বচ্ছ"], ["vague", "precise", "অস্পষ্ট ↔ সুনির্দিষ্ট"],
  ["zenith", "nadir", "শীর্ষবিন্দু ↔ সর্বনিম্ন বিন্দু"], ["artificial", "natural", "কৃত্রিম ↔ প্রাকৃতিক"], ["barren", "fertile", "বন্ধ্যা/অনুর্বর ↔ উর্বর"],
  ["dwarf", "giant", "বামন ↔ দৈত্য"], ["gradual", "sudden", "ধীর/ক্রমিক ↔ আকস্মিক"], ["hasty", "deliberate", "তাড়াহুড়ো ↔ ভেবেচিন্তে"],
  ["import", "export", "আমদানি ↔ রপ্তানি"], ["loyal", "treacherous", "বিশ্বস্ত ↔ বিশ্বাসঘাতক"], ["modest", "boastful", "বিনয়ী ↔ দাম্ভিক"],
  ["negligent", "careful", "অবহেলাকারী ↔ যত্নশীল"], ["rational", "irrational", "যুক্তিসংগত ↔ অযৌক্তিক"], ["sacred", "profane", "পবিত্র ↔ অপবিত্র"],
  ["timid", "bold", "ভীরু ↔ সাহসী"], ["urban", "rural", "শহুরে ↔ গ্রামীণ"],
];
const SYN = [
  ["abandon", "forsake", "পরিত্যাগ করা"], ["abhor", "detest", "ঘৃণা করা"], ["adroit", "skilful", "দক্ষ"], ["alleviate", "relieve", "লাঘব করা"],
  ["astute", "shrewd", "চতুর, বিচক্ষণ"], ["audacious", "daring", "দুঃসাহসী"], ["austere", "severe", "কঠোর, আড়ম্বরহীন"], ["brevity", "conciseness", "সংক্ষিপ্ততা"],
  ["cajole", "coax", "তোষামোদ করে রাজি করানো"], ["callous", "insensitive", "নির্মম, অনুভূতিহীন"], ["conspicuous", "noticeable", "সুস্পষ্ট, চোখে পড়ার মতো"], ["copious", "plentiful", "প্রচুর"],
  ["culpable", "blameworthy", "দোষী, নিন্দনীয়"], ["deter", "discourage", "নিরুৎসাহিত করা, বিরত রাখা"], ["docile", "obedient", "বাধ্য, শান্ত"], ["eradicate", "eliminate", "নির্মূল করা"],
  ["exorbitant", "excessive", "অত্যধিক (দাম)"], ["fallacy", "misconception", "ভ্রান্ত ধারণা"], ["feeble", "weak", "দুর্বল"], ["fervent", "passionate", "আবেগপূর্ণ"],
  ["futile", "useless", "নিষ্ফল"], ["gratify", "please", "সন্তুষ্ট করা"], ["hamper", "hinder", "বাধা দেওয়া"], ["impartial", "unbiased", "নিরপেক্ষ"],
  ["jeopardy", "danger", "বিপদ, ঝুঁকি"], ["laudable", "praiseworthy", "প্রশংসনীয়"], ["lucrative", "profitable", "লাভজনক"], ["malice", "spite", "বিদ্বেষ"],
  ["mitigate", "lessen", "প্রশমিত করা"], ["mundane", "ordinary", "জাগতিক, সাধারণ"], ["notorious", "infamous", "কুখ্যাত"], ["obstinate", "headstrong", "একগুঁয়ে"],
  ["placid", "calm", "শান্ত, স্থির"], ["prolific", "productive", "প্রচুর উৎপাদনশীল (লেখক ইত্যাদি)"], ["rectify", "correct", "সংশোধন করা"], ["replenish", "refill", "পুনরায় পূর্ণ করা"],
  ["scrutinize", "examine", "খুঁটিয়ে দেখা"], ["tranquil", "peaceful", "প্রশান্ত"], ["vigilant", "watchful", "সতর্ক"], ["wane", "decline", "ক্ষয় হওয়া, কমে আসা"],
  ["wrath", "anger", "ক্রোধ"], ["zest", "enthusiasm", "উদ্দীপনা"],
];
const antAns = ANT.map((x) => x[1]);
const synAns = SYN.map((x) => x[1]);
const AS = [(w) => `The antonym of '${w}' is—`, (w) => `Choose the word opposite in meaning to '${w}'.`, (w) => `Which word is most nearly opposite to '${w}'?`];
const SS = [(w) => `The synonym of '${w}' is—`, (w) => `Choose the word closest in meaning to '${w}'.`, (w) => `Which word means the same as '${w}'?`];
const lvl = (i) => (i % 5 === 0 ? "E" : i % 4 === 0 ? "H" : "M");
module.exports = {
  batch: "Batch 13",
  basis: "BCS_English_Final: Lecture 01, 07, 19 (Vocabulary — Synonyms & Antonyms)",
  subtopics: { "EN.VO.ANT": {}, "EN.VO.SYN": {} },
  st: "EN.VO.ANT",
  src: "Lecture 19 ও Standard English Dictionary (Oxford Learner's / Merriam-Webster Thesaurus)",
  items: [
    ...ANT.map(([w, a, bn], i) => [lvl(i), AS[i % 3](w), [a, ...pickFrom(antAns, a, w)], 0, `${w} ↔ ${a}: ${bn}।`, `${w} ↔ ${a}।`, { st: "EN.VO.ANT" }]),
    ...SYN.map(([w, a, bn], i) => [lvl(i), SS[i % 3](w), [a, ...pickFrom(synAns, a, w)], 0, `${w} = ${a} (${bn})।`, `${w} = ${a}।`, { st: "EN.VO.SYN" }]),
  ],
};
