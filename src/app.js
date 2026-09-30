import { logout } from "./auth.js";
import { PAGE_ACCESS, ROLE_AR, can } from "./roles.js";
const NAV = { dashboard:["الرئيسية","📊"], requests:["الطلبات","📥"], execution:["التنفيذ","🛠️"], customers:["العملاء","👥"], projects:["المشاريع","🚀"], accounts:["الحسابات","💰"], renewals:["التجديدات","🔄"], reports:["التقارير","📈"], employees:["الموظفون","🧑‍💼"], activity:["السجل","🧾"], settings:["الإعدادات","⚙️"] };
const LOADERS = { dashboard: () => import("./pages/dashboard.js"), requests: () => import("./pages/requests.js"), execution: () => import("./pages/execution.js"), customers: () => import("./pages/customers.js"), projects: () => import("./pages/projects.js"), accounts: () => import("./pages/accounts.js"), renewals: () => import("./pages/renewals.js"), reports: () => import("./pages/reports.js"), activity: () => import("./pages/activity.js"), settings: () => import("./pages/settings.js"), employees: () => import("./pages/employees.js") };
let emp;
export function startApp(employee) {
  emp = employee;
  const pages = Object.keys(NAV).filter(p => can(emp.role, p));
  document.getElementById("nav").innerHTML = pages.map((p, i) => `<a href="#${p}" data-p="${p}" class="${i >= 4 ? "extra" : ""}"><span>${NAV[p][1]}</span><small>${NAV[p][0]}</small></a>`).join("") + `<button id="moreBtn"><span>⋯</span><small>المزيد</small></button>`;
  document.getElementById("who").textContent = `${emp.fullName} · ${ROLE_AR[emp.role]}`;
  document.getElementById("avatar").textContent = emp.fullName.slice(0,1);
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("themeBtn").onclick = toggleTheme;
  if (!window._clock) window._clock = setInterval(() => document.getElementById("clock").textContent = new Date().toLocaleTimeString("ar-EG"), 1000);
  bell(); searchInit(); moreInit(pages);
  import("./alerts.js").then(x => x.runAlerts(emp)).catch(() => {});
  import("./live.js").then(x => x.startLive(emp)).catch(() => {});
  window.onhashchange = route; route();
}
async function route() {
  const pages = Object.keys(NAV).filter(p => can(emp.role, p));
  const p = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : pages[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.p === p));
  const el = document.getElementById("page");
  if (!LOADERS[p]) { el.innerHTML = `<h2>${NAV[p][0]}</h2><p class="mut">هذه الصفحة قيد التطوير في مرحلة لاحقة.</p>`; return; }
  el.innerHTML = "<p class='mut'>جارٍ التحميل...</p>";
  try { (await LOADERS[p]()).render(el, emp); } catch (e) { console.error(e); el.innerHTML = "<p class='mut'>تعذّر تحميل الصفحة.</p>"; }
}

