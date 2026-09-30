import { db, COL } from "../firebase.js";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { bust, toast, logActivity, esc } from "../util.js";
import { loadPlans, loadGeneral } from "../finance.js";
const PL = [["startMonthly", "Start شهري"], ["startYearly", "Start سنوي"], ["proMonthly", "Pro شهري"], ["proYearly", "Pro سنوي"], ["businessMonthly", "Business شهري"], ["businessYearly", "Business سنوي"]];
const GN = [["companyName", "اسم الشركة"], ["logoUrl", "رابط الشعار"], ["phone", "الهاتف"], ["whatsapp", "WhatsApp"], ["email", "Email"]];
export async function render(el, emp) {
  const [P, G] = await Promise.all([loadPlans(), loadGeneral()]);
  el.innerHTML = `<h2>الإعدادات</h2><h4>الباقات (Custom = حسب الطلب)</h4><div class="two">${PL.map(([k, l]) => `<label>${l}<input data-p="${k}" type="number" value="${P[k]}"></label>`).join("")}</div>
   <h4>عام</h4><div class="two">${GN.map(([k, l]) => `<label>${l}<input data-g="${k}" value="${esc(G[k] || "")}"></label>`).join("")}<label>سعر الدومين السنوي<input data-g="domainPrice" type="number" value="${G.domainPrice}"></label><label>مدة الفترة التجريبية (يوم)<input data-g="trialDays" type="number" value="${G.trialDays}"></label></div>
   <button class="btn" id="s" style="margin-top:12px">حفظ الإعدادات</button><h4>نسخة احتياطية</h4><p class="mut">تنزيل ملف JSON بكل البيانات. يستهلك قراءات من الحصة المجانية، فاستخدمه أسبوعيًا فقط.</p><button class="btn g" id="bk">تنزيل نسخة احتياطية</button>`;
  el.querySelector("#bk").onclick = async () => { if (!confirm("سيقرأ النظام كل البيانات ويستهلك من الحصة المجانية. متابعة؟")) return;
    try { const out = {}; for (const c of ["customers", "requests", "projects", "payments", "subscriptions", "employees"]) out[c] = (await getDocs(query(collection(db, c), limit(2000)))).docs.map(d => ({ id: d.id, ...d.data() }));
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" })); a.download = "xeria-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
      await logActivity(emp, "BACKUP_DOWNLOAD", "settings", "all"); } catch (e) { console.error(e); toast("تعذّر إنشاء النسخة"); } };
  el.querySelector("#s").onclick = async () => { try {
    const p = {}, g = {}; el.querySelectorAll("[data-p]").forEach(i => p[i.dataset.p] = +i.value); el.querySelectorAll("[data-g]").forEach(i => g[i.dataset.g] = i.type === "number" ? +i.value : i.value.trim());
    await setDoc(doc(db, COL.settings, "plans"), p, { merge: true }); await setDoc(doc(db, COL.settings, "general"), g, { merge: true });
    await logActivity(emp, "UPDATE_SETTINGS", "settings", "plans+general", { P, G }, { p, g }); bust("plans"); bust("general"); toast("تم الحفظ"); } catch (e) { console.error(e); toast("حدث خطأ"); } };
}
