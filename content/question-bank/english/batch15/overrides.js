module.exports = {
  reject: [
    { match: "One must do one's duty.", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ২৩-৯১ (One should be careful about one's duty): একই নিয়ম" },
    { match: "He is strong enough to lift the box.", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ১৮-১৭ (old enough / enough old): একই নিয়ম" },
    { match: "I prefer tea to coffee.", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ২৮-৩০ (prefer donating money to distributing clothes): prefer … to নিয়ম" },
    { match: "Let him go.", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ১২-২৩ (Let you and him be witnesses): let-এর পরে objective case" },
    { match: "'He has (A) returned (B) the book (C) yesterday (D).'", reject: "Semantic Duplicate", dup: "Semantic Duplicate — ৩৬-৬৩ (Yesterday, he went home): yesterday-র সঙ্গে past simple" },
  ],
  add: [
    ["M", "Choose the correct sentence.", ["He is a man of few words.", "He is a man of little words.", "He is a man of less words.", "He is a man of a little words."], 0, "গণনাযোগ্য noun (words)-এর সঙ্গে few; little অগণনীয় noun-এর সঙ্গে।", "few + countable।"],
    ["M", "Choose the correct sentence.", ["He is my cousin.", "He is my cousin brother.", "He is my cousin-brother of mine.", "He is cousin brother to me."], 0, "ইংরেজিতে cousin-ই যথেষ্ট; cousin brother/sister বাংলার আক্ষরিক অনুবাদজনিত ভুল।", "cousin brother ভুল।"],
    ["M", "Which of the following sentences is correct?", ["Rahim is older than his sister.", "Rahim is elder than his sister.", "Rahim is more elder than his sister.", "Rahim is elder to his sister."], 0, "elder শুধু attributive (my elder brother); than-এর সঙ্গে older।", "than-এর সঙ্গে older।"],
    ["M", "Identify the grammatically correct sentence.", ["There are fewer students in the class today.", "There are less students in the class today.", "There is fewer students in the class today.", "There are lesser students in the class today."], 0, "গণনাযোগ্য (students) noun-এ fewer; অগণনীয় noun-এ less।", "countable = fewer।"],
    ["M", "Choose the correct sentence.", ["He is both a singer and a dancer.", "He is both a singer as well as a dancer.", "He is both a singer or a dancer.", "He is both a singer but a dancer."], 0, "both-এর জোড়া and; as well as নয়।", "both … and।"],
    ["M", "Which of the following sentences is correct?", ["We must learn to cope with difficulties.", "We must learn to cope up with difficulties.", "We must learn to cope up difficulties.", "We must learn to cope to difficulties."], 0, "cope with (up নয়)।", "cope with।"],
  ],
};
