import { db, COL } from "../firebase.js";
import { collection, getDocs, query, where, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { exportXls, fmtDate, PLAN_AR, STATUS_AR, PROJECT_AR, USAGE_AR, toDate, inputDate, addDays, memo } from "../util.js";
import { money, totalOf, daysLeft } from "../finance.js";
const g = (c, ...w) => getDocs(query(collection(db, c), ...w, limit(500))).then(s => s.docs.map(d => d.data()));
const csv = (name, rows) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" })); a.download = name + ".csv"; a.click(); };
export async function render(el) {
  el.innerHTML = `<h2>التقارير</h2><div class="two"><label>من<input id="f" type="date" value="${inputDate(addDays(new Date(), -30))}"></label><label>إلى<input id="t" type="date" value="${inputDate(new Date())}"></label></div><button class="btn" id="go" style="width:auto">عرض</button> <button class="btn g" id="ex" style="width:auto">CSV ملخص</button> <button class="btn g" id="x1" style="width:auto">📊 الطلبات</button> <button class="btn g" id="x2" style="width:auto">📊 المدفوعات</button> <button class="btn g" id="x3" style="width:auto">📊 المشاريع</button><p class="mut">الفلترة تتم على الخادم، فلا تُقرأ إلا بيانات الفترة المختارة.</p><div id="out" style="margin-top:14px"></div>`;
  let rows = [], cur = null;
  const run = async () => { const fv = el.querySelector("#f").value, tv = el.querySelector("#t").value, lo = Timestamp.fromDate(new Date(fv)), hi = Timestamp.fromDate(new Date(tv + "T23:59:59"));
    el.querySelector("#out").innerHTML = "<p class='mut'>جارٍ التحميل...</p>";
    const D = await memo(`rep:${fv}:${tv}`, async () => { const [R, Py, pj, sb] = await Promise.all([g(COL.requests, where("createdAt", ">=", lo), where("createdAt", "<=", hi)),
      g(COL.payments, where("paymentDate", ">=", lo), where("paymentDate", "<=", hi)), g(COL.projects), g(COL.subscriptions)]); return { R, Py: Py.filter(x => !x.isDeleted), pj, sb }; }, 300000);
    cur = D; const { R, Py, pj, sb } = D, inR = x => { const d = toDate(x); return d && d >= lo.toDate() && d <= hi.toDate(); };
    const grp = (list, key) => { const o = {}; list.forEach(x => { const k = x[key] || "غير محدد"; o[k] = (o[k] || 0) + 1; }); return Object.entries(o); };
    rows = [["البند", "القيمة"], ["الطلبات خلال الفترة", R.length], ["الطلبات المحولة لمشاريع", R.filter(r => r.status === "ACTIVE").length], ["المشاريع المنشأة خلال الفترة", pj.filter(p => inR(p.createdAt)).length],
      ["المشاريع النشطة", pj.filter(p => p.status === "ACTIVE").length], ["العملاء التجريبيون", pj.filter(p => p.usageType === "TRIAL" && p.status === "ACTIVE").length],
      ["الاشتراكات النشطة", sb.filter(s => s.status !== "CANCELLED" && daysLeft(s.endDate) >= 0).length], ["عدد المدفوعات", Py.length], ["إجمالي المدفوعات", money(Py.reduce((s, x) => s + x.amount, 0))],
      ["المبالغ المستحقة", money(pj.reduce((s, p) => s + Math.max(0, totalOf(p.billing) - (p.paidTotal || 0)), 0))], ["تجديدات خلال 30 يومًا", sb.filter(s => daysLeft(s.endDate) >= 0 && daysLeft(s.endDate) <= 30).length],
      ...grp(R, "callCenterEmployeeName").map(([k, v]) => ["أداء Call Center — " + k, v]), ...grp(pj.filter(p => inR(p.createdAt)), "assignedExecutionEmployeeName").map(([k, v]) => ["أداء التنفيذ — " + k, v])];
    el.querySelector("#out").innerHTML = `<div class="list">${rows.slice(1).map(([k, v]) => `<div class="row-item"><span>${k}</span><b>${v}</b></div>`).join("")}</div>`; };
  const need = () => cur || (alert("اضغط عرض أولًا"), null);
  el.querySelector("#x1").onclick = () => need() && exportXls("requests", ["رقم الطلب", "الباقة", "الحالة", "موظف Call Center", "التاريخ"], cur.R.map(r => [r.requestNumber, PLAN_AR[r.selectedPlan], STATUS_AR[r.status], r.callCenterEmployeeName || "", fmtDate(r.createdAt)]));
  el.querySelector("#x2").onclick = () => need() && exportXls("payments", ["المبلغ", "الطريقة", "التاريخ", "رقم العملية", "استلمها", "المشروع"], cur.Py.map(x => [x.amount, x.paymentMethod, fmtDate(x.paymentDate), x.transactionNumber || "", x.receivedBy || "", x.projectId]));
  el.querySelector("#x3").onclick = () => need() && exportXls("projects", ["رقم المشروع", "النشاط", "النظام", "الباقة", "الاستخدام", "الحالة", "البداية", "النهاية", "الإجمالي", "المدفوع"], cur.pj.map(p => [p.projectNumber, p.businessName, p.systemType, PLAN_AR[p.plan], USAGE_AR[p.usageType], PROJECT_AR[p.status], fmtDate(p.startDate), fmtDate(p.endDate), totalOf(p.billing), p.paidTotal || 0]));
  el.querySelector("#go").onclick = run; el.querySelector("#ex").onclick = () => csv("xeria-report", rows); run();
}
