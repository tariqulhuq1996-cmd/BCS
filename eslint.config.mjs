import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // প্রশ্নব্যাংক ও কার্ডের নির্মাণ-স্ক্রিপ্ট (সাইটের অংশ নয়)
    "content/**",
  ]),
]);

export default eslintConfig;
