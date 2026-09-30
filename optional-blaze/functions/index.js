const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore(), DAY = 86400000;

// إنشاء إشعار مرة واحدة فقط (ID ثابت لمنع التكرار)
async function push(id, type, message, targetType, targetId) {
  try { await db.collection("notifications").doc(id).create({ type, message, targetType, targetId, isRead: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }); }
  catch (e) { if (e.code !== 6) throw e; }
}
const days = ts => Math.ceil((ts.toMillis() - Date.now()) / DAY);

exports.dailyAlerts = onSchedule({ schedule: "every day 08:00", timeZone: "Africa/Cairo" }, async () => {
  const [subs, projs, pays] = await Promise.all([db.collection("subscriptions").get(), db.collection("projects").get(), db.collection("payments").get()]);
  const P = {}; projs.forEach(d => P[d.id] = d.data());
  // اشتراكات تنتهي خلال 7 أيام أو انتهت
  for (const d of subs.docs) { const s = d.data(); if (s.status === "CANCELLED" || !s.endDate || !P[s.projectId]) continue; const n = days(s.endDate), name = P[s.projectId].businessName, ms = s.endDate.toMillis();
    if (n >= 0 && n <= 7) await push(`subexp_${d.id}_${ms}`, "SUBSCRIPTION_EXPIRING", `اشتراك ${name} ينتهي خلال ${n} يوم`, "project", s.projectId);
    else if (n < 0 && n >= -3) await push(`subend_${d.id}_${ms}`, "SUBSCRIPTION_EXPIRED", `انتهى اشتراك ${name}`, "project", s.projectId); }
  // دومينات
  for (const [id, p] of Object.entries(P)) { if (!p.hasCustomDomain || !p.domainExpiryDate) continue; const n = days(p.domainExpiryDate), ms = p.domainExpiryDate.toMillis();
    if (n >= 0 && n <= 30 && (n <= 7 || n === 30 || n === 15)) await push(`domexp_${id}_${ms}_${n <= 7 ? 7 : n}`, "DOMAIN_EXPIRING", `الدومين ${p.domainName} ينتهي خلال ${n} يوم`, "project", id); }
  // مبالغ مستحقة (إشعار أسبوعي)
  const paid = {}; pays.forEach(d => { const x = d.data(); if (x.isDeleted) return; paid[x.projectId] = (paid[x.projectId] || 0) + x.amount; });
  const wk = Math.floor(Date.now() / (7 * DAY));
  for (const [id, p] of Object.entries(P)) { const b = p.billing; if (!b || p.status !== "ACTIVE") continue; const t = (+b.subscriptionPrice || 0) + (+b.domainPrice || 0) + (+b.addonsCost || 0) - (+b.discount || 0), rest = t - (paid[id] || 0);
    if (rest > 0) await push(`due_${id}_${wk}`, "DUE_AMOUNT", `مبلغ مستحق ${rest} جنيه — ${p.businessName}`, "project", id); }
  // مواعيد إعادة الاتصال (اليوم)
  const rq = await db.collection("requests").where("callbackAt", "<=", admin.firestore.Timestamp.fromMillis(Date.now() + DAY)).get();
  for (const d of rq.docs) { const r = d.data(); if (r.status === "NEW" && r.callbackAt.toMillis() >= Date.now() - DAY) await push(`cb_${d.id}_${r.callbackAt.toMillis()}`, "CALLBACK", `موعد إعادة اتصال: ${r.requestNumber}`, "request", d.id); }
});
