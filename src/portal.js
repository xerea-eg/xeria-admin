// بوابة العميل: لقطة بيانات (portal/{token}) يقرأها العميل بالرابط فقط. تُحدَّث يدويًا/تلقائيًا بعد العمليات المالية.
import { db, COL } from "./firebase.js";
import { collection, query, where, limit, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { memo, getCustomer } from "./util.js";
const tot = b => (+b?.subscriptionPrice || 0) + (+b?.domainPrice || 0) + (+b?.addonsCost || 0) - (+b?.discount || 0);
const ms = t => t?.toMillis ? t.toMillis() : null;
export async function findPortal(customerId) {
  const s = await getDocs(query(collection(db, "portal"), where("customerId", "==", customerId), limit(1)));
  return s.docs[0] ? { token: s.docs[0].id, ...s.docs[0].data() } : null;
}
export async function buildPortal(customerId, token) {
  const [cu, ps, py, g] = await Promise.all([getCustomer(customerId),
    getDocs(query(collection(db, COL.projects), where("customerId", "==", customerId), limit(10))),
    getDocs(query(collection(db, COL.payments), where("customerId", "==", customerId), limit(50))),
    memo("general-raw", async () => { try { const s = await getDoc(doc(db, COL.settings, "general")); return s.exists() ? s.data() : {}; } catch { return {}; } }, 600000)]);
  const projects = ps.docs.map(d => d.data()).map(p => ({ number: p.projectNumber, businessName: p.businessName, systemType: p.systemType, systemUrl: p.systemUrl || "", plan: p.plan, usage: p.usageType, status: p.status,
    startDate: ms(p.startDate), endDate: ms(p.endDate), total: tot(p.billing), paid: p.paidTotal || 0, domainName: p.domainName || "", domainExpiry: ms(p.domainExpiryDate) }));
  const payments = py.docs.map(d => d.data()).filter(x => !x.isDeleted).sort((a, b) => b.paymentDate.seconds - a.paymentDate.seconds)
    .map(x => ({ amount: x.amount, date: ms(x.paymentDate), method: x.paymentMethod, receiptId: x.receiptId || "", receiptNumber: x.receiptNumber || "" }));
  await setDoc(doc(db, "portal", token), { customerId, customerName: cu.fullName || "", projects, payments,
    company: { name: g.companyName || "XERIA", phone: g.phone || "", whatsapp: g.whatsapp || "" }, updatedAt: serverTimestamp() });
}
export async function createPortal(customerId) { const token = crypto.randomUUID().replace(/-/g, ""); await buildPortal(customerId, token); return token; }
export const revokePortal = token => deleteDoc(doc(db, "portal", token));
export async function syncPortalIfExists(customerId) { try { const p = await findPortal(customerId); if (p) await buildPortal(customerId, p.token); } catch {} }
