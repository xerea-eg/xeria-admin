import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// مفتاح الويب هنا عام بطبيعته؛ الحماية الحقيقية تأتي من Security Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDtytTD5VHlK8VGgOoE_N-Q7c4ZiX2ntEU",
  authDomain: "xeria-eg.firebaseapp.com",
  projectId: "xeria-eg",
  storageBucket: "xeria-eg.firebasestorage.app",
  messagingSenderId: "1052466301432",
  appId: "1:1052466301432:web:e4ac8e1cc65ddb7946ee0d"
};

export const app = initializeApp(firebaseConfig);

// App Check: يحمي Firestore/Storage من الطلبات الآلية. ضع مفتاح reCAPTCHA v3 هنا ثم فعّل الإلزام من الـ Console.
export const APPCHECK_SITE_KEY = "";
if (APPCHECK_SITE_KEY) {
  if (location.hostname === "localhost") self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// أسماء ثابتة للـ Collections
export const COL = {
  employees: "employees", customers: "customers", requests: "requests",
  projects: "projects", payments: "payments", subscriptions: "subscriptions",
  notifications: "notifications", activityLogs: "activityLogs", settings: "settings"
};
