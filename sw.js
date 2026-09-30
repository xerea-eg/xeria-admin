// Service Worker: يخزّن ملفات الواجهة فقط (لا بيانات Firestore) ويحدّثها في الخلفية
const V = "xeria-v1", SHELL = ["./", "index.html", "manifest.json", "src/style.css"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || /\/(order|receipt|portal)\.html$/.test(u.pathname)) return;   // صفحة الطلب العامة تُجلب دائمًا من الشبكة
  if (!(u.origin === location.origin || (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")))) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