import { db, COL } from "./firebase.js";
import { collection, query, orderBy, limit, getDocs, updateDoc, doc, getCountFromServer, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { modal, esc, fmtDT, contactBtns, toast } from "./util.js";
import { logout as doLogout } from "./auth.js";
async function bell() {
  const b = document.getElementById("bell"), load = async () => (await getDocs(query(collection(db, COL.notifications), orderBy("createdAt", "desc"), limit(20)))).docs.map(d => ({ id: d.id, ...d.data() }));
  const badge = async () => { try { const n = (await getCountFromServer(query(collection(db, COL.notifications), where("isRead", "==", false)))).data().count; b.textContent = n ? `🔔 ${n}` : "🔔"; } catch {} };
  b.onclick = async () => { const l = await load(); const { m } = modal(`<h3>الإشعارات</h3>${l.map(n => `<div class="tl" style="${n.isRead ? "opacity:.6" : ""}"><small>${fmtDT(n.createdAt)}</small><div>${esc(n.message)}</div></div>`).join("") || "<p class='mut'>لا توجد إشعارات.</p>"}`);
    await Promise.all(l.filter(n => !n.isRead).map(n => updateDoc(doc(db, COL.notifications, n.id), { isRead: true }).catch(() => {}))); b.textContent = "🔔"; };
  badge();
}

const toggleTheme = () => { const r = document.documentElement, t = r.dataset.theme === "light" ? "dark" : "light"; r.dataset.theme = t; localStorage.setItem("theme", t); };
function moreInit(pages) {
  document.getElementById("moreBtn").onclick = () => {
    const extra = pages.slice(4);
    const { m, close } = modal(`<h3>المزيد</h3><div class="more">${extra.map(p => `<a href="#${p}" class="mi"><span>${NAV[p][1]}</span>${NAV[p][0]}</a>`).join("")}
      <a class="mi" id="mS"><span>🔍</span>بحث</a><a class="mi" id="mT"><span>🌓</span>الوضع</a><a class="mi" id="mN"><span>🔔</span>تنبيهات الجهاز</a><a class="mi" id="mO"><span>🚪</span>خروج</a></div><p class="mut">${esc(emp.fullName)} · ${ROLE_AR[emp.role]}</p>`);
    m.querySelectorAll("a[href]").forEach(a => a.onclick = close);
    m.querySelector("#mS").onclick = () => { close(); openSearch(); }; m.querySelector("#mT").onclick = toggleTheme;
    m.querySelector("#mN").onclick = async () => { const p = await (await import("./live.js")).enableDeviceAlerts(); toast(p === "granted" ? "تم تفعيل تنبيهات الجهاز" : p === "unsupported" ? "المتصفح لا يدعمها" : "لم يتم السماح بالتنبيهات"); }; m.querySelector("#mO").onclick = () => { close(); doLogout(); };
  };
}
const cached = {};
function searchInit() { document.getElementById("searchBtn").onclick = openSearch; }
async function openSearch() {
  const { m, close } = modal(`<h3>بحث شامل</h3><input id="gq" class="search" placeholder="اسم، هاتف، رقم طلب/مشروع، نشاط، دومين"><div id="gr" class="list"><p class="mut">اكتب حرفين على الأقل...</p></div>`);
  m.querySelector("#gq").focus();
  const safe = async c => { try { return (await getDocs(query(collection(db, c), limit(300)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; } };
  if (!cached.c) { [cached.c, cached.r, cached.p] = await Promise.all([safe(COL.customers), safe(COL.requests), safe(COL.projects)]); cached.m = Object.fromEntries(cached.c.map(c => [c.id, c])); }
  m.querySelector("#gq").oninput = e => {
    const t = e.target.value.trim().toLowerCase(); if (t.length < 2) return;
    const has = (...a) => a.join(" ").toLowerCase().includes(t), C = id => cached.m[id] || {}, out = [];
    cached.c.filter(c => has(c.fullName, c.phone, c.whatsapp, c.businessName)).slice(0, 8).forEach(c => out.push(`<div class="req" data-pg="customers" data-q="${esc(c.phone)}">${contactBtns(c.phone, c.whatsapp)}<b>👤 ${esc(c.fullName)}</b><div class="mut">${esc(c.businessName)} · ${esc(c.phone)}</div></div>`));
    cached.r.filter(r => has(r.requestNumber, C(r.customerId).fullName, C(r.customerId).phone, C(r.customerId).businessName)).slice(0, 8).forEach(r => out.push(`<div class="req" data-pg="requests" data-q="${esc(r.requestNumber)}" data-qs="${r.status}">${contactBtns(C(r.customerId).phone, C(r.customerId).whatsapp)}<b>📥 ${esc(r.requestNumber)}</b><div class="mut">${esc(C(r.customerId).fullName)} · ${esc(C(r.customerId).businessName)}</div></div>`));
    cached.p.filter(p => has(p.projectNumber, p.businessName, p.domainName, C(p.customerId).fullName, C(p.customerId).phone)).slice(0, 8).forEach(p => out.push(`<div class="req" data-pg="projects" data-q="${esc(p.projectNumber)}">${contactBtns(C(p.customerId).phone, C(p.customerId).whatsapp)}<b>🚀 ${esc(p.projectNumber)}</b><div class="mut">${esc(p.businessName)} ${esc(p.domainName || "")}</div></div>`));
    const box = m.querySelector("#gr"); box.innerHTML = out.join("") || "<p class='mut'>لا نتائج.</p>";
    box.querySelectorAll(".req").forEach(r => r.onclick = () => { const pg = r.dataset.pg; if (!can(emp.role, pg)) return;
      sessionStorage.setItem("q", r.dataset.q); if (r.dataset.qs) sessionStorage.setItem("qs", r.dataset.qs); close(); if (location.hash === "#" + pg) route(); else location.hash = pg; });
  };
}
