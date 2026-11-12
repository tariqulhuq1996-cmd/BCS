/* BCS ৫২ প্রস্তুতি — ন্যূনতম service worker।
 * কিছুই cache করে না (পাতা ও তথ্য সবসময় সার্ভার থেকে, যাতে পুরোনো বা অন্যের তথ্য না দেখায়);
 * শুধু ইন্টারনেট না থাকলে পাতা খুলতে গেলে একটি "ইন্টারনেট নেই" বার্তা দেখায়। */
const OFFLINE = "/offline.html";
const CACHE = "bcs52-offline-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
