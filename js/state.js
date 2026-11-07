// ===== حالة التطبيق المشتركة =====
import { setCurrency, round2 } from './core.js';

export const app = { db: null, me: null, settings: { clinic_share: 60, doctor_share: 40 }, users: [] };

export const isAdmin = () => app.me?.role === 'admin';
export const userName = (id) => (id ? app.users.find((u) => u.id === id)?.full_name || '' : '');

export async function loadShared() {
  const [settings, users] = await Promise.all([app.db.getSettings(), app.db.listUsers()]);
  app.settings = settings;
  app.users = users;
  setCurrency(settings.currency);
}
export async function refreshUsers() { app.users = await app.db.listUsers(); }

// الحساب الكامل: اللي اتقبض − الفواتير، وبعدين التقسيم
export function settle(collected, expenses = 0) {
  const c = round2(collected), e = round2(expenses);
  const ds = Number(app.settings.doctor_share) / 100;
  if (app.settings.expenses_mode === 'clinic_only') {
    const doctor = round2(c * ds);
    return { collected: c, expenses: e, net: round2(c - e), doctor, clinic: round2(c - doctor - e) };
  }
  const net = round2(c - e);
  const doctor = round2(net * ds);
  return { collected: c, expenses: e, net, doctor, clinic: round2(net - doctor) };
}

// التقسيم: نسبة العيادة والباقي للدكتور
export function split(amount) {
  const doc = round2((Number(amount) || 0) * Number(app.settings.doctor_share) / 100);
  return { doctor: doc, clinic: round2((Number(amount) || 0) - doc) };
}
