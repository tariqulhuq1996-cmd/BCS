// Batch 05 — Priority A: MN.BC.BAN বানান ও ভাষাগত দক্ষতা (76)
// বাংলা বানান (বাংলা একাডেমি প্রমিত বানান), ইংরেজি বানান (Oxford/Merriam-Webster), সমার্থক-বিপরীতার্থক, এক কথায় প্রকাশ।
// বিতর্কিত/দুই রকম চলিত বানান বাদ। বিগত বিসিএস বাদ: প্রতিযোগিতা, শ্বশুর, কুসংস্কার, অধোগতি, মিথস্ক্রিয়া-গুচ্ছ,
// Achievement, Indwelling, Encyclopedia, Conscientious, Rendezvous, Gazette।
const { T } = require("../lib");
const B = T("MN.BC.BAN");
const items = [];
const add = (...a) => items.push(...a);
const SBN = { src: "লেকচার ০৩ (Spelling & Language) ও বাংলা একাডেমি আধুনিক বাংলা অভিধান / প্রমিত বাংলা বানানের নিয়ম" };
const SEN = { src: "লেকচার ০৩ (Spelling & Language) ও Oxford Advanced Learner's Dictionary / Merriam-Webster" };

// ── ক. শুদ্ধ বাংলা বানান — 22
const BN = [
  ["মুহূর্ত", ["মুহুর্ত", "মূহুর্ত", "মুহূর্থ"], "মু-তে হ্রস্ব উ, হূ-তে দীর্ঘ ঊ।"],
  ["পুরস্কার", ["পুরষ্কার", "পূরস্কার", "পুরুস্কার"], "পুরঃ + কার — বিসর্গের পরে ক থাকায় 'স্ক' (মূর্ধন্য ষ নয়)।"],
  ["বুদ্ধিজীবী", ["বুদ্ধিজীবি", "বুদ্ধিজিবী", "বুদ্ধীজীবী"], "জী ও বী — দুটিতেই দীর্ঘ ঈ; বুদ্ধি-তে হ্রস্ব ই।"],
  ["উজ্জ্বল", ["উজ্জল", "উজ্বল", "উজ্জ্বোল"], "উৎ + জ্বল ⇒ উজ্জ্বল — জ্জ-এর সঙ্গে ব-ফলা।"],
  ["কৌতূহল", ["কৌতুহল", "কোতূহল", "কৌতূহোল"], "কৌ-তে ঔ-কার, তূ-তে দীর্ঘ ঊ।"],
  ["দুরবস্থা", ["দূরাবস্থা", "দুরাবস্থা", "দূরবস্থা"], "দুঃ + অবস্থা ⇒ দুরবস্থা (হ্রস্ব উ, আ-কার নেই)।"],
  ["সমীচীন", ["সমিচীন", "সমীচিন", "সমিচিন"], "মী ও চী — দুটিতেই দীর্ঘ ঈ।"],
  ["মনীষী", ["মনিষী", "মনীষি", "মনিষি"], "নী ও ষী — দুটিতেই দীর্ঘ ঈ, মূর্ধন্য ষ।"],
  ["অত্যধিক", ["অত্যাধিক", "অত্যধীক", "অতধিক"], "অতি + অধিক ⇒ অত্যধিক (য-ফলা, আ-কার নেই)।"],
  ["ভৌগোলিক", ["ভৌগলিক", "ভোগোলিক", "ভৌগোলীক"], "ভূগোল + ইক ⇒ ভৌগোলিক — 'গো' থাকে।"],
  ["মরীচিকা", ["মরিচিকা", "মরীচীকা", "মরিচীকা"], "রী-তে দীর্ঘ ঈ, চি-তে হ্রস্ব ই।"],
  ["নূপুর", ["নুপুর", "নূপূর", "নুপূর"], "নূ-তে দীর্ঘ ঊ, পু-তে হ্রস্ব উ।"],
  ["দারিদ্র্য", ["দারিদ্রতা", "দারিদ্য", "দারীদ্র্য"], "দরিদ্র + য (ষ্ণ্য) ⇒ দারিদ্র্য; 'দারিদ্রতা' দ্বিগুণ প্রত্যয়ের ভুল।"],
  ["বৈচিত্র্য", ["বৈচিত্র", "বৈচিত্রতা", "বৈচীত্র্য"], "বিচিত্র + য ⇒ বৈচিত্র্য (শেষে য-ফলা)।"],
  ["শুশ্রূষা", ["শুশ্রুষা", "সুশ্রূষা", "শুস্রূষা"], "শু-তে হ্রস্ব উ, শ্রূ-তে দীর্ঘ ঊ, শেষে মূর্ধন্য ষ।"],
  ["স্বায়ত্তশাসন", ["স্বায়ত্বশাসন", "সায়ত্তশাসন", "স্বায়ত্তসাশন"], "স্ব + আয়ত্ত ⇒ স্বায়ত্ত (ত্ত, ত্ব নয়)।"],
  ["মুমূর্ষু", ["মুমুর্ষু", "মূমূর্ষু", "মুমূর্ষূ"], "মু-তে হ্রস্ব উ, মূ-তে দীর্ঘ ঊ, ষু-তে হ্রস্ব উ।"],
  ["সান্ত্বনা", ["সান্তনা", "শান্ত্বনা", "সান্ত্বোনা"], "ন্ত-এর সঙ্গে ব-ফলা (ন্ত্ব), দন্ত্য স।"],
  ["উচ্ছ্বাস", ["উচ্ছাস", "উচ্ছ্বাশ", "উছ্বাস"], "উৎ + শ্বাস ⇒ উচ্ছ্বাস — ব-ফলা থাকে।"],
  ["অপরাহ্ণ", ["অপরাহ্ন", "অপরান্হ", "অপড়াহ্ণ"], "অপর + অহ্ন ⇒ অপরাহ্ণ — র-এর প্রভাবে মূর্ধন্য ণ।"],
  ["ঊর্ধ্ব", ["উর্ধ্ব", "ঊর্দ্ধ", "উর্দ্ধ"], "দীর্ঘ ঊ, র-ফলার পরে ধ্ব (দ্ধ নয়)।"],
  ["মন্ত্রিসভা", ["মন্ত্রীসভা", "মন্ত্রিসবা", "মন্ত্রীসবা"], "সমাসবদ্ধ পদে 'মন্ত্রী' → 'মন্ত্রি' (হ্রস্ব ই)।"],
];
BN.forEach(([a, w, e], i) => add(B(i % 4 === 3 ? "H" : "M", i % 2 ? "কোন বানানটি শুদ্ধ?" : "শুদ্ধ বানান কোনটি?", a, w, `শুদ্ধ: ${a}। ${e}`, "উৎস-শব্দ ও সন্ধি/প্রত্যয় মনে রাখলে বানান সহজ হয়।", SBN)));

