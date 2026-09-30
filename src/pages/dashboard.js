import { db, COL } from "../firebase.js";
import { collection, query, where, getDocs, getCountFromServer, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, STATUS_AR, PLAN_AR, fmtDate, toDate, memo, bust } from "../util.js";
import { money, totalOf } from "../finance.js";
const DAY = 86400000, mk = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const cnt = (c, ...w) => getCountFromServer(query(collection(db, c), ...w)).then(s => s.data().count);
const docs = (c, ...w) => getDocs(query(collection(db, c), ...w, limit(300))).then(s => s.docs.map(d => d.data()));
const bars = (title, obj, fmt = v => v) => { const mx = Math.max(1, ...Object.values(obj)); return `<div class="chart"><h4>${title}</h4>${Object.entries(obj).map(([k, v]) => `<div class="bar"><span>${k}</span><i style="width:${v / mx * 100}%"></i><b>${fmt(v)}</b></div>`).join("") || "<p class='mut'>لا بيانات.</p>"}</div>`; };
export async function render(el) {
  el.innerHTML = `<h2>لوحة التحكم</h2><p class="mut">جارٍ التحميل...</p>`;
  // كل البيانات في كاش 5 دقائق؛ العدّادات عبر count (قراءة واحدة لكل 1000 مستند)
  const D = await memo("dash", async () => {
    const now = new Date(), since = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const [nNew, nExec, rq, pj, py, sb] = await Promise.all([cnt(COL.requests, where("status", "==", "NEW")), cnt(COL.requests, where("status", "==", "EXECUTION")),
      docs(COL.requests, where("createdAt", ">=", since)), docs(COL.projects), docs(COL.payments, where("paymentDate", ">=", since)),
      docs(COL.subscriptions, where("endDate", ">=", Timestamp.now()), where("endDate", "<=", Timestamp.fromMillis(Date.now() + 30 * DAY)))]);
    return { nNew, nExec, rq, pj, py: py.filter(x => !x.isDeleted), sb };
  }, 300000);
  const { nNew, nExec, rq, pj, py, sb } = D, now = new Date(), thisM = mk(now);
  const dues = pj.reduce((s, p) => s + Math.max(0, totalOf(p.billing) - (p.paidTotal || 0)), 0);
  const months = {}, coll = {}, plans = {};
  for (let i = 5; i >= 0; i--) { const k = mk(new Date(now.getFullYear(), now.getMonth() - i, 1)); months[k] = 0; coll[k] = 0; }
  rq.forEach(r => { const k = mk(toDate(r.createdAt) || now); if (k in months) months[k]++; plans[PLAN_AR[r.selectedPlan]] = (plans[PLAN_AR[r.selectedPlan]] || 0) + 1; });
  py.forEach(x => { const k = mk(toDate(x.paymentDate) || now); if (k in coll) coll[k] += x.amount; });
  const cards = [["طلبات جديدة", nNew, "🆕"], ["قيد التنفيذ", nExec, "🛠️"], ["مشاريع نشطة", pj.filter(p => p.status === "ACTIVE").length, "🚀"],
    ["عملاء تجريبيون", pj.filter(p => p.usageType === "TRIAL" && p.status === "ACTIVE").length, "🧪"], ["اشتراكات مدفوعة", pj.filter(p => p.usageType === "PAID" && p.status === "ACTIVE").length, "💎"],
    ["تجديدات قريبة", sb.filter(s => s.status !== "CANCELLED").length, "🔄"], ["إجمالي المستحقات", money(dues), "⏳"], ["تحصيلات الشهر", money(coll[thisM]), "💰"]];
  const last = [...rq].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);
  const ren = [...sb].sort((a, b) => a.endDate.seconds - b.endDate.seconds).slice(0, 5);
  const lp = [...py].sort((a, b) => b.paymentDate.seconds - a.paymentDate.seconds).slice(0, 5);
  el.innerHTML = `<h2>لوحة التحكم <button class="btn g" id="rf" style="width:auto;padding:4px 12px">🔄</button></h2><div class="cards">${cards.map(([t, v, i]) => `<div class="stat"><span>${i}</span><b style="font-size:${String(v).length > 8 ? 18 : 28}px">${v}</b><small>${t}</small></div>`).join("")}</div>
   <div class="grid2">${bars("الطلبات حسب الشهر", months)}${bars("التحصيلات", coll, v => v.toLocaleString("ar-EG"))}${bars("توزيع الباقات", plans)}</div>
   <div class="grid2"><div><h4>آخر الطلبات</h4>${last.map(r => `<div class="row-item"><b>${esc(r.requestNumber)}</b><span class="pill s-${r.status}">${STATUS_AR[r.status]}</span><small>${fmtDate(r.createdAt)}</small></div>`).join("") || "—"}</div>
   <div><h4>التجديدات القادمة</h4>${ren.map(s => `<div class="row-item"><span>${PLAN_AR[s.plan]}</span><small>${fmtDate(s.endDate)}</small></div>`).join("") || "—"}</div>
   <div><h4>آخر المدفوعات</h4>${lp.map(x => `<div class="row-item"><b>${money(x.amount)}</b><small>${fmtDate(x.paymentDate)}</small></div>`).join("") || "—"}</div></div>`;
  el.querySelector("#rf").onclick = () => { bust("dash"); render(el); };
}
