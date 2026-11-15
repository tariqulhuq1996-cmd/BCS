const M7 = (d, q, a, o, e, t) => [d, q, [a, ...o], 0, e, t, { st: "EN.LI.17C" }];
module.exports = {
  reject: [
    { match: "'Volpone' was written by", reject: "Exact Duplicate", dup: "Exact Duplicate — ৩৭-১১৫ (Who has written the play 'Volpone'?)" },
    { match: "comedy of—'", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ১৫-৬৩ (চিকিৎসাতত্ত্বনির্ভর সাহিত্যধারা = Comedy of Humours)" },
  ],
  add: [
    M7("M", "'The White Devil' was written by—", "John Webster", ["Ben Jonson", "John Ford", "Thomas Middleton"], "Vittoria Corombona-কে নিয়ে Webster-এর Jacobean ট্র্যাজেডি (১৬১২)।", "White Devil — Webster।"),
    M7("H", "'Hudibras', a mock-heroic satire on the Puritans, was written by—", "Samuel Butler", ["John Dryden", "Andrew Marvell", "John Bunyan"], "Restoration যুগে Samuel Butler (১৬১৩–৮০)-এর ব্যঙ্গকাব্য।", "Hudibras — Samuel Butler।"),
    M7("M", "'Love for Love' is a Restoration comedy by—", "William Congreve", ["William Wycherley", "George Etherege", "Aphra Behn"], "Congreve-এর কমেডি (১৬৯৫)।", "Love for Love — Congreve।"),
    ["M", "'The Rambler' (1750–52) was a periodical written mainly by—", ["Samuel Johnson", "Joseph Addison", "Richard Steele", "Jonathan Swift"], 0, "Samuel Johnson প্রায় এককভাবে The Rambler-এর প্রবন্ধ লেখেন।", "Rambler — Johnson।", { st: "EN.LI.18C" }],
  ],
};
