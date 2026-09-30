// ملفات الكود + إعدادات Firebase الخاصة بكل نظام (تظهر لـ admin وexecution فقط)
// البيانات في requests/{id}/private/exec والملفات في Storage: project-files/{requestId}/...
import { db, storage } from "../firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { esc, toast, logActivity } from "../util.js";
const BLOCK = /\.(exe|bat|cmd|msi|apk|dll|scr|com|ps1)$/i, MAX = 25 * 1024 * 1024, MAXN = 8;
export async function mountSysFiles(box, requestId, emp, editable = true) {
  const pref = doc(db, "requests", requestId, "private", "exec");
  let data;
  try { data = (await getDoc(pref)).data() || {}; } catch { box.innerHTML = `<p class="mut">هذا القسم متاح للأدمن وموظفي التنفيذ فقط.</p>`; return; }
  let files = data.files || [];
  const run = fn => async ev => { try { await fn(ev); } catch (e) { console.error(e); toast("حدث خطأ: " + (e.code || "")); } };
  const draw = () => {
    box.innerHTML = `<h4>🔐 إعدادات Firebase الخاصة بالنظام</h4>
     <textarea id="fc" rows="6" dir="ltr" style="font-family:monospace;font-size:13px" ${editable ? "" : "disabled"} placeholder="const firebaseConfig = { apiKey: ..., projectId: ... }">${esc(data.firebaseConfig || "")}</textarea>
     ${editable ? `<button class="btn g" id="fs">حفظ الإعدادات</button>` : ""}
     <h4>📦 ملفات الكود والإعدادات (${files.length}/${MAXN})</h4>
     ${files.map((f, i) => `<div class="row-item"><span>📎 ${esc(f.name)}</span><small>${(f.size / 1048576).toFixed(1)}MB · ${esc(f.by)}</small><button class="btn g" data-d="${i}" style="width:auto;padding:4px 10px">تنزيل</button>${editable ? `<button class="btn r" data-x="${i}" style="width:auto;padding:4px 10px">حذف</button>` : ""}</div>`).join("") || `<p class="mut">لا توجد ملفات.</p>`}
     ${editable ? `<input id="ff" type="file" multiple><button class="btn" id="fu">رفع الملفات</button><p class="mut">حتى 25MB للملف (ZIP/JSON/JS/TXT...). ملفات التشغيل (.exe/.bat) ممنوعة. هذه البيانات لا يراها Call Center أو الحسابات.</p>` : ""}`;
    const save = async () => { await setDoc(pref, { files, firebaseConfig: data.firebaseConfig || "", updatedAt: serverTimestamp() }, { merge: true }); };
    if (editable) {
      box.querySelector("#fs").onclick = run(async () => { data.firebaseConfig = box.querySelector("#fc").value; await save();
        await logActivity(emp, "UPDATE_SYSTEM_CONFIG", "request", requestId); toast("تم حفظ الإعدادات"); });   // لا نسجل القيم في السجل
      box.querySelector("#fu").onclick = run(async () => {
        const sel = [...box.querySelector("#ff").files]; if (!sel.length) return toast("اختر ملفات أولًا");
        if (files.length + sel.length > MAXN) return toast("الحد الأقصى " + MAXN + " ملفات");
        for (const f of sel) if (BLOCK.test(f.name) || f.size > MAX) return toast("ملف غير مسموح أو أكبر من 25MB: " + f.name);
        for (const f of sel) { const safe = f.name.replace(/[^\w.\-]+/g, "_"), path = `project-files/${requestId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
          await uploadBytes(ref(storage, path), f); files.push({ name: f.name, path, size: f.size, by: emp.fullName, at: Date.now() }); }
        await save(); await logActivity(emp, "UPLOAD_SYSTEM_FILE", "request", requestId, null, { count: sel.length }); toast("تم الرفع"); draw(); });
      box.querySelectorAll("[data-x]").forEach(b => b.onclick = run(async () => { const f = files[+b.dataset.x]; if (!confirm("حذف الملف " + f.name + "؟")) return;
        try { await deleteObject(ref(storage, f.path)); } catch {} files.splice(+b.dataset.x, 1); await save();
        await logActivity(emp, "DELETE_SYSTEM_FILE", "request", requestId, { name: f.name }, null); draw(); }));
    }
    box.querySelectorAll("[data-d]").forEach(b => b.onclick = run(async () => { window.open(await getDownloadURL(ref(storage, files[+b.dataset.d].path)), "_blank", "noopener"); }));
  };
  draw();
}
