انسخ الملفات دي فوق نفس الأسماء في مشروعك (مع الحفاظ على الفولدرات src و src/pages) ثم:

  firebase deploy --only hosting,firestore:rules
  git add .
  git commit -m "Call center workflow, client landing/tracking/inquiries"
  git push

ملاحظة: طلبات قديمة قبل التحديث مش هتظهر في "استعلام عن طلب" إلا بعد ما الكول سنتر يضغط "حفظ" عليها مرة.
