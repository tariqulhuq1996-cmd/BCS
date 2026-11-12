/** "এই প্রশ্নে ভুল আছে"-এর কারণ (শিক্ষার্থীর ফর্ম ও অ্যাডমিন-তালিকায় একই লেবেল)। */
export const REPORT_REASONS = {
  WRONG_ANSWER: "সঠিক উত্তর ভুল দেওয়া আছে",
  WRONG_QUESTION: "প্রশ্ন বা অপশনে ভুল",
  WRONG_EXPLANATION: "ব্যাখ্যায় ভুল",
  TYPO: "বানান বা লেখার ভুল",
  OTHER: "অন্য কিছু",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
