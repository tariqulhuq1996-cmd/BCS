/** এখন থেকে n দিন আগের মুহূর্ত (সার্ভারে প্রতিটি রিকোয়েস্টে নতুন করে হিসাব হয়)। */
export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 864e5);
}