// ── খ. শুদ্ধ ইংরেজি বানান — 22
const EN = [
  ["Accommodate", ["Accomodate", "Acommodate", "Accommadate"], "double c, double m।"],
  ["Embarrass", ["Embarass", "Embarras", "Emberrass"], "double r, double s।"],
  ["Millennium", ["Millenium", "Milennium", "Millenniam"], "double l, double n।"],
  ["Necessary", ["Neccessary", "Necessery", "Necesary"], "one c, double s।"],
  ["Separate", ["Seperate", "Separete", "Seprate"], "sep-A-rate — মাঝে a।"],
  ["Occurrence", ["Occurence", "Ocurrence", "Occurrance"], "double c, double r, শেষে -ence।"],
  ["Questionnaire", ["Questionaire", "Questionnair", "Quessionnaire"], "double n, শেষে -aire।"],
  ["Committee", ["Commitee", "Comittee", "Committe"], "double m, double t, double e।"],
  ["Privilege", ["Priviledge", "Privilage", "Previlege"], "pri-vi-lege — শব্দে d নেই।"],
  ["Maintenance", ["Maintainance", "Maintenence", "Mantenance"], "maintain থেকে হলেও বানান main-ten-ance।"],
  ["Bureaucracy", ["Beaurocracy", "Bureaucrasy", "Burocracy"], "bureau + cracy।"],
  ["Entrepreneur", ["Entrepeneur", "Enterpreneur", "Entreprenuer"], "entre-pre-neur।"],
  ["Rhythm", ["Rythm", "Rhythem", "Rhytm"], "rh + y + thm।"],
  ["Definitely", ["Definately", "Definitly", "Defenitely"], "definite + ly।"],
  ["Receive", ["Recieve", "Receeve", "Riceive"], "c-এর পরে ei (i before e except after c)।"],
  ["Colleague", ["Collegue", "Colleage", "Coleague"], "double l, শেষে -league।"],
  ["Guarantee", ["Guarentee", "Garantee", "Guarrantee"], "gua-ran-tee — একটি r।"],
  ["Harass", ["Harrass", "Haras", "Harasse"], "one r, double s।"],
  ["Lieutenant", ["Leutenant", "Lieutenent", "Lieutanant"], "lieu + tenant।"],
  ["Pronunciation", ["Pronounciation", "Pronunciasion", "Prononciation"], "pronounce থেকে হলেও pro-NUN-ciation (o বাদ)।"],
  ["Surveillance", ["Surveilance", "Survelliance", "Surveillence"], "double l, শেষে -ance।"],
  ["Acquaintance", ["Aquaintance", "Acquaintence", "Acquintance"], "ac + quaint + ance।"],
];
EN.forEach(([a, w, e], i) => add(B(i % 3 === 2 ? "H" : "M", i % 2 ? "Which spelling is correct?" : "Choose the correctly spelt word.", a, w, `সঠিক বানান: ${a} — ${e}`, "দ্বিত্ব বর্ণ (double letter) ও শব্দের উৎস খেয়াল করো।", SEN)));

