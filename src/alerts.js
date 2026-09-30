// تنبيهات يومية من المتصفح (بديل Cloud Functions على الخطة المجانية).
// تعمل مرة واحدة يوميًا لكل جهاز، وتقرأ فقط المستندات القريبة من الانتهاء عبر range queries.
import { db, COL } from "./firebase.js";
import { collection, query, where, limit, getDocs, getDoc, doc, setDoc, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const DAY = 86400000, ts = ms => Timestamp.fromMillis(ms);
const push = async (id, type, message, targetType, targetId) => {
  const r = doc(db, COL.notifications, id); if ((await getDoc(r)).exists()) return;   // ID ثابت = لا تكرار
  await setDoc(r, { type, message, targetType, targetId, isRead: false, createdAt: serverTimestamp() });
};
export async function runAlerts(emp) {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("alertsRun") === today) return; localStorage.setItem("alertsRun", today);
  const now = Date.now();
  try {
    if (["admin", "manager", "accounts"].includes(emp.role)) {
      const subs = await getDocs(query(collection(db, COL.subscriptions), where("endDate", ">=", ts(now - 3 * DAY)), where("endDate", "<=", ts(now + 7 * DAY)), limit(50)));
      for (const d of subs.docs) { const s = d.data(); if (s.status === "CANCELLED") continue; const n = Math.ceil((s.endDate.toMillis() - now) / DAY), ms = s.endDate.toMillis();
        const p = (await getDoc(doc(db, COL.projects, s.projectId))).data() || {};
        if (n >= 0) await push(`subexp_${d.id}_${ms}`, "SUBSCRIPTION_EXPIRING", `اشتراك ${p.businessName || ""} ينتهي خلال ${n} يوم`, "project", s.projectId);
        else await push(`subend_${d.id}_${ms}`, "SUBSCRIPTION_EXPIRED", `انتهى اشتراك ${p.businessName || ""}`, "project", s.projectId); }
      const doms = await getDocs(query(collection(db, COL.projects), where("domainExpiryDate", ">=", ts(now - 3 * DAY)), where("domainExpiryDate", "<=", ts(now + 30 * DAY)), limit(50)));
      for (const d of doms.docs) { const p = d.data(); if (!p.hasCustomDomain) continue; const n = Math.ceil((p.domainExpiryDate.toMillis() - now) / DAY);
        if (n <= 7 || n === 15 || n === 30) await push(`domexp_${d.id}_${p.domainExpiryDate.toMillis()}_${n <= 7 ? 7 : n}`, "DOMAIN_EXPIRING", `الدومين ${p.domainName} ${n < 0 ? "انتهى" : "ينتهي خلال " + n + " يوم"}`, "project", d.id); }
    }
    if (["admin", "callcenter"].includes(emp.role)) {
      const rq = await getDocs(query(collection(db, COL.requests), where("callbackAt", ">=", ts(now - DAY)), where("callbackAt", "<=", ts(now + DAY)), limit(50)));
      for (const d of rq.docs) { const r = d.data(); if (r.status === "NEW") await push(`cb_${d.id}_${r.callbackAt.toMillis()}`, "CALLBACK", `موعد إعادة اتصال: ${r.requestNumber}`, "request", d.id); }
    }
  } catch (e) { console.warn("alerts", e); }
}
