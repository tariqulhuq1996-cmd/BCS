/** সার্ভার চালুর সময় একবার: পরিবেশ-চলক যাচাই, তারপর (প্রোডাকশনে) পটভূমিতে ডেটাবেস-প্রস্তুতি। */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("./lib/env");
  const { errors, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[কনফিগারেশন] সতর্কতা: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[কনফিগারেশন] ত্রুটি: ${e}`);
    if (process.env.NODE_ENV === "production") throw new Error("প্রয়োজনীয় পরিবেশ-চলক নেই; সার্ভার চালু করা হলো না। ওপরের ত্রুটি দেখুন।");
  }
  // কিছু হোস্টে (যেমন Hostinger) বিল্ডের সময় ডেটাবেস পাওয়া যায় না — তাই চালুর সময়ও টেবিল/ডেটা/অ্যাডমিন প্রস্তুতি।
  // পটভূমিতে চলে, সার্ভার আটকায় না; সব ধাপ বারবার চালানো নিরাপদ। বন্ধ করতে: DB_SETUP_ON_START=0
  if (process.env.NODE_ENV === "production" && process.env.DB_SETUP_ON_START !== "0") {
    const { spawn } = await import("node:child_process");
    const child = spawn("npx", ["tsx", "scripts/deploy-setup.ts", "--soft", "--on-start"], { cwd: process.cwd(), env: process.env, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", (e) => console.warn("[deploy-setup] চালু করা যায়নি:", e.message));
  }
}
