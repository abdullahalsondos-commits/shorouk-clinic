// ===== أدوات مشتركة =====

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  tooth: '<path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .6 3 1 6.5 2.8 6.5 1.6 0 1.7-3 2.2-5 .3-1.2 1-2 2-2s1.7.8 2 2c.5 2 .6 5 2.2 5 1.8 0 2.2-3.5 2.8-6.5.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  receipt: '<path d="M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2l-3 2-2-2-3 2-3-2-2 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = ICONS[name] || '';
  return s;
}

// ===== تنسيق =====
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export let CURRENCY = 'ج.م';
export function setCurrency(c) { if (c) CURRENCY = c; }
export const num = (n) => nf.format(Number(n) || 0);
export function money(n, withCur = true) {
  return h('span', { class: 'num' }, num(n) + (withCur ? ' ' + CURRENCY : ''));
}
export const moneyText = (n) => num(n) + ' ' + CURRENCY;
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const LOC = 'ar-EG-u-nu-latn';
export function fmtDate(d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!d) return '—';
  const dt = typeof d === 'string' && d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d);
  return dt.toLocaleDateString(LOC, opts);
}
export const fmtDateShort = (d) => fmtDate(d, { day: 'numeric', month: 'short' });
export function fmtTime(d) {
  return new Date(d).toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' });
}
export const weekday = (d) => new Date(d).toLocaleDateString(LOC, { weekday: 'long' });

export function isoDate(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const today = () => isoDate();
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { from: `${ym}-01`, to: isoDate(new Date(y, m, 0)) };
}
export const thisMonth = () => today().slice(0, 7);
export function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return isoDate(d).slice(0, 7); }
export const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
// datetime-local <-> ISO
export function toLocalInput(d) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
export const initials = (name = '') => (name.replace(/^د\.?\s*/, '').trim()[0] || '؟');

// ===== إشعارات =====
export function toast(msg, type = 'ok') {
  const t = h('div', { class: 'toast ' + type }, type === 'err' ? icon('alert') : icon('check'), msg);
  t.querySelector('svg').style.cssText = 'width:18px;height:18px';
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 2800);
}
export function errToast(e) { console.error(e); toast(e?.message || 'حصل خطأ، جرّب تاني', 'err'); }

// ===== نافذة =====
export function modal({ title, body, wide, actions = [], onClose }) {
  const bg = h('div', { class: 'modal-bg' });
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const foot = h('div', { class: 'modal-foot' });
  const m = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog' },
    h('div', { class: 'modal-head' }, h('h3', null, title),
      h('button', { class: 'btn ghost icon-btn', onclick: close, 'aria-label': 'إغلاق' }, icon('x'))),
    h('div', { class: 'modal-body' }, body),
    foot);
  for (const a of actions) {
    const b = h('button', { class: 'btn ' + (a.cls || ''), type: a.type || 'button' }, a.icon ? icon(a.icon) : null, a.label);
    b.addEventListener('click', async () => {
      if (!a.run) return close();
      b.disabled = true;
      try { const r = await a.run(); if (r !== false) close(); }
      catch (e) { errToast(e); }
      finally { b.disabled = false; }
    });
    foot.append(b);
  }
  foot.append(h('button', { class: 'btn ghost', onclick: close }, 'إلغاء'));
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.append(m);
  document.body.append(bg);
  setTimeout(() => m.querySelector('input:not([type=hidden]):not([readonly]), select, textarea')?.focus(), 60);
  // Enter = أول زرار
  m.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.closest('.picker')) { e.preventDefault(); foot.querySelector('.btn')?.click(); }
  });
  return { close, el: m };
}

export function confirmDialog(message, { okLabel = 'تأكيد', danger = true } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    modal({
      title: 'تأكيد',
      body: h('p', { style: 'margin:0 0 14px' }, message),
      actions: [{ label: okLabel, cls: danger ? 'danger' : 'primary', run: () => { ok = true; } }],
      onClose: () => resolve(ok),
    });
  });
}

// ===== حقول =====
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', null, label, hint ? h('em', null, ' ' + hint) : null), input);
}
export const input = (attrs = {}) => h('input', { class: 'input', ...attrs });
export const textarea = (attrs = {}) => h('textarea', { class: 'input', ...attrs });
export function select(options, value, attrs = {}) {
  const s = h('select', { class: 'input', ...attrs });
  for (const o of options) s.append(h('option', { value: o.value }, o.label));
  if (value != null) s.value = String(value);
  return s;
}
export function emptyState(text, ic = 'file') {
  return h('div', { class: 'empty' }, icon(ic), h('div', null, text));
}
export const required = (v, name) => { if (!String(v ?? '').trim()) throw new Error(`اكتب ${name}`); return String(v).trim(); };
export const toNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ===== تصدير Excel =====
export async function exportExcel(filename, sheets) {
  // sheets: [{ name, rows: [ {col: val} ] }]
  try {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    for (const s of sheets) {
      const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'لا يوجد بيانات' }]);
      ws['!cols'] = Object.keys(s.rows[0] || { a: 1 }).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    XLSX.writeFile(wb, filename + '.xlsx');
  } catch (e) {
    console.warn('xlsx failed, falling back to CSV', e);
    for (const s of sheets) {
      const cols = Object.keys(s.rows[0] || {});
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = '﻿' + [cols.map(esc).join(','), ...s.rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `${filename}-${s.name}.csv` });
      document.body.append(a); a.click(); a.remove();
    }
  }
}
