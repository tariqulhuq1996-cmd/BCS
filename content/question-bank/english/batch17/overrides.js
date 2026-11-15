module.exports = {
  reject: [
    { match: "maintenance", reject: "Near Duplicate", dup: "Near Duplicate — ৪০-৪১-এর বিকল্পে ‘maintenance’ শুদ্ধ বানানে এসেছে; একই বানানজ্ঞান" },
    { match: "perseverance", reject: "Near Duplicate", dup: "Near Duplicate — ৪০-৪১-এর বিকল্পে ‘perseverance’ শুদ্ধ বানানে এসেছে; একই বানানজ্ঞান" },
  ],
  add: [
    ["M", "Which word is correctly spelt?", ["February", "Febuary", "Feburary", "Februery"], 0, "February — r দুটি (Feb-ru-ary)।", "February।", { st: "EN.GR.SPL" }],
    ["M", "Choose the correct spelling (the flash in the sky during a storm).", ["lightning", "lightening", "lightnning", "litening"], 0, "বজ্রের ঝলক = lightning; lightening = হালকা করা।", "lightning ≠ lightening।", { st: "EN.GR.SPL" }],
  ],
};
