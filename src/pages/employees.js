import { db, COL } from "../firebase.js";
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createEmployee, setEmployeeActive, setEmployeeRole } from "../auth.js";
import { ROLES, ROLE_AR } from "../roles.js";
import { esc, toast, logActivity } from "../util.js";
const opts = sel => Object.keys(ROLES).map(r => `<option value="${r}" ${r === sel ? "selected" : ""}>${ROLE_AR[r]}</option>`).join("");
export async function render(el, emp) {
  const list = (await getDocs(collection(db, COL.employees))).docs.map(d => d.data());
  // قائمة موظفي التنفيذ (لاختيار المسؤول) — تُكتب فقط عند تغيّرها
  const staff = list.filter(e => e.isActive && ["execution", "admin"].includes(e.role)).map(e => ({ uid: e.uid, name: e.fullName })), sig = JSON.stringify(staff);
  if (sig !== window._staffSig) { window._staffSig = sig; setDoc(doc(db, COL.settings, "staff"), { list: staff }).catch(() => {}); }
  el.innerHTML = `<h2>الموظفون</h2><div class="list">${list.map(e => `<div class="row-item"><b>${esc(e.fullName)}</b><span class="mut">${esc(e.email)}</span>
   <select data-r="${e.uid}" style="width:auto" ${e.uid === emp.uid ? "disabled" : ""}>${opts(e.role)}</select>
   <button class="btn ${e.isActive ? "r" : "g"}" data-a="${e.uid}" style="width:auto;padding:6px 12px" ${e.uid === emp.uid ? "disabled" : ""}>${e.isActive ? "تعطيل" : "تفعيل"}</button></div>`).join("")}</div>
   <h4>إضافة موظف</h4><div class="two"><label>الاسم<input id="n"></label><label>الهاتف<input id="p"></label><label>البريد<input id="e" type="email" dir="ltr"></label><label>كلمة مرور (6+)<input id="w" type="password" dir="ltr"></label></div>
   <label>الدور<select id="r">${opts("callcenter")}</select></label><button class="btn" id="add" style="margin-top:10px">إضافة</button>`;
  const $ = s => el.querySelector(s), go = fn => async ev => { try { await fn(ev); render(el, emp); } catch (e) { console.error(e); toast("حدث خطأ: " + (e.code || "")); } };
  el.querySelectorAll("[data-r]").forEach(s => s.onchange = go(async () => { await setEmployeeRole(s.dataset.r, s.value); await logActivity(emp, "CHANGE_ROLE", "employee", s.dataset.r, null, { role: s.value }); toast("تم تغيير الدور"); }));
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = go(async () => { const e = list.find(x => x.uid === b.dataset.a); await setEmployeeActive(e.uid, !e.isActive); await logActivity(emp, "TOGGLE_EMPLOYEE", "employee", e.uid, { isActive: e.isActive }, { isActive: !e.isActive }); }));
  $("#add").onclick = go(async () => { if (!$("#n").value || !$("#e").value || $("#w").value.length < 6) return toast("أكمل البيانات");
    const uid = await createEmployee({ email: $("#e").value.trim(), password: $("#w").value, fullName: $("#n").value.trim(), phone: $("#p").value.trim(), role: $("#r").value });
    await logActivity(emp, "CREATE_EMPLOYEE", "employee", uid, null, { role: $("#r").value }); toast("تمت الإضافة"); });
}
