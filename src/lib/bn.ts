const DIGITS = "০১২৩৪৫৬৭৮৯";

/** ইংরেজি অঙ্ককে বাংলা অঙ্কে রূপান্তর (দশমিক ও যতিচিহ্ন অপরিবর্তিত)। */
export function bn(v: number | string): string {
  return String(v).replace(/\d/g, (d) => DIGITS[+d]);
}

/** হাজার-বিভাজকসহ বাংলা সংখ্যা: ৫,৩৫২ */
export function bnNum(n: number, fractionDigits = 0): string {
  return bn(
    n.toLocaleString("en-IN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
  ).replace(/^-/, "−"); // সঠিক বিয়োগ-চিহ্ন
}

/** "১০ম", "১১তম" … বিসিএস ক্রমবাচক */
export function bnOrdinal(n: number): string {
  return n === 10 ? "১০ম" : `${bn(n)}তম`;
}
