import { db, COL } from "../firebase.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, fmtDT } from "../util.js";
export async function render(el) {
  el.innerHTML = `<h2>سجل العمليات</h2><div id="l" class="list"><p class="mut">جارٍ التحميل...</p></div>`;
  const s = await getDocs(query(collection(db, COL.activityLogs), orderBy("timestamp", "desc"), limit(60)));
  el.querySelector("#l").innerHTML = s.docs.map(d => d.data()).map(x => `<div class="row-item"><b>${esc(x.action)}</b><span>${esc(x.userName)}</span><span class="mut">${esc(x.targetType)} · ${esc(x.targetId)}</span><small>${fmtDT(x.timestamp)}</small></div>`).join("") || "<p class='mut'>لا توجد عمليات.</p>";
}
