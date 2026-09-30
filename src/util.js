import { db, COL } from "./firebase.js";
import { addDoc, collection, serverTimestamp, getDocs, query, orderBy, getDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
export const STATUS_AR = { NEW:"طلب جديد", EXECUTION:"التنفيذ", ACTIVE:"مشروع نشط", CANCELLED:"ملغي" };
export const PLAN_AR = { TRIAL:"تجربة مجانية", START:"Start", PRO:"Pro", BUSINESS:"Business", CUSTOM:"Custom" };
export const toDate = t => t?.toDate ? t.toDate() : (t ? new Date(t) : null);
export const fmtDate = t => { const d = toDate(t); return d ? d.toLocaleDateString("en-GB") : "—"; };
export const fmtDT = t => { const d = toDate(t); return d ? d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}) : "—"; };
// أرقام: تحويل الأرقام العربية/الفارسية إلى لاتينية وتوحيد الصيغة الدولية (مصر 20)
export const digits = s => String(s ?? "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "");
export const intlPhone = p => { let d = digits(p); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "20" + d.slice(1); else if (d.length === 10 && d.startsWith("1")) d = "20" + d; return d; };
export const waLink = (p, text) => "https://api.whatsapp.com/send?phone=" + intlPhone(p) + (text ? "&text=" + encodeURIComponent(text) : "");
export const telLink = p => "tel:+" + intlPhone(p);
export const toast = m => { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2500); };

// سجل العمليات + الإشعارات (نقطة واحدة لإعادة الاستخدام)
export const logActivity = (emp, action, targetType, targetId, oldData = null, newData = null) =>
  addDoc(collection(db, COL.activityLogs), { action, userId: emp.uid, userName: emp.fullName, targetType, targetId, oldData, newData, timestamp: serverTimestamp() });
export const notify = (type, message, targetType, targetId) =>
  addDoc(collection(db, COL.notifications), { type, message, targetType, targetId, isRead: false, createdAt: serverTimestamp() });
// حدث Timeline موحد (يُستخدم لاحقًا في صفحات العميل والمشروع)
export const addTimeline = (emp, customerId, type, description, projectId = null) =>
  addDoc(collection(db, COL.customers, customerId, "timeline"), { type, description, userId: emp.uid, userName: emp.fullName, projectId, dateTime: serverTimestamp() });

export const SYSTEM_TYPES = ["Retail","Installments","Clinic","Medical Center","Law Office","Warehouse","Company","Custom"];
export const PROJECT_AR = { ACTIVE:"نشط", EXPIRED:"منتهي", SUSPENDED:"موقوف", CANCELLED:"ملغي" };
export const USAGE_AR = { TRIAL:"تجريبي", PAID:"مدفوع" };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
export const inputDate = t => { const d = toDate(t); return d ? new Date(d - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : ""; };
export function modal(html) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="sheet"><button class="x">✕</button>${html}</div>`; document.body.append(m);
  const close = () => m.remove(); m.querySelector(".x").onclick = close; m.onclick = e => e.target === m && close();
  return { m, close };
}
export async function timelineHtml(customerId) {
  const s = await getDocs(query(collection(db, COL.customers, customerId, "timeline"), orderBy("dateTime", "desc")));
  return s.docs.map(d => d.data()).map(e => `<div class="tl"><small>${fmtDT(e.dateTime)}</small><div>${esc(e.description)}</div></div>`).join("") || "<p class='mut'>لا توجد أحداث.</p>";
}

export const BUSINESS_TYPES = ["محل تجاري","بيع بالتقسيط","عيادة","مركز طبي","مكتب محاماة","مخزن","شركة","مكتب إداري","مطعم / كافيه","نشاط آخر"];
// أزرار اتصال + واتساب تظهر على كل بطاقة عميل (لا تفتح البطاقة عند الضغط)
export const contactBtns = (phone, wa) => (phone || wa) ? `<div class="qc" onclick="event.stopPropagation()"><a class="qb" href="${telLink(phone || wa)}" aria-label="اتصال">📞</a><a class="qb wa" href="${waLink(wa || phone)}" target="_blank" rel="noopener" aria-label="واتساب">💬</a></div>` : "";
// صف أزرار كامل داخل النوافذ: اتصال + واتساب + نسخ الرقم (احتياطي لو الجهاز لا يفتح الروابط)
export const callActs = (phone, wa) => `<div class="acts"><a class="btn" href="${telLink(phone || wa)}">📞 اتصال</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(wa || phone)}">💬 واتساب</a><button type="button" class="btn g" data-copy="${esc(digits(phone || wa))}">📋 نسخ الرقم</button></div>`;
document.addEventListener("click", e => { const b = e.target.closest?.("[data-copy]"); if (!b) return; const t = b.dataset.copy;
  (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("تم نسخ الرقم"), () => { const i = document.createElement("textarea"); i.value = t; document.body.append(i); i.select(); try { document.execCommand("copy"); toast("تم نسخ الرقم"); } catch {} i.remove(); }); });
