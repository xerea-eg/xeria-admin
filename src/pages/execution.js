import { db, COL } from "../firebase.js";
import { collection, query, where, limit, getDocs, getDoc, doc, updateDoc, runTransaction, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { mountSysFiles } from "./sysfiles.js";
import { getCustomer, memo, contactBtns, esc, PLAN_AR, fmtDate, waLink, toast, logActivity, notify, addTimeline, SYSTEM_TYPES, modal, addDays, addMonths, inputDate } from "../util.js";
let emp, host;
export async function render(el, employee) {
  emp = employee; host = el;
  el.innerHTML = `<h2>التنفيذ</h2><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  const snap = await getDocs(query(collection(db, COL.requests), where("status", "==", "EXECUTION"), limit(200)));
  const rows = await Promise.all(snap.docs.map(async d => ({ ...d.data(), id: d.id, c: await getCustomer(d.data().customerId) })));
  rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  el.querySelector("#list").innerHTML = rows.map(r => `<div class="req" data-id="${r.id}">${contactBtns(r.c.phone, r.c.whatsapp)}<div><b>${esc(r.requestNumber)}</b> · ${PLAN_AR[r.selectedPlan] || ""}</div>
    <div>${esc(r.c.fullName)} — ${esc(r.c.businessName)}</div><div class="mut">${esc(r.c.phone)} · ${fmtDate(r.createdAt)}</div></div>`).join("") || "<p class='mut'>لا توجد طلبات قيد التنفيذ.</p>";
  el.querySelectorAll(".req").forEach(e => e.onclick = () => open(rows.find(r => r.id === e.dataset.id)));
}
async function open(r) {
  const c = r.c, x = r.execution || {};
  const staff = await memo("staff", async () => { try { const s = await getDoc(doc(db, COL.settings, "staff")); return s.exists() ? s.data().list || [] : []; } catch { return []; } }, 600000);
  const list = staff.some(s => s.uid === emp.uid) ? staff : [...staff, { uid: emp.uid, name: emp.fullName }], cur = x.assignedId || emp.uid;
  const { m, close } = modal(`<h3>${esc(r.requestNumber)} — ${esc(c.businessName)}</h3>
   <div class="kv"><b>العميل</b><span>${esc(c.fullName)}</span><b>الهاتف</b><span>${esc(c.phone)}</span><b>الباقة</b><span>${PLAN_AR[r.selectedPlan] || ""}</span></div>
   <p class="need">${esc(r.description || "لا يوجد وصف")}</p>
   <p class="need">ملاحظات Call Center: ${esc(r.callCenterNotes || "—")}</p>
   <div class="acts"><a class="btn" href="tel:${esc(c.phone)}">📞 اتصال</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(c.whatsapp || c.phone)}">WhatsApp</a></div>
   <div class="imgs">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : ""}</div>
   ${r.audioUrl ? `<audio controls src="${esc(r.audioUrl)}" style="width:100%"></audio>` : ""}
   <div class="two"><label>نوع النظام<select id="st">${SYSTEM_TYPES.map(t => `<option ${x.systemType === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
   <label>اسم Template<input id="tn" value="${esc(x.templateName || "")}" placeholder="Retail-V1"></label></div>
   <div class="two"><label>Version<input id="tv" value="${esc(x.templateVersion || "V1")}"></label>
   <label>تاريخ بداية الاستخدام<input id="sd" type="date" value="${x.startDate || inputDate(new Date())}"></label></div>
   <label>رابط النظام (System URL)<input id="su" type="url" dir="ltr" value="${esc(x.systemUrl || "")}"></label>
   <label>الدومين (إن وجد)<input id="dm" dir="ltr" value="${esc(x.domainName || "")}"></label>
   <div id="sf"></div>
   <label>ملاحظات التنفيذ<textarea id="nt" rows="3">${esc(x.notes || "")}</textarea></label>
   <label>موظف التنفيذ المسؤول<select id="as">${list.map(s => `<option value="${esc(s.uid)}" ${s.uid === cur ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
   <div class="acts"><button class="btn g" id="save">حفظ</button><button class="btn" id="done">تم التنفيذ وتحويله إلى مشروع</button></div>`);
  const $ = s => m.querySelector(s);
  mountSysFiles($("#sf"), r.id, emp, true);
  const data = () => ({ systemType: $("#st").value, templateName: $("#tn").value.trim(), templateVersion: $("#tv").value.trim(), startDate: $("#sd").value,
    systemUrl: $("#su").value.trim(), domainName: $("#dm").value.trim(), notes: $("#nt").value.trim(),
    assignedId: $("#as").value, assignedName: list.find(s => s.uid === $("#as").value)?.name || emp.fullName });
  $("#save").onclick = async () => {
    try { await updateDoc(doc(db, COL.requests, r.id), { execution: data(), updatedAt: serverTimestamp() });
      await logActivity(emp, "UPDATE_EXECUTION", "request", r.id, x, data()); toast("تم الحفظ"); } catch (e) { console.error(e); toast("حدث خطأ"); }
  };
  $("#done").onclick = async () => {
    const d = data();
    if (!d.templateName || !d.systemUrl || !d.startDate) return toast("أكمل Template ورابط النظام وتاريخ البداية");
    if (!confirm("إنشاء المشروع وتحويل الطلب إلى مشروع نشط؟")) return;
    try {
      const trial = r.selectedPlan === "TRIAL", start = new Date(d.startDate);
      let days = 14; try { const g = await getDoc(doc(db, COL.settings, "general")); if (g.exists() && g.data().trialDays) days = g.data().trialDays; } catch {}
      const end = trial ? addDays(start, days) : r.billingCycle === "YEARLY" ? addMonths(start, 12) : addMonths(start, 1);
      const pRef = doc(collection(db, COL.projects)), cnt = doc(db, COL.settings, "counters");
      const num = await runTransaction(db, async tx => {
        const c0 = await tx.get(cnt), seq = (c0.data()?.projectSeq || 0) + 1, n = "PRJ-" + String(seq).padStart(6, "0");
        tx.set(cnt, { projectSeq: seq }, { merge: true });
        tx.set(pRef, { projectId: pRef.id, projectNumber: n, customerId: r.customerId, requestId: r.id, businessName: r.c.businessName,
          systemType: d.systemType, templateName: d.templateName, templateVersion: d.templateVersion, plan: r.selectedPlan, billingCycle: r.billingCycle || "",
          usageType: trial ? "TRIAL" : "PAID", systemUrl: d.systemUrl, hasCustomDomain: !!d.domainName, domainName: d.domainName,
          assignedExecutionEmployeeId: d.assignedId, assignedExecutionEmployeeName: d.assignedName, executionNotes: d.notes,
          startDate: Timestamp.fromDate(start), endDate: Timestamp.fromDate(end), status: "ACTIVE", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        tx.update(doc(db, COL.requests, r.id), { status: "ACTIVE", projectId: pRef.id, execution: d, updatedAt: serverTimestamp() });
        return n;
      });
      await logActivity(emp, "CREATE_PROJECT", "project", pRef.id, null, { projectNumber: num, requestId: r.id });
      await addTimeline(emp, r.customerId, "PROJECT_CREATED", `تم إنشاء المشروع ${num} وإضافة رابط النظام`, pRef.id);
      await notify("PROJECT_CREATED", `تم إنشاء المشروع ${num} — ${r.c.businessName}`, "project", pRef.id);
      toast("تم إنشاء المشروع " + num); close(); render(host, emp);
    } catch (e) { console.error(e); toast("حدث خطأ أثناء إنشاء المشروع"); }
  };
}
