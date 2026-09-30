import { db, COL } from "./firebase.js";
import { collection, doc, getDoc, setDoc, serverTimestamp, Timestamp, updateDoc, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCustomer, memo, logActivity, notify, addTimeline } from "./util.js";
export const METHOD_AR = { Cash:"نقدي", InstaPay:"إنستا باي", "Bank Transfer":"تحويل بنكي", Wallet:"محفظة", Other:"أخرى" };
export const SUB_AR = { ACTIVE:"نشط", EXPIRING:"ينتهي قريبًا", EXPIRED:"منتهي", CANCELLED:"ملغي" };
export const money = n => Number(n || 0).toLocaleString("ar-EG") + " جنيه";
export const totalOf = b => (+b?.subscriptionPrice || 0) + (+b?.domainPrice || 0) + (+b?.addonsCost || 0) - (+b?.discount || 0);
const DEF = { startMonthly:399, startYearly:3990, proMonthly:599, proYearly:5990, businessMonthly:899, businessYearly:8990 };
export const loadPlans = () => memo("plans", _plans, 600000);
async function _plans() { try { const s = await getDoc(doc(db, COL.settings, "plans")); return { ...DEF, ...(s.exists() ? s.data() : {}) }; } catch { return DEF; } }
export const loadGeneral = () => memo("general", _general, 600000);
async function _general() { try { const s = await getDoc(doc(db, COL.settings, "general")); return { domainPrice:1000, trialDays:14, ...(s.exists() ? s.data() : {}) }; } catch { return { domainPrice:1000, trialDays:14 }; } }
export const planPrice = (P, plan, cycle) => (plan === "TRIAL" || plan === "CUSTOM") ? 0 : P[plan.toLowerCase() + (cycle === "YEARLY" ? "Yearly" : "Monthly")] || 0;
export const daysLeft = t => { const d = t?.toDate ? t.toDate() : null; return d ? Math.ceil((d - Date.now()) / 86400000) : null; };
export const subStatus = s => s.status === "CANCELLED" ? "CANCELLED" : (daysLeft(s.endDate) ?? 0) < 0 ? "EXPIRED" : (daysLeft(s.endDate) <= 30 ? "EXPIRING" : "ACTIVE");
export async function addPayment(emp, p, c, d) {
  const ref = doc(collection(db, COL.payments)), rRef = doc(collection(db, "receipts")), cnt = doc(db, COL.settings, "counters"), amount = +d.amount;
  const [cu, G] = await Promise.all([getCustomer(p.customerId), loadGeneral()]);
  const date = Timestamp.fromDate(new Date(d.paymentDate || Date.now()));
  // إيصال إلكتروني برقم متسلسل RC-000001 (transaction على العدّاد)
  const receiptNumber = await runTransaction(db, async tx => {
    const c0 = await tx.get(cnt), seq = (c0.data()?.receiptSeq || 0) + 1, no = "RC-" + String(seq).padStart(6, "0");
    tx.set(cnt, { receiptSeq: seq }, { merge: true });
    tx.set(rRef, { receiptId: rRef.id, receiptNumber: no, paymentId: ref.id, projectNumber: p.projectNumber || "", businessName: p.businessName || "", customerName: cu.fullName || "", amount, paymentDate: date,
      paymentMethod: d.paymentMethod, transactionNumber: d.transactionNumber || "", receivedBy: emp.fullName, notes: d.notes || "",
      company: { name: G.companyName || "XERIA", phone: G.phone || "", whatsapp: G.whatsapp || "", email: G.email || "" }, void: false, createdAt: serverTimestamp() });
    return no;
  });
  const pay = { paymentId: ref.id, customerId: p.customerId, projectId: p.id, amount, paymentDate: date, paymentMethod: d.paymentMethod, transactionNumber: d.transactionNumber || "",
    receiptUrl: d.receiptUrl || "", receiptId: rRef.id, receiptNumber, notes: d.notes || "", receivedBy: emp.fullName, createdAt: serverTimestamp() };
  await setDoc(ref, pay);
  await updateDoc(doc(db, COL.projects, p.id), { paidTotal: increment(amount), updatedAt: serverTimestamp() });
  await logActivity(emp, "ADD_PAYMENT", "payment", ref.id, null, { amount, projectId: p.id, receiptNumber });
  await addTimeline(emp, p.customerId, "PAYMENT", `تم تسجيل دفعة ${money(amount)} — إيصال ${receiptNumber}`, p.id);
  await notify("PAYMENT", `دفعة جديدة ${money(amount)} — ${p.businessName}`, "payment", ref.id);
  return { id: ref.id, receiptId: rRef.id, receiptNumber, amountText: money(amount) };
}
