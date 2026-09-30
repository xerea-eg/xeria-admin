import { db, COL, storage } from "../firebase.js";
import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, setDoc, query, where, limit, serverTimestamp, Timestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { syncPortalIfExists } from "../portal.js";
import { receiptModal, esc, fmtDate, modal, toast, logActivity, addTimeline, inputDate, PLAN_AR, addDays, addMonths, waBox, bindWa, getCustomer } from "../util.js";
import { METHOD_AR, money, totalOf, loadPlans, loadGeneral, planPrice, addPayment, SUB_AR, subStatus } from "../finance.js";
let emp;
export async function render(el, employee) {
  emp = employee;
  el.innerHTML = `<h2>الحسابات</h2><input id="q" class="search" placeholder="بحث بالمشروع أو النشاط"><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  const ps = (await getDocs(query(collection(db, COL.projects), limit(200)))).docs.map(d => ({ ...d.data(), id: d.id }));
  const paid = Object.fromEntries(ps.map(p => [p.id, p.paidTotal || 0]));
  const draw = () => { const t = el.querySelector("#q").value.trim().toLowerCase();
    el.querySelector("#list").innerHTML = ps.filter(p => !t || (p.projectNumber + p.businessName).toLowerCase().includes(t)).map(p => { const tot = totalOf(p.billing), pd = paid[p.id] || 0;
      return `<div class="req" data-id="${p.id}"><div><b>${esc(p.projectNumber)}</b> — ${esc(p.businessName)}</div><div class="mut">الإجمالي ${money(tot)} · المدفوع ${money(pd)} · <b style="color:${tot - pd > 0 ? "#ff5c7a" : "#22c55e"}">المتبقي ${money(tot - pd)}</b></div></div>`; }).join("") || "<p class='mut'>لا توجد مشاريع.</p>";
    el.querySelectorAll(".req").forEach(e => e.onclick = () => open(ps.find(p => p.id === e.dataset.id), () => render(el, emp))); };
  el.querySelector("#q").oninput = draw; draw();
}
async function open(p, refresh) {
  const [P, G, cu] = await Promise.all([loadPlans(), loadGeneral(), getCustomer(p.customerId)]);
  const b = p.billing || { subscriptionPrice: planPrice(P, p.plan, p.billingCycle), domainPrice: p.hasCustomDomain ? G.domainPrice : 0, addonsCost: 0, discount: 0 };
  const pays = (await getDocs(query(collection(db, COL.payments), where("projectId", "==", p.id)))).docs.map(d => d.data()).filter(x => !x.isDeleted).sort((a, b) => b.paymentDate.seconds - a.paymentDate.seconds);
  const sub = (await getDocs(query(collection(db, COL.subscriptions), where("projectId", "==", p.id)))).docs.map(d => d.data())[0];
  const paid = pays.reduce((s, x) => s + x.amount, 0), tot = totalOf(b), canPay = ["admin", "accounts"].includes(emp.role);
  const { m, close } = modal(`<h3>${esc(p.projectNumber)} — ${esc(p.businessName)}</h3>
   <div class="two"><label>سعر الاشتراك<input id="b1" type="number" value="${b.subscriptionPrice}"></label><label>سعر الدومين<input id="b2" type="number" value="${b.domainPrice}"></label>
   <label>تكلفة الإضافات<input id="b3" type="number" value="${b.addonsCost}"></label><label>الخصم<input id="b4" type="number" value="${b.discount}"></label></div>
   ${canPay ? `<button class="btn g" id="sb">حفظ التسعير</button>` : ""}
   <div class="cards"><div class="stat"><b>${money(tot)}</b><small>الإجمالي</small></div><div class="stat"><b>${money(paid)}</b><small>المدفوع</small></div><div class="stat"><b>${money(tot - paid)}</b><small>المتبقي</small></div></div>
   ${tot - paid > 0 ? waBox(cu.whatsapp || cu.phone, { name: cu.fullName || "", biz: p.businessName, amount: money(tot - paid) }, ["due"]) : ""}
   <h4>الاشتراك</h4>${sub ? `<div class="row-item"><span>${PLAN_AR[sub.plan]}</span><span class="pill">${SUB_AR[subStatus(sub)]}</span><small>${fmtDate(sub.startDate)} → ${fmtDate(sub.endDate)}</small></div>` : (canPay ? `<button class="btn g" id="cs">إنشاء الاشتراك من بيانات المشروع</button>` : "<p class='mut'>لا يوجد اشتراك.</p>")}
   ${canPay ? `<h4>تغيير الباقة</h4><div class="two"><label>الباقة<select id="np">${Object.entries(PLAN_AR).map(([k, v]) => `<option value="${k}" ${k === p.plan ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>الدورة<select id="nc"><option value="MONTHLY">شهري</option><option value="YEARLY">سنوي</option></select></label></div><button class="btn g" id="cp">تحويل الباقة</button>` : ""}
   <h4>المدفوعات</h4>${pays.map(x => `<div class="row-item"><b>${money(x.amount)}</b><span>${METHOD_AR[x.paymentMethod]}</span><small>${fmtDate(x.paymentDate)} · ${esc(x.receivedBy)}</small>${x.receiptUrl ? `<a href="${esc(x.receiptUrl)}" target="_blank" rel="noopener">مرفق</a>` : ""}${x.receiptId ? `<a href="receipt.html?id=${x.receiptId}" target="_blank" rel="noopener">🧾 ${esc(x.receiptNumber || "إيصال")}</a>` : ""}${canPay ? `<button class="btn r del" data-id="${x.paymentId}" style="width:auto;padding:4px 10px">حذف</button>` : ""}</div>`).join("") || "<p class='mut'>لا توجد مدفوعات.</p>"}
   ${canPay ? `<h4>تسجيل دفعة</h4><div class="two"><label>المبلغ<input id="pa" type="number" min="1"></label><label>التاريخ<input id="pd" type="date" value="${inputDate(new Date())}"></label>
   <label>الطريقة<select id="pm">${Object.entries(METHOD_AR).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label>رقم العملية<input id="pt"></label></div>
   <label>إيصال (صورة/PDF)<input id="pr" type="file" accept="image/*,application/pdf"></label><label>ملاحظات<input id="pn"></label><button class="btn" id="ap">تسجيل الدفعة</button>` : ""}`);
  const $ = s => m.querySelector(s), done = msg => { syncPortalIfExists(p.customerId); toast(msg); close(); refresh(); };
  const run = fn => async () => { try { await fn(); } catch (e) { console.error(e); toast("حدث خطأ"); } };
  bindWa(m);
  if (!canPay) return;
  $("#sb").onclick = run(async () => { const n = { subscriptionPrice: +$("#b1").value, domainPrice: +$("#b2").value, addonsCost: +$("#b3").value, discount: +$("#b4").value };
    await updateDoc(doc(db, COL.projects, p.id), { billing: n, updatedAt: serverTimestamp() }); await logActivity(emp, "UPDATE_BILLING", "project", p.id, p.billing || null, n); p.billing = n; done("تم الحفظ"); });
  $("#cs")?.addEventListener("click", run(async () => { const r = doc(collection(db, COL.subscriptions));
    await setDoc(r, { subscriptionId: r.id, customerId: p.customerId, projectId: p.id, plan: p.plan, billingCycle: p.usageType === "TRIAL" ? "TRIAL" : p.billingCycle || "MONTHLY", startDate: p.startDate, endDate: p.endDate, nextRenewalDate: p.endDate, price: +$("#b1").value, status: "ACTIVE", createdAt: serverTimestamp() });
    await logActivity(emp, "CREATE_SUBSCRIPTION", "subscription", r.id); done("تم إنشاء الاشتراك"); }));
  $("#cp").onclick = run(async () => {
    const plan = $("#np").value, cyc = plan === "TRIAL" ? "TRIAL" : $("#nc").value; if (plan === p.plan && cyc === p.billingCycle) return toast("هذه هي الباقة الحالية");
    if (!confirm("تحويل المشروع إلى الباقة المختارة؟ سيبدأ اشتراك جديد من اليوم.")) return;
    const price = planPrice(P, plan, cyc), st = new Date(), en = plan === "TRIAL" ? addDays(st, G.trialDays || 14) : addMonths(st, cyc === "YEARLY" ? 12 : 1), tS = Timestamp.fromDate(st), tE = Timestamp.fromDate(en);
    await updateDoc(doc(db, COL.projects, p.id), { plan, billingCycle: cyc, usageType: plan === "TRIAL" ? "TRIAL" : "PAID", billing: { ...b, subscriptionPrice: price }, startDate: tS, endDate: tE, status: "ACTIVE", updatedAt: serverTimestamp() });
    const sd = { plan, billingCycle: cyc, startDate: tS, endDate: tE, nextRenewalDate: tE, price, status: "ACTIVE" };
    if (sub) await updateDoc(doc(db, COL.subscriptions, sub.subscriptionId), { ...sd, updatedAt: serverTimestamp() });
    else { const r = doc(collection(db, COL.subscriptions)); await setDoc(r, { subscriptionId: r.id, customerId: p.customerId, projectId: p.id, ...sd, createdAt: serverTimestamp() }); }
    await logActivity(emp, "CHANGE_PLAN", "project", p.id, { plan: p.plan, billingCycle: p.billingCycle }, { plan, billingCycle: cyc });
    await addTimeline(emp, p.customerId, "PLAN_CHANGED", `تم التحويل إلى ${PLAN_AR[plan]}${plan === "TRIAL" ? "" : cyc === "YEARLY" ? " (سنوي)" : " (شهري)"}`, p.id);
    done("تم تحويل الباقة — سجّل الدفعة إن وُجدت"); });
  m.querySelectorAll(".del").forEach(b => b.onclick = run(async () => { const why = prompt("سبب حذف الدفعة (إلزامي):"); if (!why || !why.trim()) return toast("سبب الحذف مطلوب"); const x = pays.find(y => y.paymentId === b.dataset.id);
    await updateDoc(doc(db, COL.payments, x.paymentId), { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: emp.fullName, deleteReason: why.trim() });
    await updateDoc(doc(db, COL.projects, x.projectId), { paidTotal: increment(-x.amount), updatedAt: serverTimestamp() });
    if (x.receiptId) await updateDoc(doc(db, "receipts", x.receiptId), { void: true, voidReason: why.trim() });
    await addTimeline(emp, x.customerId, "PAYMENT_DELETED", `تم حذف دفعة ${money(x.amount)} — ${why.trim()}`, x.projectId); await logActivity(emp, "DELETE_PAYMENT", "payment", x.paymentId, { amount: x.amount, projectId: x.projectId }, { isDeleted: true, reason: why.trim() }); done("تم الحذف"); }));
  $("#ap").onclick = run(async () => { if (!(+$("#pa").value > 0)) return toast("أدخل المبلغ");
    let receiptUrl = ""; const f = $("#pr").files[0];
    if (f) { if (!(f.type.startsWith("image/") || f.type === "application/pdf") || f.size > 5 * 1024 * 1024) return toast("ملف غير مسموح أو أكبر من 5MB");
      const r = ref(storage, `receipts/${p.id}/${crypto.randomUUID()}`); await uploadBytes(r, f); receiptUrl = await getDownloadURL(r); }
    const rc = await addPayment(emp, p, null, { amount: $("#pa").value, paymentDate: $("#pd").value, paymentMethod: $("#pm").value, transactionNumber: $("#pt").value, receiptUrl, notes: $("#pn").value }); done("تم تسجيل الدفعة"); receiptModal(rc, cu); });
}
