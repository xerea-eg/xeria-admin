// عدّاد الطلبات الجديدة لحظيًا. يقرأ 20 مستندًا كحد أقصى عند البدء، ثم مستندًا واحدًا لكل طلب جديد.
// يتوقف تلقائيًا بعد دقيقتين من إخفاء التطبيق (إلا إذا فعّلت تنبيهات الجهاز) لتوفير الحصة المجانية.
import { db, COL } from "./firebase.js";
import { collection, query, where, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast, bust } from "./util.js";
let unsub = null, first = true, hiddenAt = 0, wired = false, timer = null;
const granted = () => typeof Notification !== "undefined" && Notification.permission === "granted";
function badge(n) {
  const a = document.querySelector('#nav a[data-p="requests"]'); if (!a) return; let b = a.querySelector(".nb");
  if (!n) return b && b.remove(); if (!b) { b = document.createElement("b"); b.className = "nb"; a.append(b); } b.textContent = n >= 20 ? "20+" : n;
}
function deviceAlert(title, body) {
  if (!granted() || !document.hidden || !navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: "icons/icon-192.png", tag: "new-request" })).catch(() => {});
}
function attach() {
  first = true;
  unsub = onSnapshot(query(collection(db, COL.requests), where("status", "==", "NEW"), limit(20)), snap => {
    badge(snap.size);
    if (!first) snap.docChanges().forEach(ch => { if (ch.type === "added") { bust("dash"); const n = ch.doc.data().requestNumber || ""; toast("📥 طلب جديد " + n); deviceAlert("طلب جديد — XERIA", n); } });
    first = false;
  }, () => {});
}
export function startLive(emp) {
  if (!["admin", "manager", "callcenter"].includes(emp.role) || unsub) return;
  attach();
  if (wired) return; wired = true;
  document.addEventListener("visibilitychange", () => { if (document.hidden) hiddenAt = Date.now(); else if (!unsub && timer !== "off") attach(); });
  setInterval(() => { if (unsub && document.hidden && !granted() && Date.now() - hiddenAt > 120000) { unsub(); unsub = null; } }, 60000);
}
export function stopLive() { if (unsub) unsub(); unsub = null; badge(0); }
export async function enableDeviceAlerts() { return typeof Notification === "undefined" ? "unsupported" : Notification.requestPermission(); }
