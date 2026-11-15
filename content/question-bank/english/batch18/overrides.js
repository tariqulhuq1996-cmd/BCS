module.exports = {
  reject: [
    { match: "'put on'", reject: "Near Duplicate", dup: "Near Duplicate — ২৬-৫৭ (--- your shoes before entering the mosque = put off): put on/put off-এর একই প্রসঙ্গ" },
    { match: "'take off'", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ২৩-৯৩ (We waited until the plane took off): বিমানের take off অর্থ একই" },
  ],
  add: [["M", "The phrasal verb 'fill in' (a form) means—", ["complete by writing information", "tear up", "post", "sign only"], 0, "fill in a form = ফর্ম পূরণ করা।", "fill in = পূরণ করা।", { st: "EN.VO.GVB" }]],
};
