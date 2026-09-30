import { db, COL } from "../firebase.js";
import { collection, getDocs, getDoc, doc, updateDoc, query, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { mountSysFiles } from "./sysfiles.js";
import { getCustomer, contactBtns, mkFilters, SYSTEM_TYPES, esc, fmtDate, PLAN_AR, PROJECT_AR, USAGE_AR, modal, timelineHtml, toast, logActivity, addTimeline } from "../util.js";
let emp;
export async function render(el, employee) {
  emp = employee;
  el.innerHTML = `<h2>المشاريع</h2><input id="q" class="search" placeholder="بحث برقم المشروع أو النشاط أو الدومين"><div id="fl"></div><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  const ps = (await getDocs(query(collection(db, COL.projects), limit(200)))).docs.map(d => ({ ...d.data(), id: d.id }));
  const cs = {}; await Promise.all([...new Set(ps.map(p => p.customerId))].map(async id => { try { cs[id] = await getCustomer(id); } catch { cs[id] = {}; } }));
  ps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const draw = () => { const t = el.querySelector("#q").value.trim().toLowerCase();
    const V = F.vals(), f = ps.filter(p => (!V.plan || p.plan === V.plan) && (!V.status || p.status === V.status) && (!V.sys || p.systemType === V.sys) && (!V.use || p.usageType === V.use) && (!V.emp || p.assignedExecutionEmployeeName === V.emp) && F.inRange(p.createdAt) && (!t || [p.projectNumber, p.businessName, p.domainName, cs[p.customerId]?.fullName, cs[p.customerId]?.phone].join(" ").toLowerCase().includes(t)));
    el.querySelector("#list").innerHTML = f.map(p => `<div class="req" data-id="${p.id}">${contactBtns(cs[p.customerId]?.phone, cs[p.customerId]?.whatsapp)}<div><b>${esc(p.projectNumber)}</b> <span class="pill s-${p.status}">${PROJECT_AR[p.status]}</span> <span class="pill">${USAGE_AR[p.usageType]}</span></div>
      <div>${esc(cs[p.customerId]?.fullName || "")} — ${esc(p.businessName)}</div>
      <div class="mut">${esc(p.systemType)} · ${PLAN_AR[p.plan] || ""} · ${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}</div>
      <div class="mut" dir="ltr">${esc(p.systemUrl)}</div></div>`).join("") || "<p class='mut'>لا توجد مشاريع.</p>";
    el.querySelectorAll(".req").forEach(e => e.onclick = () => open(ps.find(p => p.id === e.dataset.id), cs[ps.find(p => p.id === e.dataset.id).customerId] || {})); };
  { const pq = sessionStorage.getItem("q"); if (pq) { el.querySelector("#q").value = pq; sessionStorage.removeItem("q"); } }
  const F = mkFilters(el.querySelector("#fl"), [{ id: "plan", label: "الباقة", options: Object.entries(PLAN_AR) }, { id: "status", label: "الحالة", options: Object.entries(PROJECT_AR) },
    { id: "sys", label: "نوع النظام", options: SYSTEM_TYPES.map(t => [t, t]) }, { id: "use", label: "نوع الاستخدام", options: Object.entries(USAGE_AR) },
    { id: "emp", label: "موظف التنفيذ", options: [...new Set(ps.map(p => p.assignedExecutionEmployeeName).filter(Boolean))].map(n => [n, n]) }], () => draw());
  el.querySelector("#q").oninput = draw; draw();
}
async function open(p, c) {
  const canEdit = ["admin", "execution"].includes(emp.role);
  const { m } = modal(`<h3>${esc(p.projectNumber)} — ${esc(p.businessName)}</h3>
   <div class="tabs"><button data-t="a" class="on">البيانات</button><button data-t="b">النظام</button><button data-t="c">الحسابات</button><button data-t="d">الملفات</button><button data-t="e">سجل النشاط</button></div>
   <div id="a"><div class="kv"><b>العميل</b><span>${esc(c.fullName)}</span><b>الهاتف</b><span>${esc(c.phone)}</span><b>النشاط</b><span>${esc(c.businessName)} (${esc(c.businessType)})</span><b>الموقع</b><span>${esc(c.governorate || "—")} / ${esc(c.city || "—")}</span></div></div>
   <div id="b" class="hide"><label>نوع النظام<input id="st" value="${esc(p.systemType)}" disabled></label>
    <div class="two"><label>Template<input id="tn" value="${esc(p.templateName)}" ${canEdit ? "" : "disabled"}></label><label>Version<input id="tv" value="${esc(p.templateVersion)}" ${canEdit ? "" : "disabled"}></label></div>
    <label>System URL<input id="su" dir="ltr" value="${esc(p.systemUrl)}" ${canEdit ? "" : "disabled"}></label><label>Domain<input id="dm" dir="ltr" value="${esc(p.domainName || "")}" ${canEdit ? "" : "disabled"}></label>
    <p class="mut">تاريخ التشغيل: ${fmtDate(p.startDate)} · الباقة: ${PLAN_AR[p.plan] || ""} · ${USAGE_AR[p.usageType]}</p>
    ${canEdit ? `<button class="btn" id="sv">حفظ بيانات النظام</button>` : ""}<div id="sf"></div></div>
   <div id="c" class="hide"><div class="ph">الفواتير والمدفوعات والمتبقي — تُضاف في Phase 5</div></div>
   <div id="d" class="hide imgs"></div><div id="e" class="hide"><span class="mut">...</span></div>`);
  const $ = s => m.querySelector(s); let mounted = false;
  m.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { m.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b)); ["a","b","c","d","e"].forEach(t => $("#" + t).classList.toggle("hide", t !== b.dataset.t)); if (b.dataset.t === "b" && !mounted) { mounted = true; mountSysFiles($("#sf"), p.requestId, emp, canEdit); } });
  const files = []; if (c.logoUrl) files.push(`<p class="mut">اللوجو</p><img src="${esc(c.logoUrl)}" alt="">`);
  try { const r = (await getDoc(doc(db, COL.requests, p.requestId))).data(); if (r?.audioUrl) files.push(`<p class="mut">التسجيل الصوتي</p><audio controls src="${esc(r.audioUrl)}" style="width:100%"></audio>`); } catch {}
  $("#d").innerHTML = files.join("") || "<p class='mut'>لا توجد ملفات.</p>";
  try { $("#e").innerHTML = await timelineHtml(p.customerId); } catch { $("#e").textContent = "تعذّر التحميل."; }
  if (canEdit) $("#sv").onclick = async () => {
    const n = { templateName: $("#tn").value.trim(), templateVersion: $("#tv").value.trim(), systemUrl: $("#su").value.trim(), domainName: $("#dm").value.trim() };
    try { await updateDoc(doc(db, COL.projects, p.id), { ...n, hasCustomDomain: !!n.domainName, updatedAt: serverTimestamp() });
      await logActivity(emp, "UPDATE_SYSTEM_URL", "project", p.id, { systemUrl: p.systemUrl, templateName: p.templateName, domainName: p.domainName || "" }, n);
      if (n.systemUrl !== p.systemUrl) await addTimeline(emp, p.customerId, "SYSTEM_URL_UPDATED", "تم تعديل رابط النظام", p.id);
      Object.assign(p, n); toast("تم الحفظ"); } catch (e) { console.error(e); toast("حدث خطأ"); }
  };
}
