// webpack-বিল্ডের জন্য Tailwind (প্রোডাকশন বিল্ড webpack দিয়ে হয় — Hostinger-এর পুরোনো Linux-এ Turbopack চলে না)।
// npm run dev-এ Turbopack next.config.mjs-এর @tailwindcss/turbopack loader ব্যবহার করে।
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
