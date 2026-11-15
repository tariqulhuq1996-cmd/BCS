// Batch 18 — EN.VO.OWS One-word Substitution (C, ৩১) + EN.VO.GVB Group Verb ও Phrasal Verb (C, ২৯)
const seed = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const pickFrom = (pool, ans, key) => { const c = pool.filter((p) => p !== ans); const o = []; let k = seed(key); for (let i = 0; o.length < 3 && i < c.length * 8; i++) { const v = c[k % c.length]; if (!o.includes(v)) o.push(v); k += 11; } return o; };
const OWS = [
  ["One who knows many languages", "polyglot", "বহুভাষাবিদ"], ["One who cannot be corrected", "incorrigible", "সংশোধনের অযোগ্য"],
  ["Fear of heights", "acrophobia", "উচ্চতাভীতি"], ["Fear of water", "hydrophobia", "জলাতঙ্ক"], ["Fear of enclosed spaces", "claustrophobia", "আবদ্ধ স্থানভীতি"],
  ["Killing of a king", "regicide", "রাজহত্যা"], ["Killing of one's mother", "matricide", "মাতৃহত্যা"], ["Killing of a whole race or community", "genocide", "গণহত্যা/জাতিহত্যা"],
  ["The scientific study of birds", "ornithology", "পক্ষীবিজ্ঞান"], ["The scientific study of insects", "entomology", "কীটতত্ত্ব"], ["The scientific study of earthquakes", "seismology", "ভূকম্পনবিদ্যা"],
  ["The art of beautiful handwriting", "calligraphy", "হস্তলিপিশিল্প"], ["A collector of postage stamps", "philatelist", "ডাকটিকিট সংগ্রাহক"], ["A collector of coins", "numismatist", "মুদ্রা সংগ্রাহক"],
  ["Government by a small group of people", "oligarchy", "স্বল্পজনতন্ত্র"], ["Government by one person with absolute power", "autocracy", "স্বৈরতন্ত্র"],
  ["One who hates women", "misogynist", "নারীবিদ্বেষী"], ["One who does not believe in God", "atheist", "নাস্তিক"], ["One who believes that everything is decided by fate", "fatalist", "অদৃষ্টবাদী"],
  ["One who walks in sleep", "somnambulist", "নিদ্রাচারী"], ["Inability to sleep", "insomnia", "অনিদ্রা"], ["Loss of memory", "amnesia", "স্মৃতিভ্রংশ"],
  ["A specialist in diseases of the eye", "ophthalmologist", "চক্ষুবিশেষজ্ঞ"], ["Animals that can live both on land and in water", "amphibians", "উভচর প্রাণী"],
  ["A place where bees are kept", "apiary", "মৌমাছি পালনের স্থান"], ["A place where birds are kept", "aviary", "পাখিশালা"], ["A store of weapons and ammunition", "arsenal", "অস্ত্রাগার"],
  ["One who lends money at very high interest", "usurer", "চড়া সুদে ঋণদাতা"], ["A place where coins are made", "mint", "টাকশাল"], ["A disease that cannot be cured", "incurable", "দুরারোগ্য"],
  ["One who knows everything", "omniscient", "সর্বজ্ঞ"],
];
const GV = [
  ["look after", "take care of", "দেখাশোনা করা"], ["bring up", "rear (a child)", "লালনপালন করা"], ["call off", "cancel", "বাতিল করা"],
  ["carry out", "execute", "বাস্তবায়ন করা"], ["break down", "stop working", "বিকল হওয়া/ভেঙে পড়া"], ["come across", "meet or find by chance", "হঠাৎ সাক্ষাৎ পাওয়া"],
  ["make up for", "compensate for", "ক্ষতিপূরণ করা"], ["run out of", "have no more left", "ফুরিয়ে যাওয়া"], ["set out", "start a journey", "যাত্রা শুরু করা"],
  ["take after", "resemble (a parent)", "(বাবা-মায়ের) মতো হওয়া"], ["turn down", "reject", "প্রত্যাখ্যান করা"], ["put out", "extinguish", "(আগুন) নেভানো"],
  ["look up to", "respect", "শ্রদ্ধা করা"], ["look down upon", "despise", "অবজ্ঞা করা"], ["get over", "recover from", "সেরে ওঠা/কাটিয়ে ওঠা"],
  ["call on", "visit", "দেখা করতে যাওয়া"], ["bear out", "confirm", "সমর্থন/প্রমাণ করা"], ["keep up with", "keep pace with", "তাল মিলিয়ে চলা"],
  ["put on", "wear", "পরিধান করা"], ["make out", "understand", "বুঝতে পারা"], ["hold on", "wait", "অপেক্ষা করা"],
  ["give away", "distribute free", "বিলিয়ে দেওয়া"], ["break out", "start suddenly", "(যুদ্ধ/আগুন/রোগ) হঠাৎ শুরু হওয়া"], ["turn up", "arrive", "উপস্থিত হওয়া"],
  ["bring about", "cause to happen", "ঘটানো"], ["see off", "say goodbye to someone leaving", "বিদায় জানাতে যাওয়া"], ["fall out", "quarrel", "ঝগড়া করে সম্পর্ক ছিন্ন করা"],
  ["take off", "leave the ground (of an aircraft)", "(বিমান) উড্ডয়ন করা"], ["back up", "support", "সমর্থন করা"], ["wind up", "bring to an end", "গুটিয়ে আনা/শেষ করা"],
];
const owAns = OWS.map((x) => x[1]);
const gvAns = GV.map((x) => x[1]);
const OS = [(p) => `'${p}' — one word for this is—`, (p) => `Choose the one-word substitute: '${p}'`, (p) => `Which single word means '${p.toLowerCase()}'?`];
const GS = [(g) => `The phrasal verb '${g}' means—`, (g) => `What does '${g}' mean?`, (g) => `'${g}' means—`];
module.exports = {
  batch: "Batch 18",
  basis: "BCS_English_Final: Lecture 01 (One Word Substitution), Lecture 18–19 (Vocabulary; Group Verbs)",
  subtopics: { "EN.VO.OWS": {}, "EN.VO.GVB": {} },
  st: "EN.VO.OWS",
  src: "Lecture 01, 18–19 ও Standard English Dictionary (Oxford Learner's; Cambridge Phrasal Verbs)",
  items: [
    ...OWS.map(([p, a, bn], i) => [i % 4 ? "M" : "H", OS[i % 3](p), [a, ...pickFrom(owAns, a, p)], 0, `${p} = ${a} (${bn})।`, `${a} = ${bn}।`, { st: "EN.VO.OWS" }]),
    ...GV.map(([g, m, bn], i) => [i % 5 ? "M" : "E", GS[i % 3](g), [m, ...pickFrom(gvAns, m, g)], 0, `${g} = ${m} (${bn})।`, `${g} = ${bn}।`, { st: "EN.VO.GVB" }]),
  ],
};
