/** ফাইলের নাম থেকে প্রশ্নব্যাংকের key: "BCS52_BNP_Govt_Political_Question_Bank.docx" → "bnp-govt-political" (ক্লায়েন্টেও চলে) */
export function bankKeyFromFilename(name: string): string {
  const k = name
    .replace(/\.[^.]+$/, "")
    .replace(/^BCS\d*[_\s-]*/i, "")
    .replace(/[_\s-]*Question[_\s-]*Bank$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return k.slice(0, 60) || "current-affairs";
}
export const isValidBankKey = (k: string) => /^[a-z0-9][a-z0-9-]{1,59}$/.test(k);