// ── গ. বাংলা সমার্থক ও বিপরীতার্থক — 10
const BSA = (d, q, a, o, e) => add(B(d, q, a, o, e, "সমার্থক ও বিপরীত শব্দের তালিকা নিয়মিত পড়লে দ্রুত উত্তর দেওয়া যায়।", SBN));
BSA("M", "'সূর্য'-এর সমার্থক শব্দ কোনটি?", "দিবাকর", ["শশধর", "সুধাকর", "নিশাকর"], "দিবাকর = যে দিন সৃষ্টি করে — সূর্য; শশধর, সুধাকর ও নিশাকর চাঁদের প্রতিশব্দ।");
BSA("M", "'পানি'-এর সমার্থক শব্দ কোনটি?", "সলিল", ["অনল", "অনিল", "ভূধর"], "সলিল = পানি; অনল = আগুন, অনিল = বাতাস, ভূধর = পাহাড়।");
BSA("M", "'পর্বত'-এর সমার্থক শব্দ কোনটি?", "ভূধর", ["জলধি", "অম্বর", "অর্ণব"], "ভূধর = পর্বত; জলধি ও অর্ণব = সমুদ্র, অম্বর = আকাশ।");
BSA("M", "'চাঁদ'-এর সমার্থক শব্দ কোনটি?", "শশাঙ্ক", ["ভাস্কর", "তপন", "প্রভাকর"], "শশাঙ্ক = চাঁদ; ভাস্কর, তপন ও প্রভাকর সূর্যের প্রতিশব্দ।");
BSA("M", "'বাতাস'-এর সমার্থক শব্দ কোনটি?", "সমীরণ", ["জলধর", "অনল", "বারি"], "সমীরণ = বাতাস; জলধর = মেঘ, অনল = আগুন, বারি = পানি।");
BSA("E", "'উদয়'-এর বিপরীত শব্দ কোনটি?", "অস্ত", ["উত্থান", "আরম্ভ", "প্রকাশ"], "উদয় ↔ অস্ত।");
BSA("M", "'আবির্ভাব'-এর বিপরীত শব্দ কোনটি?", "তিরোভাব", ["উদ্ভব", "আগমন", "প্রকাশ"], "আবির্ভাব (প্রকাশিত হওয়া) ↔ তিরোভাব (অদৃশ্য হওয়া)।");
BSA("E", "'সুলভ'-এর বিপরীত শব্দ কোনটি?", "দুর্লভ", ["সহজ", "সস্তা", "প্রাপ্য"], "সুলভ (সহজে পাওয়া যায়) ↔ দুর্লভ।");
BSA("M", "'আসক্ত'-এর বিপরীত শব্দ কোনটি?", "নিরাসক্ত", ["অনুরক্ত", "আগ্রহী", "লিপ্ত"], "আসক্ত ↔ নিরাসক্ত (আসক্তিহীন)।");
BSA("M", "'কৃতজ্ঞ'-এর বিপরীত শব্দ কোনটি?", "কৃতঘ্ন", ["বিনয়ী", "অকৃতকার্য", "কৃতী"], "কৃতজ্ঞ (উপকার স্বীকার করে) ↔ কৃতঘ্ন (উপকারীর ক্ষতি করে)।");

