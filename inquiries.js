// الاستفسارات والشكاوى القادمة من صفحة العميل (order.html) — للكول سنتر والإدارة
import { db, COL } from "../firebase.js";
import { collection, query, where, limit, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { contactBtns, callActs, esc, fmtDT, toast, modal, logActivity } from "../util.js";
const KIND = { INQUIRY: "استفسار", COMPLAINT: "شكوى" }, ST = { NEW: "جديدة", DONE: "تمت المعالجة" };
let tab = "NEW", rows = [], emp, host;
export async function render(el, employee) {
  emp = employee; host = el;
  el.innerHTML = `<h2>الاستفسارات والشكاوى</h2><div class="tabs">${Object.entries(ST).map(([k, v]) => `<button data-s="${k}" class="${k === tab ? "on" : ""}">${v}</button>`).join("")}</div><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  el.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { tab = b.dataset.s; render(el, emp); });
  try { rows = (await getDocs(query(collection(db, COL.inquiries), where("status", "==", tab), limit(100)))).docs.map(d => ({ ...d.data(), id: d.id })); }
  catch (e) { console.error(e); el.querySelector("#list").innerHTML = "<p class='mut'>تعذّر التحميل (تأكد من نشر القواعد).</p>"; return; }
  rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  el.querySelector("#list").innerHTML = rows.map(r => `<div class="req" data-id="${r.id}">${contactBtns(r.phone, r.phone)}
    <div><span class="pill ${r.kind === "COMPLAINT" ? "s-CANCELLED" : "s-NEW"}">${KIND[r.kind] || ""}</span> ${r.requestNumber ? `<b>${esc(r.requestNumber)}</b>` : ""}</div>
    <div>${esc(r.fullName)} · ${esc(r.phone)}</div><div class="mut">${esc((r.message || "").slice(0, 90))} · ${fmtDT(r.createdAt)}</div></div>`).join("") || `<p class="mut">لا توجد عناصر.</p>`;
  el.querySelectorAll(".req").forEach(e => e.onclick = () => open(rows.find(r => r.id === e.dataset.id)));
}
function open(r) {
  const { m, close } = modal(`<h3>${KIND[r.kind] || ""} ${r.requestNumber ? "— " + esc(r.requestNumber) : ""} <span class="pill">${ST[r.status]}</span></h3>
    ${callActs(r.phone, r.phone)}
    <div class="kv"><b>الاسم</b><span>${esc(r.fullName)}</span><b>الهاتف</b><span>${esc(r.phone)}</span><b>رقم الطلب</b><span>${esc(r.requestNumber || "—")}</span><b>التاريخ</b><span>${fmtDT(r.createdAt)}</span></div>
    <p class="need">${esc(r.message)}</p>
    <label>ملاحظة المعالجة (داخلية)<textarea id="nt" rows="3">${esc(r.handleNote || "")}</textarea></label>
    <div class="acts">${r.status === "NEW" ? `<button class="btn" id="done">✅ تمت المعالجة</button>` : `<button class="btn g" id="reopen">إعادة فتح</button>`}<button class="btn g" id="save">💾 حفظ الملاحظة</button></div>`);
  const upd = async (extra, msg) => { try { await updateDoc(doc(db, COL.inquiries, r.id), { handleNote: m.querySelector("#nt").value.trim(), handledBy: emp.fullName, handledAt: serverTimestamp(), ...extra });
    await logActivity(emp, "INQUIRY_UPDATE", "inquiry", r.id, { status: r.status }, extra); toast(msg); close(); render(host, emp); } catch (e) { console.error(e); toast("حدث خطأ"); } };
  m.querySelector("#save").onclick = () => upd({}, "تم الحفظ");
  const d = m.querySelector("#done"), o = m.querySelector("#reopen");
  if (d) d.onclick = () => upd({ status: "DONE" }, "تمت المعالجة"); if (o) o.onclick = () => upd({ status: "NEW" }, "أُعيد فتحها");
}
