import { auth, db, firebaseConfig, COL } from "./firebase.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getAuth, createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

// يرجع {uid, ...employee} أو null (غير مسجل / معطّل)
export async function loadEmployee(user) {
  const snap = await getDoc(doc(db, COL.employees, user.uid));
  if (!snap.exists() || !snap.data().isActive) return null;
  return { uid: user.uid, ...snap.data() };
}

export function watchSession(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null);
    const emp = await loadEmployee(user);
    if (!emp) { await signOut(auth); return cb(null, "denied"); }
    cb(emp);
  });
}

// Admin فقط: إنشاء موظف بدون تسجيل خروج الأدمن (Secondary App)
export async function createEmployee({ email, password, fullName, phone, role }) {
  const second = initializeApp(firebaseConfig, "secondary-" + Date.now());
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(second), email, password);
    await setDoc(doc(db, COL.employees, cred.user.uid), {
      uid: cred.user.uid, fullName, phone: phone || "", email, photoUrl: "",
      role, isActive: true, createdAt: serverTimestamp()
    });
    return cred.user.uid;
  } finally { await deleteApp(second); }
}
export const updateEmployee = (uid, data) => updateDoc(doc(db, COL.employees, uid), data);
export const setEmployeeActive = (uid, isActive) => updateEmployee(uid, { isActive });
export const setEmployeeRole = (uid, role) => updateEmployee(uid, { role });
