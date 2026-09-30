import { db, COL } from "../firebase.js";
import { collection, query, where, limit, getDocs, getDoc, doc, updateDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { waBox, bindWa, getCustomer, contactBtns, mkFilters, BUSINESS_TYPES, esc, STATUS_AR, PLAN_AR, fmtDate, fmtDT, toDate, waLink, toast, logActivity, notify, addTimeline } from "../util.js";
let status = "NEW", cache = {}, emp, host, term = "", F;
const cust = id => getCustomer(id);

export async function render(el, employee) {
  emp = employee; host = el;
  const pq = sessionStorage.getItem("q"); if (pq) { term = pq; status = sessionStorage.getItem("qs") || status; sessionStorage.removeItem("q"); sessionStorage.removeItem("qs"); }
  el.innerHTML = `<h2>الطلبات</h2>
   <div class="tabs">${Object.keys(STATUS_AR).map(s => `<button data-s="${s}" class="${s===status?"on":""}">${STATUS_AR[s]}</button>`).join("")}</div>
   <input id="q" class="search" placeholder="بحث بالاسم أو الهاتف أو رقم الطلب" value="${esc(term)}">
   <div id="fl"></div><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  el.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { status = b.dataset.s; render(el, emp); });
  el.querySelector("#q").oninput = e => { term = e.target.value; draw(); };
  F = mkFilters(el.querySelector("#fl"), [{ id: "plan", label: "الباقة", options: Object.entries(PLAN_AR) }, { id: "type", label: "نوع النشاط", options: BUSINESS_TYPES.map(t => [t, t]) }], draw);
  const snap = await getDocs(query(collection(db, COL.requests), where("status","==",status), limit(200)));
  host._rows = await Promise.all(snap.docs.map(async d => { const r = d.data(); return { ...r, id: d.id, c: await cust(r.customerId) }; }));
  host._rows.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  draw();
}
function draw() {
  const t = term.trim().toLowerCase();
  const V = F.vals(), rows = host._rows.filter(r => (!t || [r.requestNumber, r.c.fullName, r.c.phone, r.c.businessName].join(" ").toLowerCase().includes(t)) && (!V.plan || r.selectedPlan === V.plan) && (!V.type || r.c.businessType === V.type) && F.inRange(r.createdAt));
  host.querySelector("#list").innerHTML = rows.map(r => `<div class="req" data-id="${r.id}">${contactBtns(r.c.phone, r.c.whatsapp)}
     <div><b>${esc(r.requestNumber)}</b> <span class="pill s-${r.status}">${STATUS_AR[r.status]}</span></div>
     <div>${esc(r.c.fullName)} — ${esc(r.c.businessName)}</div>
     <div class="mut">${esc(r.c.phone)} · ${PLAN_AR[r.selectedPlan]||""} · ${esc(r.c.businessType)} · ${fmtDate(r.createdAt)}</div></div>`).join("") || "<p class='mut'>لا توجد طلبات.</p>";
  host.querySelectorAll(".req").forEach(e => e.onclick = () => open(host._rows.find(r => r.id === e.dataset.id)));
}
function open(r) {
  const c = r.c, ro = r.status === "CANCELLED" || r.status === "ACTIVE";
  const cb = toDate(r.callbackAt), cbv = cb ? new Date(cb - cb.getTimezoneOffset()*60000).toISOString().slice(0,16) : "";
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="sheet"><button class="x">✕</button>
   <h3>${esc(r.requestNumber)} <span class="pill s-${r.status}">${STATUS_AR[r.status]}</span></h3>
   <div class="kv"><b>الاسم</b><span>${esc(c.fullName)}</span><b>النشاط</b><span>${esc(c.businessName)} (${esc(c.businessType)})</span>
   <b>الهاتف</b><span>${esc(c.phone)}</span><b>واتساب</b><span>${esc(c.whatsapp||"—")}</span>
   <b>الموقع</b><span>${esc(c.governorate||"—")} / ${esc(c.city||"—")}</span><b>الفروع/المستخدمون</b><span>${c.branchesCount||1} / ${c.expectedUsers||1}</span>
   <b>الباقة</b><span>${PLAN_AR[r.selectedPlan]||""} ${r.billingCycle==="YEARLY"?"(سنوي)":r.billingCycle==="MONTHLY"?"(شهري)":""}</span>
   <b>نظام حالي</b><span>${r.hasExistingSystem?"نعم":"لا"}</span><b>التاريخ</b><span>${fmtDT(r.createdAt)}</span></div>
   <p class="need">${esc(r.description||"لا يوجد وصف")}</p>
   <div class="acts"><a class="btn" href="tel:${esc(c.phone)}">📞 اتصال</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(c.whatsapp||c.phone)}">WhatsApp</a></div>
   <div id="dup"></div>${waBox(c.whatsapp || c.phone, { name: c.fullName, ref: r.requestNumber }, ["welcome"])}
   ${c.logoUrl?`<img class="logo" src="${esc(c.logoUrl)}" alt="logo">`:""}
   ${r.audioUrl?`<p class="mut">التسجيل الصوتي:</p><audio controls src="${esc(r.audioUrl)}" style="width:100%"></audio>`:""}
   <label>ملاحظات Call Center<textarea id="notes" rows="3" ${ro?"disabled":""}>${esc(r.callCenterNotes||"")}</textarea></label>
   <label>موعد إعادة الاتصال<input id="cb" type="datetime-local" value="${cbv}" ${ro?"disabled":""}></label>
   <p class="mut">آخر تواصل: ${fmtDT(r.lastContactAt)} ${r.callCenterEmployeeName?"· بواسطة "+esc(r.callCenterEmployeeName):""}</p>
   ${ro?"":`<div class="acts"><button class="btn g" id="save">حفظ الملاحظات</button><button class="btn" id="ok">تأكيد وتحويل للتنفيذ</button><button class="btn r" id="no">إلغاء الطلب</button></div>`}</div>`;
  document.body.append(m); bindWa(m); dupCheck(m, r);
  const close = () => m.remove(); m.querySelector(".x").onclick = close; m.onclick = e => e.target === m && close();
  if (ro) return;
  const notes = () => ({ callCenterNotes: m.querySelector("#notes").value.trim(),
    callbackAt: m.querySelector("#cb").value ? Timestamp.fromDate(new Date(m.querySelector("#cb").value)) : null,
    callCenterEmployeeId: emp.uid, callCenterEmployeeName: emp.fullName, lastContactAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const run = async (fn, msg) => { try { await fn(); toast(msg); close(); render(host, emp); } catch (e) { console.error(e); toast("حدث خطأ، حاول مرة أخرى"); } };
  m.querySelector("#save").onclick = () => run(async () => {
    await updateDoc(doc(db, COL.requests, r.id), notes());
    await logActivity(emp, "UPDATE_REQUEST", "request", r.id, { callCenterNotes: r.callCenterNotes||"" }, { callCenterNotes: m.querySelector("#notes").value });
    await addTimeline(emp, r.customerId, "CONTACT", `تم التواصل مع العميل بواسطة ${emp.fullName}`);
    if (m.querySelector("#cb").value) await notify("CALLBACK", `موعد إعادة اتصال: ${r.requestNumber}`, "request", r.id);
  }, "تم الحفظ");
  m.querySelector("#ok").onclick = () => confirm("تأكيد الطلب وتحويله للتنفيذ؟") && run(async () => {
    await updateDoc(doc(db, COL.requests, r.id), { ...notes(), status: "EXECUTION" });
    await logActivity(emp, "REQUEST_TO_EXECUTION", "request", r.id, { status: r.status }, { status: "EXECUTION" });
    await addTimeline(emp, r.customerId, "REQUEST_CONFIRMED", "تم تحويل الطلب للتنفيذ");
    await notify("REQUEST_EXECUTION", `تم تحويل ${r.requestNumber} للتنفيذ`, "request", r.id);
  }, "تم التحويل للتنفيذ");
  m.querySelector("#no").onclick = () => confirm("إلغاء الطلب؟") && run(async () => {
    await updateDoc(doc(db, COL.requests, r.id), { ...notes(), status: "CANCELLED" });
    await logActivity(emp, "CANCEL_REQUEST", "request", r.id, { status: r.status }, { status: "CANCELLED" });
    await addTimeline(emp, r.customerId, "REQUEST_CANCELLED", "تم إلغاء الطلب");
  }, "تم إلغاء الطلب");
}

// تنبيه لو الهاتف مسجل لعميل آخر (قراءة 1–5 مستندات فقط عند فتح الطلب)
async function dupCheck(m, r) {
  try { const s = await getDocs(query(collection(db, COL.customers), where("phone", "==", r.c.phone), limit(5)));
    const n = s.docs.filter(d => d.id !== r.customerId).length;
    if (n) m.querySelector("#dup").innerHTML = `<div class="warn">⚠️ يوجد ${n} عميل مسجل بنفس رقم الهاتف — راجع قبل التأكيد</div>`; } catch {}
}
