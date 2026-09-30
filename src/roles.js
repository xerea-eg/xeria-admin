export const ROLES = { admin: "admin", manager: "manager", callcenter: "callcenter", execution: "execution", accounts: "accounts" };
export const ROLE_AR = { admin: "مدير النظام", manager: "مدير", callcenter: "كول سنتر", execution: "التنفيذ", accounts: "الحسابات" };

// الصفحات المسموحة لكل دور (للواجهة فقط؛ الحماية الفعلية في firestore.rules)
export const PAGE_ACCESS = {
  dashboard:  ["admin", "manager"],
  requests:   ["admin", "manager", "callcenter"],
  execution:  ["admin", "manager", "execution"],
  customers:  ["admin", "manager", "callcenter", "accounts"],
  projects:   ["admin", "manager", "execution", "accounts"],
  accounts:   ["admin", "manager", "accounts"],
  renewals:   ["admin", "manager", "accounts"],
  reports:    ["admin", "manager"],
  activity:   ["admin", "manager"],
  employees:  ["admin"],
  settings:   ["admin"]
};
export const can = (role, page) => (PAGE_ACCESS[page] || []).includes(role);
