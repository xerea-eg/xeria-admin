import { db, COL } from "../firebase.js";
import { collection, getDocs, getDoc, doc, updateDoc, query, where, limit, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { syncPortalIfExists } from "../portal.js";
import { receiptModal, contactBtns, esc, fmtDate, modal, toast, logActivity, addTimeline, addMonths, PLAN_AR, memo, bust, getCustomer, waBox, bindWa } from "../util.js";
import { METHOD_AR, money, daysLeft, loadPlans, loadGeneral, planPrice, addPayment } from "../finance.js";
let emp, days = 30;
const DAY = 86400000;
// نطاق واحد فقط (آخر 60 يوم ← بعد 30 يوم) بدل قراءة كل الاشتراكات
const load = () => memo("renewals", async () => {
  const lo = Timestamp.fromMillis(Date.now() - 60 * DAY), hi = Timestamp.fromMillis(Date.now() + 30 * DAY);
  const [P, G, sn, dn] = await Promise.all([loadPlans(), loadGeneral(),
    getDocs(query(collection(db, COL.subscriptions), where("endDate", ">=", lo), where("endDate", "<=", hi), limit(200))),
    getDocs(query(collection(db, COL.projects), where("domainExpiryDate", ">=", lo), where("domainExpiryDate", "<=", hi), limit(200)))]);
  const items = [];
  await Promise.all(sn.docs.map(async d => { const s = { ...d.data(), id: d.id }; if (s.status === "CANCELLED") return;
    const pd = await getDoc(doc(db, COL.projects, s.projectId)); if (!pd.exists()) return;
    items.push({ kind: "sub", s, p: { ...pd.data(), id: pd.id }, end: s.endDate, val: s.price || planPrice(P, s.plan, s.billingCycle), label: PLAN_AR[s.plan] }); }));
  dn.docs.forEach(d => { const p = { ...d.data(), id: d.id }; if (p.hasCustomDomain) items.push({ kind: "dom", p, end: p.domainExpiryDate, val: p.domainRenewalPrice || G.domainPrice, label: p.domainName }); });
  await Promise.all(items.map(async i => i.c = await getCustomer(i.p.customerId)));
  return items;
}, 300000);
export async function render(el, employee) {
  emp = employee; el.innerHTML = `<h2>التجديدات <button class="btn g" id="rf" style="width:auto;padding:4px 12px">🔄</button></h2><div class="tabs">${[7, 15, 30].map(n => `<button data-n="${n}" class="${n === days ? "on" : ""}">خلال ${n} ${n === 7 ? "أيام" : "يوم"}</button>`).join("")}</div><div id="body"><p class="mut">جارٍ التحميل...</p></div>`;
  el.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { days = +b.dataset.n; render(el, emp); });
  el.querySelector("#rf").onclick = () => { bust("renewals"); render(el, emp); };
  const items = await load();
  const sec = (title, list) => `<h4>${title} (${list.length})</h4><div class="list">${list.map(i => { const c = i.c || {}; return `<div class="req">${contactBtns(c.phone, c.whatsapp)}<div><b>${esc(c.fullName)}</b> · ${esc(c.phone)}</div><div>${esc(i.p.projectNumber)} — ${esc(i.p.businessName)} · ${esc(i.label)}</div><div class="mut">ينتهي ${fmtDate(i.end)} · القيمة ${money(i.val)}</div><button class="btn rn" data-k="${i.kind}" data-p="${i.p.id}" style="width:auto">تسجيل التجديد</button></div>`; }).join("") || "<p class='mut'>لا يوجد.</p>"}</div>`;
  const f = (k, exp) => items.filter(i => i.kind === k && (exp ? daysLeft(i.end) < 0 : daysLeft(i.end) >= 0 && daysLeft(i.end) <= days));
  const body = el.querySelector("#body"); body.innerHTML = sec("اشتراكات تنتهي قريبًا", f("sub")) + sec("اشتراكات منتهية", f("sub", 1)) + sec("دومينات تنتهي قريبًا", f("dom")) + sec("دومينات منتهية", f("dom", 1));
  body.querySelectorAll(".rn").forEach(b => b.onclick = () => renew(items.find(i => i.kind === b.dataset.k && i.p.id === b.dataset.p), () => render(el, emp)));
}
function renew(i, refresh) {
  const c = i.c || {};
  const { m, close } = modal(`<h3>تسجيل تجديد — ${esc(i.p.businessName)}</h3><div class="two"><label>المبلغ<input id="a" type="number" value="${i.val}"></label>
   <label>الطريقة<select id="m">${Object.entries(METHOD_AR).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div><label>رقم العملية<input id="t"></label><button class="btn" id="go">تأكيد التجديد</button>
   ${waBox(c.whatsapp || c.phone, { name: c.fullName || "", biz: i.p.businessName, date: fmtDate(i.end) }, ["renewal"])}`);
  bindWa(m);
  m.querySelector("#go").onclick = async () => { try {
    const a = m.querySelector("#a").value; if (!(+a > 0)) return toast("أدخل المبلغ");
    const rc = await addPayment(emp, i.p, null, { amount: a, paymentMethod: m.querySelector("#m").value, transactionNumber: m.querySelector("#t").value, notes: i.kind === "dom" ? "تجديد دومين" : "تجديد اشتراك" });
    const base = Math.max(i.end.toDate(), Date.now());
    if (i.kind === "sub") { const ne = Timestamp.fromDate(addMonths(base, i.s.billingCycle === "YEARLY" ? 12 : 1));
      await updateDoc(doc(db, COL.subscriptions, i.s.id), { endDate: ne, nextRenewalDate: ne, status: "ACTIVE", updatedAt: serverTimestamp() });
      await updateDoc(doc(db, COL.projects, i.p.id), { endDate: ne, status: "ACTIVE", updatedAt: serverTimestamp() }); }
    else await updateDoc(doc(db, COL.projects, i.p.id), { domainExpiryDate: Timestamp.fromDate(addMonths(base, 12)), domainStatus: "ACTIVE", updatedAt: serverTimestamp() });
    await logActivity(emp, "RENEW", i.kind === "sub" ? "subscription" : "domain", i.p.id, null, { amount: +a });
    await addTimeline(emp, i.p.customerId, "RENEWAL", i.kind === "sub" ? "تم تجديد الاشتراك" : "تم تجديد الدومين", i.p.id);
    bust("renewals"); bust("dash"); syncPortalIfExists(i.p.customerId); toast("تم التجديد"); close(); refresh(); receiptModal(rc, c); } catch (e) { console.error(e); toast("حدث خطأ"); } };
}
