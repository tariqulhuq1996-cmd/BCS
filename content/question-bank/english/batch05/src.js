// Batch 05 — EN.VO.IDM Idioms ও Phrases (Priority A, লক্ষ্য ৫০)
const seed = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const pickFrom = (pool, ans, key) => { const c = pool.filter((p) => p !== ans); const o = []; let k = seed(key); while (o.length < 3) { const v = c[k % c.length]; if (!o.includes(v)) o.push(v); k += 11; } return o; };
const ID = [
  ["a bed of roses", "an easy and comfortable situation", "আরামদায়ক অবস্থা (Life is not a bed of roses)"],
  ["a fish out of water", "a person uncomfortable in unfamiliar surroundings", "অপরিচিত পরিবেশে অস্বস্তিতে থাকা ব্যক্তি"],
  ["a red-letter day", "a memorable and important day", "স্মরণীয় দিন"],
  ["a wild goose chase", "a useless search", "বৃথা অনুসন্ধান"],
  ["an apple of discord", "a cause of quarrel", "বিবাদের কারণ"],
  ["the apple of one's eye", "a person who is very dear", "নয়নের মণি"],
  ["at sixes and sevens", "in disorder and confusion", "বিশৃঙ্খল অবস্থায়"],
  ["at one's wit's end", "completely puzzled", "কিংকর্তব্যবিমূঢ়"],
  ["bad blood", "ill feeling between people", "শত্রুতা, বিদ্বেষ"],
  ["to beat about the bush", "to avoid coming to the main point", "আসল কথা এড়িয়ে যাওয়া"],
  ["to break the ice", "to start a conversation and remove shyness", "জড়তা ভাঙা"],
  ["to burn the midnight oil", "to work or study late into the night", "গভীর রাত পর্যন্ত পরিশ্রম করা"],
  ["by leaps and bounds", "very rapidly", "দ্রুতগতিতে"],
  ["a cat's paw", "a person used as a tool by another", "অন্যের হাতের ক্রীড়নক"],
  ["crocodile tears", "false show of sorrow", "মায়াকান্না"],
  ["to face the music", "to accept the unpleasant consequences", "নিজের কাজের ফল ভোগ করা"],
  ["a feather in one's cap", "an achievement to be proud of", "গৌরবজনক কৃতিত্ব"],
  ["to hit the nail on the head", "to say exactly the right thing", "ঠিক জায়গায় আঘাত করা/ঠিক কথা বলা"],
  ["in a nutshell", "in a few words; briefly", "সংক্ষেপে"],
  ["in hot water", "in trouble", "বিপদে"],
  ["to keep the wolf from the door", "to have just enough to avoid hunger", "কোনোরকমে অনাহার ঠেকানো"],
  ["to leave no stone unturned", "to try every possible means", "সাধ্যমতো সব চেষ্টা করা"],
  ["the lion's share", "the largest part", "সিংহভাগ"],
  ["a man of letters", "a scholar or literary person", "পণ্ডিত/সাহিত্যিক ব্যক্তি"],
  ["on the horns of a dilemma", "facing two equally unpleasant choices", "উভয়সংকটে"],
  ["once and for all", "finally and for the last time", "চিরদিনের জন্য, চূড়ান্তভাবে"],
  ["pros and cons", "advantages and disadvantages", "পক্ষে-বিপক্ষে যুক্তি"],
  ["red tape", "excessive official formality causing delay", "লাল ফিতার দৌরাত্ম্য, দাপ্তরিক দীর্ঘসূত্রতা"],
  ["rank and file", "the ordinary members of a group", "সাধারণ সদস্যবৃন্দ"],
  ["to see eye to eye", "to agree fully", "সম্পূর্ণ একমত হওয়া"],
  ["a storm in a teacup", "great fuss over a small matter", "তুচ্ছ বিষয়ে হইচই"],
  ["at the eleventh hour", "at the last moment", "শেষ মুহূর্তে"],
  ["to bell the cat", "to undertake a risky task", "ঝুঁকিপূর্ণ দায়িত্ব নেওয়া"],
  ["to blow one's own trumpet", "to boast about oneself", "নিজের ঢাক নিজে পেটানো"],
  ["to bury the hatchet", "to make peace", "বিবাদ মিটিয়ে ফেলা"],
  ["to call a spade a spade", "to speak plainly and frankly", "স্পষ্ট কথা বলা"],
  ["to cut a sorry figure", "to make a poor impression", "হাস্যকর/শোচনীয় অবস্থায় পড়া"],
  ["to hang by a thread", "to be in a very uncertain situation", "সুতোয় ঝোলা, অনিশ্চিত অবস্থায় থাকা"],
  ["to make both ends meet", "to live within one's income", "আয়-ব্যয় মেলানো"],
  ["to play second fiddle", "to take a less important role", "অধস্তন ভূমিকা পালন করা"],
  ["to pay through the nose", "to pay too much", "অতিরিক্ত দাম দেওয়া"],
  ["to pull someone's leg", "to tease someone playfully", "কাউকে নিয়ে মজা করা"],
  ["to take to one's heels", "to run away", "চম্পট দেওয়া"],
  ["under a cloud", "under suspicion", "সন্দেহের মধ্যে"],
  ["up to the mark", "of the expected standard", "প্রত্যাশিত মানসম্পন্ন"],
  ["a Herculean task", "an extremely difficult task", "অত্যন্ত কঠিন কাজ"],
  ["a dark horse", "a little-known competitor who unexpectedly wins", "অপ্রত্যাশিত বিজয়ী"],
];
const MEAN = ID.map((x) => x[1]);
const STEM = [(i) => `The idiom '${i}' means—`, (i) => `What is the meaning of '${i}'?`, (i) => `'${i}' means—`];
const idItems = ID.map(([i, m, bn], n) => [n % 5 === 0 ? "E" : n % 4 === 0 ? "H" : "M", STEM[n % 3](i), [m, ...pickFrom(MEAN, m, i)], 0, `${i} = ${bn}।`, `${i} → ${bn}।`]);
const FILL = [
  ["It is no use crying over ___ milk.", "spilt", ["spoiled", "sour", "spilled over"], "cry over spilt milk = অপূরণীয় ক্ষতির জন্য অনুশোচনা করা।"],
  ["The thief was caught red-___ by the guards.", "handed", ["faced", "headed", "eyed"], "caught red-handed = হাতেনাতে ধরা পড়া।"],
  ["The two brothers are as different as chalk and ___.", "cheese", ["butter", "milk", "bread"], "as different as chalk and cheese = সম্পূর্ণ ভিন্ন।"],
];
const fillItems = FILL.map(([s, a, o, e]) => ["M", `Complete the idiom: '${s}'`, [a, ...o], 0, e, e.split("=")[0].trim()]);
module.exports = {
  batch: "Batch 05",
  basis: "BCS_English_Final: Lecture 01 (Idioms & Phrases, Part-1) ও Vocabulary অংশ",
  subtopics: { "EN.VO.IDM": {} },
  st: "EN.VO.IDM",
  src: "Lecture 01, 07, 18 ও Standard Reference (Oxford Dictionary of Idioms)",
  items: [...idItems, ...fillItems],
};
