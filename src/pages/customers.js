import { SUB_AR, subStatus, METHOD_AR, money } from "../finance.js";
import { db, COL } from "../firebase.js";
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { findPortal, createPortal, buildPortal, revokePortal } from "../portal.js";
import { logActivity, toast, appBase, waBox, bindWa, exportXls, PLAN_AR, contactBtns, esc, fmtDate, waLink, modal, timelineHtml, PROJECT_AR, USAGE_AR } from "../util.js";
export async function render(el, emp) {
  el.innerHTML = `<h2>العملاء <button class="btn g" id="xl" style="width:auto;padding:4px 12px">📊 Excel</button></h2><input id="q" class="search" placeholder="بحث بالاسم أو الهاتف أو النشاط"><div id="list" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  const rows = (await getDocs(query(collection(db, COL.customers), limit(200)))).docs.map(d => ({ ...d.data(), id: d.id }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  el.querySelector("#xl").onclick = () => exportXls("customers", ["الاسم", "الهاتف", "واتساب", "النشاط", "نوع النشاط", "المحافظة", "المدينة", "التاريخ"], rows.map(c => [c.fullName, c.phone, c.whatsapp || "", c.businessName, c.businessType, c.governorate || "", c.city || "", fmtDate(c.createdAt)]));
  const draw = () => { const t = el.querySelector("#q").value.trim().toLowerCase();
    const f = rows.filter(c => !t || [c.fullName, c.phone, c.businessName].join(" ").toLowerCase().includes(t));
    el.querySelector("#list").innerHTML = f.map(c => `<div class="req" data-id="${c.id}">${contactBtns(c.phone, c.whatsapp)}<b>${esc(c.fullName)}</b><div>${esc(c.businessName)} · ${esc(c.businessType)}</div><div class="mut">${esc(c.phone)} · ${esc(c.governorate || "")} · ${fmtDate(c.createdAt)}</div></div>`).join("") || "<p class='mut'>لا يوجد عملاء.</p>";
    el.querySelectorAll(".req").forEach(e => e.onclick = () => open(rows.find(c => c.id === e.dataset.id), emp)); };
  { const pq = sessionStorage.getItem("q"); if (pq) { el.querySelector("#q").value = pq; sessionStorage.removeItem("q"); } }
  el.querySelector("#q").oninput = draw; draw();
}
async function open(c, emp) {
  const { m } = modal(`<h3>${esc(c.fullName)}</h3>${c.logoUrl ? `<img class="logo" src="${esc(c.logoUrl)}" alt="">` : ""}
   <div class="kv"><b>النشاط</b><span>${esc(c.businessName)} (${esc(c.businessType)})</span><b>الهاتف</b><span>${esc(c.phone)}</span><b>واتساب</b><span>${esc(c.whatsapp || "—")}</span>
   <b>الموقع</b><span>${esc(c.governorate || "—")} / ${esc(c.city || "—")}</span><b>تاريخ التسجيل</b><span>${fmtDate(c.createdAt)}</span></div>
   <div class="acts"><a class="btn" href="tel:${esc(c.phone)}">📞 اتصال</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(c.whatsapp || c.phone)}">WhatsApp</a></div>
   <div id="pt"></div><h4>المشاريع</h4><div id="pj" class="mut">...</div><h4>الاشتراكات</h4><div id="sb" class="mut">...</div><h4>المدفوعات</h4><div id="py" class="mut">...</div><h4>Timeline</h4><div id="tl" class="mut">...</div>`);
  if (["admin", "manager", "accounts"].includes(emp?.role)) portalSection(m, c, emp);
  try { const p = await getDocs(query(collection(db, COL.projects), where("customerId", "==", c.id)));
    m.querySelector("#pj").innerHTML = p.docs.map(d => d.data()).map(x => `<div class="row-item"><b>${esc(x.projectNumber)}</b><span>${esc(x.systemType)}</span><span class="pill">${USAGE_AR[x.usageType]}</span><span class="pill s-${x.status}">${PROJECT_AR[x.status]}</span></div>`).join("") || "لا توجد مشاريع."; }
  catch { m.querySelector("#pj").textContent = "غير متاح لصلاحيتك."; }
  try { const [sn, pn] = await Promise.all([getDocs(query(collection(db, COL.subscriptions), where("customerId", "==", c.id), limit(20))), getDocs(query(collection(db, COL.payments), where("customerId", "==", c.id), limit(30)))]);
    m.querySelector("#sb").innerHTML = sn.docs.map(d => d.data()).map(x => `<div class="row-item"><span>${PLAN_AR[x.plan]}</span><span class="pill">${SUB_AR[subStatus(x)]}</span><small>${fmtDate(x.startDate)} → ${fmtDate(x.endDate)}</small></div>`).join("") || "لا توجد اشتراكات.";
    const ps = pn.docs.map(d => d.data()).filter(x => !x.isDeleted).sort((a, b) => b.paymentDate.seconds - a.paymentDate.seconds);
    m.querySelector("#py").innerHTML = ps.map(x => `<div class="row-item"><b>${money(x.amount)}</b><span>${METHOD_AR[x.paymentMethod]}</span><small>${fmtDate(x.paymentDate)}</small></div>`).join("") || "لا توجد مدفوعات.";
  } catch { m.querySelector("#sb").textContent = m.querySelector("#py").textContent = "غير متاح لصلاحيتك."; }
  try { m.querySelector("#tl").innerHTML = await timelineHtml(c.id); } catch { m.querySelector("#tl").textContent = "تعذّر التحميل."; }
}

async function portalSection(m, c, emp) {
  const box = m.querySelector("#pt"), run = fn => async () => { try { await fn(); } catch (e) { console.error(e); toast("حدث خطأ"); } };
  const draw = async () => {
    let p = null; try { p = await findPortal(c.id); } catch {}
    if (!p) { box.innerHTML = `<h4>بوابة العميل</h4><button class="btn g" id="pc">🔗 إنشاء رابط متابعة للعميل</button>`;
      box.querySelector("#pc").onclick = run(async () => { const t = await createPortal(c.id); await logActivity(emp, "CREATE_PORTAL", "customer", c.id); toast("تم إنشاء الرابط"); draw(); }); return; }
    const link = appBase() + "portal.html?t=" + p.token;
    box.innerHTML = `<h4>بوابة العميل</h4><input readonly dir="ltr" value="${esc(link)}">${waBox(c.whatsapp || c.phone, { name: c.fullName, link }, ["portal"])}
      <div class="acts"><button class="btn g" id="pu">🔄 تحديث البيانات</button><button class="btn g" id="pcp">نسخ الرابط</button><button class="btn r" id="pr">إلغاء الرابط</button></div>`;
    bindWa(box);
    box.querySelector("#pu").onclick = run(async () => { await buildPortal(c.id, p.token); toast("تم التحديث"); });
    box.querySelector("#pcp").onclick = run(async () => { await navigator.clipboard.writeText(link); toast("تم النسخ"); });
    box.querySelector("#pr").onclick = run(async () => { if (!confirm("إلغاء الرابط؟ لن يستطيع العميل فتحه بعد الآن.")) return; await revokePortal(p.token); await logActivity(emp, "REVOKE_PORTAL", "customer", c.id); toast("تم الإلغاء"); draw(); });
  };
  draw();
}
