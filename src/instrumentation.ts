/** সার্ভার চালুর সময় একবার: পরিবেশ-চলক যাচাই। */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("./lib/env");
  const { errors, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[কনফিগারেশন] সতর্কতা: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[কনফিগারেশন] ত্রুটি: ${e}`);
    if (process.env.NODE_ENV === "production") throw new Error("প্রয়োজনীয় পরিবেশ-চলক নেই; সার্ভার চালু করা হলো না। ওপরের ত্রুটি দেখুন।");
  }
}