// ── ঘ. ইংরেজি Synonym ও Antonym — 12
const ESA = (d, q, a, o, e) => add(B(d, q, a, o, e, "শব্দের মূল অর্থ ধরে বিকল্পগুলো যাচাই করো।", SEN));
ESA("M", "Synonym of 'Abundant' is—", "Plentiful", ["Scarce", "Rare", "Meagre"], "Abundant = প্রচুর = Plentiful; বাকি তিনটি উল্টো অর্থের।");
ESA("M", "Synonym of 'Candid' is—", "Frank", ["Secretive", "Clever", "Rude"], "Candid = অকপট, স্পষ্টবাদী = Frank।");
ESA("E", "Synonym of 'Diligent' is—", "Hardworking", ["Lazy", "Intelligent", "Careless"], "Diligent = পরিশ্রমী।");
ESA("M", "Synonym of 'Obsolete' is—", "Outdated", ["Modern", "Rare", "Useful"], "Obsolete = অপ্রচলিত = Outdated।");
ESA("M", "Synonym of 'Benevolent' is—", "Kind", ["Cruel", "Wealthy", "Clever"], "Benevolent = দয়ালু, পরোপকারী।");
ESA("M", "Synonym of 'Ponder' is—", "Consider", ["Ignore", "Forget", "Hurry"], "Ponder = গভীরভাবে ভাবা = Consider।");
ESA("E", "Antonym of 'Ancient' is—", "Modern", ["Old", "Antique", "Historic"], "Ancient (প্রাচীন) ↔ Modern (আধুনিক)।");
ESA("M", "Antonym of 'Expand' is—", "Contract", ["Enlarge", "Spread", "Extend"], "Expand (প্রসারিত হওয়া) ↔ Contract (সংকুচিত হওয়া)।");
ESA("M", "Antonym of 'Optimist' is—", "Pessimist", ["Idealist", "Realist", "Dreamer"], "Optimist (আশাবাদী) ↔ Pessimist (নৈরাশ্যবাদী)।");
ESA("M", "Antonym of 'Transparent' is—", "Opaque", ["Clear", "Glassy", "Visible"], "Transparent (স্বচ্ছ) ↔ Opaque (অস্বচ্ছ)।");
ESA("E", "Antonym of 'Victory' is—", "Defeat", ["Triumph", "Success", "Win"], "Victory ↔ Defeat।");
ESA("M", "Antonym of 'Humble' is—", "Arrogant", ["Modest", "Polite", "Meek"], "Humble (বিনয়ী) ↔ Arrogant (উদ্ধত)।");

// ── ঙ. এক কথায় প্রকাশ (বাংলা ও ইংরেজি) — 10
BSA("M", "'যা পূর্বে ছিল, এখন নেই' — এক কথায় কী বলে?", "ভূতপূর্ব", ["অভূতপূর্ব", "অপূর্ব", "পূর্ববর্তী"], "ভূতপূর্ব = আগে ছিল, এখন নেই; অভূতপূর্ব = যা আগে কখনো হয়নি।");
BSA("M", "'যিনি বহু বিষয়ে জানেন' — এক কথায় কী বলে?", "বহুজ্ঞ", ["সর্বজ্ঞ", "অভিজ্ঞ", "বিজ্ঞানী"], "বহুজ্ঞ = বহু বিষয়ে জ্ঞানসম্পন্ন; সর্বজ্ঞ = সব জানেন যিনি।");
BSA("M", "'যার কোনো উপায় নেই' — এক কথায় কী বলে?", "নিরুপায়", ["অসহায়", "নিঃসঙ্গ", "নিরুদ্দেশ"], "নিরুপায় = উপায়হীন।");
BSA("M", "'যা বলা হয়নি' — এক কথায় কী বলে?", "অনুক্ত", ["অব্যক্ত", "অনুচিত", "উক্ত"], "অনুক্ত = যা বলা হয়নি; উক্ত = যা বলা হয়েছে।");
BSA("H", "'যা সহজে পাওয়া যায় না' — এক কথায় কী বলে?", "দুর্লভ", ["সুলভ", "দুর্গম", "দুর্বোধ্য"], "দুর্লভ = দুঃখে লভ্য, সহজে পাওয়া যায় না; দুর্গম = যেখানে যাওয়া কঠিন।");
ESA("M", "One who cannot read or write is called—", "Illiterate", ["Ignorant", "Innocent", "Illegible"], "Illiterate = নিরক্ষর; Illegible = (লেখা) পড়া যায় না এমন।");
ESA("M", "A person who works for the welfare of mankind is called a—", "Philanthropist", ["Misanthrope", "Philatelist", "Pessimist"], "Philanthropist = মানবহিতৈষী; Misanthrope = মানববিদ্বেষী; Philatelist = ডাকটিকিট সংগ্রাহক।");
ESA("H", "A speech delivered without preparation is called—", "Extempore", ["Eulogy", "Monologue", "Epilogue"], "Extempore = প্রস্তুতি ছাড়া তাৎক্ষণিক বক্তৃতা।");
ESA("E", "That which cannot be seen is—", "Invisible", ["Invincible", "Indivisible", "Inevitable"], "Invisible = অদৃশ্য; Invincible = অজেয়।");
ESA("H", "One who knows everything is called—", "Omniscient", ["Omnipotent", "Omnipresent", "Omnivorous"], "Omniscient = সর্বজ্ঞ; Omnipotent = সর্বশক্তিমান; Omnipresent = সর্বব্যাপী।");

module.exports = {
  batch: "Batch 05",
  basis: "MN.BC.BAN বানান ও ভাষাগত দক্ষতা — বাংলা ও ইংরেজি শুদ্ধ বানান, সমার্থক-বিপরীতার্থক, এক কথায় প্রকাশ",
  subtopics: { "MN.BC.BAN": {} },
  st: "MN.BC.BAN",
  items,
};
