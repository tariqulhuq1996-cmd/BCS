/** Learning Cycle-এর ধাপের নাম ও বর্ণনা — Dashboard, ধাপ-পাতা ও পরে পরীক্ষা-ইঞ্জিন একই শব্দ ব্যবহার করবে। */
export const L1_STEPS = [
  { key: "SOLVE", label: "প্রশ্ন সমাধান", desc: "এই BCS-এর সব যাচাইকৃত প্রশ্ন, ৫০টি করে ভাগে।" },
  { key: "REVIEW", label: "উত্তর পর্যালোচনা", desc: "সঠিক, ভুল ও অনুত্তরিত প্রশ্ন, ব্যাখ্যা ও বিষয়ভিত্তিক ফল।" },
  { key: "REVISION", label: "ভুলের Revision", desc: "ভুল ও অনিশ্চিত প্রশ্ন নিয়ে Revision Test।" },
  { key: "MASTERY", label: "Mastery Test", desc: "এই BCS থেকে ৪০টি প্রশ্ন; নির্ধারিত নম্বর লাগবে।" },
  { key: "CUMULATIVE", label: "Cumulative Test", desc: "১০ম থেকে এই BCS পর্যন্ত সব প্রশ্ন থেকে।" },
] as const;

export const L2_STEPS = [
  { key: "SOLVE", label: "পরিচিতি ও প্রথম সমাধান", desc: "উপবিষয়ের পরিচিতি, তারপর সব প্রশ্ন।" },
  { key: "REVIEW", label: "উত্তর ও ব্যাখ্যা", desc: "প্রতিটি প্রশ্নের ব্যাখ্যা পড়া।" },
  { key: "REVISION", label: "ভুলের Revision ও Practice Test", desc: "ভুল প্রশ্ন এবং উপবিষয়ভিত্তিক অনুশীলন।" },
  { key: "MASTERY", label: "Mastery Test", desc: "নির্ধারিত নম্বর পেলে উপবিষয় সম্পন্ন।" },
] as const;

export type StepKey = "SOLVE" | "REVIEW" | "REVISION" | "MASTERY" | "CUMULATIVE" | "DONE";

export const ATTEMPT_KIND_BN: Record<string, string> = {
  SOLVE: "প্রথম সমাধান",
  REVISION: "Revision Test",
  MASTERY: "Mastery Test",
  CUMULATIVE: "Cumulative Test",
  PRACTICE: "অনুশীলন",
  CHECKPOINT: "Checkpoint",
  LEVEL_FINAL: "Final Assessment",
  MODEL_TEST: "Model Test",
  SRS_REVIEW: "দৈনিক Revision",
  MISTAKE_PRACTICE: "ভুলের অনুশীলন",
  DIAGNOSTIC: "শুরুর মূল্যায়ন",
  REPEAT: "Repeat Mastery Test",
};

export const LOCKED_MESSAGE = "এই ধাপটি Unlock করতে আগের ধাপের নির্ধারিত কাজ সম্পন্ন করুন।";
