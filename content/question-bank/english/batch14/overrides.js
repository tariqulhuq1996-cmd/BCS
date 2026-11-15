module.exports = {
  reject: [
    { match: "The rich ___ not always happy", reject: "Near Duplicate", dup: "Near Duplicate — ১১-৩১ (The rich are not always happy): প্রায় অভিন্ন বাক্য ও নিয়ম" },
    { match: "The murderer was ___ at dawn", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ১১-৩২ (He was hanged for murder), ৪৯-৯০ (hung/hanged): একই নিয়ম" },
    { match: "Each of the boys ___ a prize", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ১০-২২ (Each of the three boys got a prize): একই নিয়ম ও প্রায় একই বাক্য" },
    { match: "The sun ___ at six this morning", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ২৮-২৫ (The prices of rice are rising/raising): rise–raise পার্থক্যের একই নিয়ম" },
  ],
  add: [
    ["M", "Fill in the blank with the correct verb form: 'The cattle ___ grazing in the field.'", ["are", "is", "was", "has been"], 0, "cattle দেখতে singular হলেও সবসময় plural verb নেয়।", "cattle = plural।"],
    ["M", "Fill in the blank with the correct verb form: 'Politics ___ not a career for everyone.'", ["is", "are", "were", "have been"], 0, "বিষয়/ক্ষেত্র হিসেবে politics singular verb নেয়।", "politics (বিষয়) = singular।"],
    ["M", "Fill in the blank with the correct verb form: 'The ship ___ in the storm last night.'", ["sank", "sunk", "sinked", "sunken"], 0, "sink–sank–sunk; last night → past simple।", "sink–sank–sunk।"],
    ["M", "Fill in the blank with the correct verb form: 'He has ___ all the milk.'", ["drunk", "drank", "drinked", "drunken"], 0, "drink–drank–drunk; has-এর পরে past participle।", "drink–drank–drunk।"],
  ],
};