// شريط فلاتر قابل للطي: defs = [{id,label,options:[[value,label]]}] + فلتر تاريخ من/إلى
export function mkFilters(host, defs, cb) {
  host.innerHTML = `<details class="flt"><summary>🔎 فلاتر</summary><div class="two">${defs.map(d => `<label>${d.label}<select data-f="${d.id}"><option value="">الكل</option>${d.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label>`).join("")}<label>من<input type="date" data-f="from"></label><label>إلى<input type="date" data-f="to"></label></div></details>`;
  const vals = () => { const o = {}; host.querySelectorAll("[data-f]").forEach(i => o[i.dataset.f] = i.value); return o; };
  host.querySelectorAll("[data-f]").forEach(i => i.onchange = cb);
  return { vals, inRange: t => { const v = vals(), d = toDate(t); if (!d) return !v.from && !v.to; return (!v.from || d >= new Date(v.from)) && (!v.to || d <= new Date(v.to + "T23:59:59")); } };
}

// كاش في الذاكرة لتوفير القراءات من الحصة المجانية
const _memo = new Map();
export async function memo(key, fn, ttl = 300000) { const h = _memo.get(key); if (h && Date.now() - h.t < ttl) return h.v; const v = await fn(); _memo.set(key, { t: Date.now(), v }); return v; }
export const bust = p => { for (const k of [..._memo.keys()]) if (k.startsWith(p)) _memo.delete(k); };
export const getCustomer = id => memo("cust:" + id, async () => (await getDoc(doc(db, COL.customers, id))).data() || {}, 600000);
// قوالب واتساب
export const WA_TPL = { welcome: ["ترحيب", "أهلاً {name}، معك فريق XERIA بخصوص طلبك رقم {ref}. هل يناسبك الحديث الآن؟"],
  renewal: ["تذكير بالتجديد", "مرحبًا {name}، نذكرك بأن اشتراك {biz} ينتهي بتاريخ {date}. للتجديد تواصل معنا."],
  due: ["تذكير بمبلغ مستحق", "مرحبًا {name}، المتبقي على {biz} مبلغ {amount}. برجاء التسوية في أقرب وقت."],
  portal: ["رابط المتابعة", "مرحبًا {name}، هذا رابط متابعة اشتراكك ودفعاتك على XERIA: {link}"],
  receipt: ["إيصال الدفع", "مرحبًا {name}، تم استلام مبلغ {amount}. إيصال رقم {no}: {link}"] };
export const waBox = (phone, ctx, keys) => `<div class="wabox" data-phone="${esc(phone)}" data-ctx="${esc(JSON.stringify(ctx))}"><select>${keys.map(k => `<option value="${k}">${WA_TPL[k][0]}</option>`).join("")}</select><a class="btn wa" target="_blank" rel="noopener">💬 إرسال رسالة</a></div>`;
export function bindWa(root) { root.querySelectorAll(".wabox").forEach(b => { const sel = b.querySelector("select"), a = b.querySelector("a"), ctx = JSON.parse(b.dataset.ctx);
  const upd = () => { let t = WA_TPL[sel.value][1]; for (const [k, v] of Object.entries(ctx)) t = t.replaceAll("{" + k + "}", v); a.href = waLink(b.dataset.phone, t); }; sel.onchange = upd; upd(); }); }

// تصدير Excel بدون مكتبات خارجية (جدول HTML يفتحه Excel مباشرة، يدعم العربية RTL)
export function exportXls(name, headers, rows) {
  const t = `<html dir="rtl"><head><meta charset="utf-8"></head><body><table border="1"><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + t], { type: "application/vnd.ms-excel" })); a.download = name + ".xls"; a.click();
}

export const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");
// نافذة الإيصال بعد تسجيل الدفعة: فتح + إرسال واتساب
export function receiptModal(rc, cust) {
  const link = appBase() + "receipt.html?id=" + rc.receiptId;
  const { m } = modal(`<h3>تم تسجيل الدفعة ✅</h3><p>رقم الإيصال: <b>${esc(rc.receiptNumber)}</b></p><div class="acts"><a class="btn" target="_blank" rel="noopener" href="${link}">🧾 فتح الإيصال / طباعة</a></div>
    ${waBox(cust.whatsapp || cust.phone, { name: cust.fullName || "", amount: rc.amountText, no: rc.receiptNumber, link }, ["receipt"])}`);
  bindWa(m);
}

// ---------- التواصل مع العميل (الكول سنتر) ----------
export const CONTACT_TYPE = { CALL: "📞 اتصال", WHATSAPP: "💬 واتساب" };
export const OUTCOME = { ANSWERED: "تم الرد", NO_ANSWER: "لم يرد", CLOSED: "الهاتف مغلق", BUSY: "الرقم مشغول", WRONG: "رقم خاطئ / غير متاح", POSTPONED: "العميل طلب موعدًا آخر", NOT_INTERESTED: "غير مهتم" };
export const OUTCOME_CB = [ "POSTPONED", "NO_ANSWER", "CLOSED", "BUSY" ];   // نتائج يظهر معها تحديد موعد إعادة الاتصال
export const cbToDate = (dateStr, hour12, ap) => { if (!dateStr) return null; const h = (+hour12 % 12) + (ap === "PM" ? 12 : 0); return new Date(`${dateStr}T${String(h).padStart(2, "0")}:00:00`); };
export const cbParts = t => { const d = toDate(t); if (!d) return { date: "", hour: 10, ap: "AM" }; const h = d.getHours(); return { date: inputDate(d), hour: ((h + 11) % 12) + 1, ap: h >= 12 ? "PM" : "AM" }; };
export const cbText = t => { const d = toDate(t); if (!d) return ""; const h = d.getHours(); return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) + " — الساعة " + (((h + 11) % 12) + 1) + (h >= 12 ? " مساءً" : " صباحًا"); };

// ---------- صفحة استعلام العميل (لقطة عامة بدون بيانات حساسة) ----------
// المعرّف = رقم الطلب + آخر 10 أرقام من الهاتف، فلا يمكن تخمينه من رقم الطلب وحده.
export const pubIdOf = (num, phone) => num + "-" + digits(phone).slice(-10);
export const stageOf = r => r.status === "CANCELLED" ? "CANCELLED" : r.status === "ACTIVE" ? "DONE" : r.status === "EXECUTION" ? "CONFIRMED" : (r.contactLog?.length ? "CONTACTED" : "RECEIVED");
export async function syncPublic(r, c) {
  const id = pubIdOf(r.requestNumber, c.phone), cb = toDate(r.callbackAt);
  await setDoc(doc(db, COL.publicStatus, id), { requestId: r.id, requestNumber: r.requestNumber, plan: r.selectedPlan || "", stage: stageOf(r),
    clientNote: r.clientNote || "", callbackText: r.status === "NEW" && cb && cb > new Date() ? cbText(cb) : "",
    systemUrl: r.status === "ACTIVE" ? (r.execution?.systemUrl || "") : "", createdAt: r.createdAt || serverTimestamp(), updatedAt: serverTimestamp() });
  if (r.publicId && r.publicId !== id) { try { await deleteDoc(doc(db, COL.publicStatus, r.publicId)); } catch {} }   // تغيّر رقم الهاتف
  return id;
}

// ---------- رسائل واتساب بعد الحالات الرئيسية (تُفتح جاهزة والموظف يضغط إرسال) ----------
export const msgConfirmed = (name, ref) => `مرحبًا ${name} 🌟\nتم تأكيد طلبك رقم ${ref} ✅\nوجارٍ الآن تصميم نظام العمل الذي يتوافق مع متطلبات عملك.\nيسعدنا ويشرفنا التعامل مع حضرتك.\n— فريق XERIA`;
export const msgDone = (name, ref, url, user, pass) => `مرحبًا ${name} 🎉\nتم تنفيذ طلبك رقم ${ref} وأصبح نظامك جاهزًا ✅\n\n🔗 رابط النظام:\n${url}\n` + (user || pass ? `\n🔐 بيانات الدخول:\n${user ? "اسم المستخدم: " + user + "\n" : ""}${pass ? "كلمة المرور: " + pass + "\n" : ""}` : "") + `\nنتمنى لك تجربة موفقة، ولأي استفسار نحن في خدمتك.\n— فريق XERIA`;
// نافذة نجاح تعرض زر إرسال واتساب جاهز
export function waPrompt(title, phone, text) {
  const { m } = modal(`<h3>${esc(title)}</h3><p class="mut">اضغط الزر لفتح واتساب برسالة جاهزة، ثم اضغط إرسال.</p><pre class="need" style="font-family:inherit">${esc(text)}</pre>
    <div class="acts"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(phone, text)}">💬 إرسال على واتساب</a><button type="button" class="btn g" data-copy="${esc(text)}">📋 نسخ الرسالة</button></div>`);
  return m;
}
