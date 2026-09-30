import { db, COL } from "../firebase.js";
import { collection, query, where, limit, getDocs, getDoc, doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCustomer, contactBtns, callActs, mkFilters, BUSINESS_TYPES, esc, STATUS_AR, PLAN_AR, fmtDate, fmtDT, toDate, toast, logActivity, notify, addTimeline, bust, CONTACT_TYPE, OUTCOME, OUTCOME_CB, cbToDate, cbParts, syncPublic, pubIdOf, msgConfirmed, waPrompt } from "../util.js";
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
     <div><b>${esc(r.requestNumber)}</b> <span class="pill s-${r.status}">${STATUS_AR[r.status]}</span>${r.lastOutcome ? ` <span class="pill">${OUTCOME[r.lastOutcome] || ""}</span>` : ""}</div>
     <div>${esc(r.c.fullName)} — ${esc(r.c.businessName)}</div>
     <div class="mut">${esc(r.c.phone)} · ${PLAN_AR[r.selectedPlan]||""} · ${esc(r.c.businessType)} · ${fmtDate(r.createdAt)}</div></div>`).join("") || "<p class='mut'>لا توجد طلبات.</p>";
  host.querySelectorAll(".req").forEach(e => e.onclick = () => open(host._rows.find(r => r.id === e.dataset.id)));
}
function open(r) {
  const c = r.c, ro = r.status === "CANCELLED" || r.status === "ACTIVE";
  const cbp = cbParts(r.callbackAt), log = [...(r.contactLog || [])].sort((a, b) => b.at - a.at);
  const typeOpts = [...new Set([...BUSINESS_TYPES, c.businessType].filter(Boolean))];
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="sheet"><button class="x">✕</button>
   <h3>${esc(r.requestNumber)} <span class="pill s-${r.status}">${STATUS_AR[r.status]}</span></h3>
   ${callActs(c.phone, c.whatsapp)}
   <div id="dup"></div>
   <div id="view">
     <div class="kv"><b>الاسم</b><span>${esc(c.fullName)}</span><b>النشاط</b><span>${esc(c.businessName)} (${esc(c.businessType)})</span>
     <b>الهاتف</b><span>${esc(c.phone)}</span><b>واتساب</b><span>${esc(c.whatsapp || "—")}</span>
     <b>الموقع</b><span>${esc(c.governorate || "—")} / ${esc(c.city || "—")}</span><b>الفروع/المستخدمون</b><span>${c.branchesCount || 1} / ${c.expectedUsers || 1}</span>
     <b>الباقة</b><span>${PLAN_AR[r.selectedPlan] || ""} ${r.billingCycle === "YEARLY" ? "(سنوي)" : r.billingCycle === "MONTHLY" ? "(شهري)" : ""}</span>
     <b>نظام حالي</b><span>${r.hasExistingSystem ? "نعم" : "لا"}</span><b>التاريخ</b><span>${fmtDT(r.createdAt)}</span></div>
     <p class="need">${esc(r.description || "لا يوجد وصف")}</p>
     ${ro ? "" : `<button class="btn g" id="editBtn" style="width:100%">✏️ تعديل بيانات العميل والطلب</button>`}
   </div>
   <div id="edit" class="cbox hide">
     <div class="two"><label>الاسم<input id="e_fn" value="${esc(c.fullName)}"></label><label>الهاتف<input id="e_ph" type="tel" inputmode="tel" value="${esc(c.phone)}"></label></div>
     <div class="two"><label>واتساب<input id="e_wa" type="tel" inputmode="tel" value="${esc(c.whatsapp || "")}"></label><label>اسم النشاط<input id="e_bn" value="${esc(c.businessName)}"></label></div>
     <div class="two"><label>نوع النشاط<select id="e_bt">${typeOpts.map(t => `<option ${t === c.businessType ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
       <label>الباقة<select id="e_pl">${Object.entries(PLAN_AR).map(([k, v]) => `<option value="${k}" ${k === r.selectedPlan ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
     <div class="two"><label>المدة<select id="e_cy"><option value="MONTHLY" ${r.billingCycle !== "YEARLY" ? "selected" : ""}>شهري</option><option value="YEARLY" ${r.billingCycle === "YEARLY" ? "selected" : ""}>سنوي</option></select></label>
       <label>نظام حالي<select id="e_hs"><option value="no">لا</option><option value="yes" ${r.hasExistingSystem ? "selected" : ""}>نعم</option></select></label></div>
     <div class="two"><label>المحافظة<input id="e_gv" value="${esc(c.governorate || "")}"></label><label>المدينة<input id="e_ct" value="${esc(c.city || "")}"></label></div>
     <div class="two"><label>عدد الفروع<input id="e_br" type="number" min="1" value="${c.branchesCount || 1}"></label><label>عدد المستخدمين<input id="e_us" type="number" min="1" value="${c.expectedUsers || 1}"></label></div>
     <label>وصف الاحتياج<textarea id="e_ds" rows="3">${esc(r.description || "")}</textarea></label>
     <div class="acts"><button class="btn" id="e_save">حفظ التعديلات</button><button class="btn g" id="e_cancel">إلغاء</button></div>
   </div>
   ${c.logoUrl ? `<img class="logo" src="${esc(c.logoUrl)}" alt="logo">` : ""}
   ${r.audioUrl ? `<p class="mut">التسجيل الصوتي:</p><audio controls src="${esc(r.audioUrl)}" style="width:100%"></audio>` : ""}

   ${ro ? "" : `<div class="cbox"><h4>📞 تسجيل تواصل مع العميل</h4>
     <div class="two"><label>نوع التواصل<select id="ct">${Object.entries(CONTACT_TYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
       <label>النتيجة<select id="co"><option value="">— اختر —</option>${Object.entries(OUTCOME).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
     <div id="cbBox" class="hide"><p class="mut" style="margin:0 0 6px">موعد إعادة الاتصال</p>
       <div class="three"><label>اليوم<input id="cbd" type="date" value="${cbp.date}"></label>
       <label>الساعة<select id="cbh">${[...Array(12)].map((_, i) => `<option ${i + 1 === cbp.hour ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
       <label>&nbsp;<select id="cba"><option value="AM" ${cbp.ap === "AM" ? "selected" : ""}>صباحًا</option><option value="PM" ${cbp.ap === "PM" ? "selected" : ""}>مساءً</option></select></label></div></div>
     <label>ملاحظات العميل (بعد مراجعة البيانات معه)<textarea id="notes" rows="3">${esc(r.callCenterNotes || "")}</textarea></label>
     <label>ملاحظة تظهر للعميل عند الاستعلام عن طلبه<textarea id="cn" rows="2" placeholder="مثال: برجاء تجهيز صورة اللوجو">${esc(r.clientNote || "")}</textarea></label>
   </div>`}
   ${ro ? `<p class="need">ملاحظات العميل: ${esc(r.callCenterNotes || "—")}</p>` : ""}
   <div class="cbox"><h4>سجل التواصل</h4>${log.map(e => `<div class="tl"><small>${fmtDT(e.at)} · ${esc(e.by || "")}</small><div>${CONTACT_TYPE[e.type] || ""} — <b>${OUTCOME[e.outcome] || ""}</b>${e.cb ? ` · موعد: ${fmtDT(e.cb)}` : ""}${e.note ? `<div class="mut">${esc(e.note)}</div>` : ""}</div></div>`).join("") || "<p class='mut'>لا يوجد تواصل مسجّل بعد.</p>"}</div>
   ${ro ? "" : `<div class="acts"><button class="btn g" id="save">💾 حفظ</button>${r.status === "NEW" ? `<button class="btn" id="ok">تأكيد وتحويل للتنفيذ</button>` : ""}<button class="btn r" id="no">إلغاء الطلب</button></div>`}</div>`;
  document.body.append(m); dupCheck(m, r);
  const $ = s => m.querySelector(s), close = () => m.remove(); $(".x").onclick = close; m.onclick = e => e.target === m && close();
  if (ro) return;
  const ui = msg => Object.assign(new Error(msg), { ui: true });
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); } catch (e) { console.error(e); toast(e.ui ? e.message : "حدث خطأ، حاول مرة أخرى"); return false; } return true; };
  const refresh = () => { close(); open(r); draw(); };

  // تعديل البيانات
  $("#editBtn").onclick = () => { $("#view").classList.add("hide"); $("#edit").classList.remove("hide"); };
  $("#e_cancel").onclick = () => { $("#edit").classList.add("hide"); $("#view").classList.remove("hide"); };
  $("#e_save").onclick = () => run(async () => {
    const cu = { fullName: $("#e_fn").value.trim(), phone: $("#e_ph").value.trim(), whatsapp: $("#e_wa").value.trim(), businessName: $("#e_bn").value.trim(), businessType: $("#e_bt").value,
      governorate: $("#e_gv").value.trim(), city: $("#e_ct").value.trim(), branchesCount: Number($("#e_br").value) || 1, expectedUsers: Number($("#e_us").value) || 1 };
    if (!cu.fullName || !cu.phone || !cu.businessName) throw ui("الاسم والهاتف واسم النشاط مطلوبة");
    const pl = $("#e_pl").value, ru = { selectedPlan: pl, billingCycle: pl === "TRIAL" ? "TRIAL" : $("#e_cy").value, hasExistingSystem: $("#e_hs").value === "yes", description: $("#e_ds").value.trim() };
    const r2 = { ...r, ...ru }, c2 = { ...c, ...cu }; ru.publicId = pubIdOf(r.requestNumber, c2.phone);
    await updateDoc(doc(db, COL.customers, r.customerId), { ...cu, updatedAt: serverTimestamp() });
    await updateDoc(doc(db, COL.requests, r.id), { ...ru, updatedAt: serverTimestamp() });
    try { await syncPublic(r2, c2); } catch (e) { console.warn(e); }
    await logActivity(emp, "EDIT_REQUEST_DATA", "request", r.id, { customer: c, plan: r.selectedPlan }, { customer: cu, plan: pl });
    await addTimeline(emp, r.customerId, "DATA_EDITED", `تم تعديل بيانات العميل/الطلب بواسطة ${emp.fullName}`);
    bust("cust:" + r.customerId); Object.assign(r, ru); r.c = c2; refresh();
  }, "تم حفظ التعديلات");

  // موعد إعادة الاتصال يظهر حسب النتيجة
  const syncCb = () => $("#cbBox").classList.toggle("hide", !OUTCOME_CB.includes($("#co").value)); $("#co").onchange = syncCb; syncCb();

  // يبني تحديث الطلب من النموذج (ويضيف سجل تواصل إذا اختير نتيجة)
  const build = () => {
    const out = $("#co").value, type = $("#ct").value, note = $("#notes").value.trim(), showCb = OUTCOME_CB.includes(out);
    const cbDate = showCb ? cbToDate($("#cbd").value, $("#cbh").value, $("#cba").value) : null;
    if (out === "POSTPONED" && !cbDate) throw ui("حدد يوم وساعة إعادة الاتصال");
    const o = { callCenterNotes: note, clientNote: $("#cn").value.trim(), callCenterEmployeeId: emp.uid, callCenterEmployeeName: emp.fullName, updatedAt: serverTimestamp() }, local = { callCenterNotes: note, clientNote: o.clientNote };
    if (cbDate) { o.callbackAt = Timestamp.fromDate(cbDate); local.callbackAt = o.callbackAt; }
    if (out) { const entry = { type, outcome: out, note, by: emp.fullName, at: Date.now(), cb: cbDate ? cbDate.getTime() : null };
      o.contactLog = arrayUnion(entry); o.lastOutcome = out; o.lastContactType = type; o.lastContactAt = serverTimestamp();
      local.contactLog = [...(r.contactLog || []), entry]; local.lastOutcome = out; local.lastContactType = type; local.lastContactAt = new Date(); }
    return { o, local, out, type };
  };
  const persist = async (extra = {}, extraLocal = {}) => {
    const { o, local, out, type } = build(), r2 = { ...r, ...local, ...extraLocal };
    o.publicId = pubIdOf(r.requestNumber, c.phone);
    await updateDoc(doc(db, COL.requests, r.id), { ...o, ...extra });
    let synced = true; try { await syncPublic(r2, c); } catch (e) { synced = false; console.warn(e); }
    if (out) await addTimeline(emp, r.customerId, "CONTACT", `${CONTACT_TYPE[type]} — ${OUTCOME[out]} (${emp.fullName})`);
    if (o.callbackAt) await notify("CALLBACK", `موعد إعادة اتصال: ${r.requestNumber}`, "request", r.id);
    Object.assign(r, local, extraLocal, { publicId: o.publicId }); if (!synced) toast("تم الحفظ، لكن تعذّر تحديث صفحة استعلام العميل");
  };

  $("#save").onclick = async () => { if (await run(async () => {
    const before = r.callCenterNotes || ""; await persist();
    await logActivity(emp, "UPDATE_REQUEST", "request", r.id, { callCenterNotes: before }, { callCenterNotes: r.callCenterNotes });
  }, "تم الحفظ")) refresh(); };

  const ok = $("#ok"); if (ok) ok.onclick = async () => {
    if (!confirm("تأكيد الطلب وتحويله للتنفيذ؟")) return;
    if (await run(async () => {
      await persist({ status: "EXECUTION" }, { status: "EXECUTION" });
      await logActivity(emp, "REQUEST_TO_EXECUTION", "request", r.id, { status: "NEW" }, { status: "EXECUTION" });
      await addTimeline(emp, r.customerId, "REQUEST_CONFIRMED", "تم تحويل الطلب للتنفيذ");
      await notify("REQUEST_EXECUTION", `تم تحويل ${r.requestNumber} للتنفيذ`, "request", r.id);
    }, "تم التحويل للتنفيذ")) {
      close(); render(host, emp);
      waPrompt("✅ تم التحويل للتنفيذ — أرسل تأكيد للعميل", c.whatsapp || c.phone, msgConfirmed(c.fullName, r.requestNumber));
    }
  };
  $("#no").onclick = async () => {
    if (!confirm("إلغاء الطلب؟")) return;
    if (await run(async () => {
      await persist({ status: "CANCELLED" }, { status: "CANCELLED" });
      await logActivity(emp, "CANCEL_REQUEST", "request", r.id, { status: "NEW" }, { status: "CANCELLED" });
      await addTimeline(emp, r.customerId, "REQUEST_CANCELLED", "تم إلغاء الطلب");
    }, "تم إلغاء الطلب")) { close(); render(host, emp); }
  };
}

// تنبيه لو الهاتف مسجل لعميل آخر (قراءة 1–5 مستندات فقط عند فتح الطلب)
async function dupCheck(m, r) {
  try { const s = await getDocs(query(collection(db, COL.customers), where("phone", "==", r.c.phone), limit(5)));
    const n = s.docs.filter(d => d.id !== r.customerId).length;
    if (n) m.querySelector("#dup").innerHTML = `<div class="warn">⚠️ يوجد ${n} عميل مسجل بنفس رقم الهاتف — راجع قبل التأكيد</div>`; } catch {}
}
