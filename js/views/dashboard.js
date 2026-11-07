import { h, icon, money, num, fmtDate, fmtDateShort, today, addDays, thisMonth, monthRange, monthName, emptyState, input, select, debounce, exportExcel } from '../core.js';
import { app, settle } from '../state.js';

// الفلتر بيفضل محفوظ وإنت بتتنقل بين الصفحات
const F = { period: 'today', from: null, to: null, q: '' };

function periodRange() {
  const t = today();
  switch (F.period) {
    case 'today': return { from: t, to: t, label: 'النهاردة' };
    case 'yesterday': { const y = addDays(t, -1); return { from: y, to: y, label: 'امبارح' }; }
    case 'week': return { from: addDays(t, -6), to: t, label: 'آخر 7 أيام' };
    case 'month': return { ...monthRange(thisMonth()), label: monthName(thisMonth()) };
    default: return { from: F.from || t, to: F.to || t, label: `من ${fmtDate(F.from || t)} لحد ${fmtDate(F.to || t)}` };
  }
}

export async function renderDashboard(page, ctx) {
  const range = periodRange();
  const month = monthRange(thisMonth());
  const [visits, monthVisits, outstanding, monthExp] = await Promise.all([
    app.db.listVisits({ from: range.from, to: range.to }),
    F.period === 'month' ? null : app.db.listVisits(month),
    app.db.listCases({ outstanding: true }),
    app.db.listExpenses(month),
  ]);
  if (!ctx.alive()) return;
  const mv = monthVisits || visits;
  const sum = (arr) => arr.reduce((a, v) => a + Number(v.amount_paid), 0);
  const t = today();
  const todayV = mv.filter((v) => v.visit_date === t);
  const monthIncome = sum(mv);
  const due = outstanding.reduce((a, c) => a + Number(c.remaining), 0);
  const hour = new Date().getHours();

  const kpi = (cls, ic, label, value, hint) => h('div', { class: 'card kpi ' + cls },
    h('div', { class: 'label' }, h('i', null, icon(ic)), label), h('div', { class: 'value' }, value), hint ? h('div', { class: 'hint' }, hint) : null);

  // ---------- أدوات الفلترة ----------
  const set = (patch) => { Object.assign(F, patch); ctx.rerender(); };
  const periods = [['today', 'النهاردة'], ['yesterday', 'امبارح'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['custom', 'فترة']];
  const seg = h('div', { class: 'segmented' }, periods.map(([k, l]) => h('button', { class: F.period === k ? 'on' : '', onclick: () => set({ period: k, from: F.from || range.from, to: F.to || range.to }) }, l)));
  const custom = F.period === 'custom' ? h('div', { class: 'range-inputs' },
    h('input', { type: 'date', class: 'input', value: range.from, onchange: (e) => e.target.value && set({ from: e.target.value }) }),
    h('span', { class: 'muted small' }, 'لحد'),
    h('input', { type: 'date', class: 'input', value: range.to, onchange: (e) => e.target.value && set({ to: e.target.value }) })) : null;
  const q = input({ placeholder: 'ابحث باسم المريض أو العلاج...', value: F.q });
  q.addEventListener('input', debounce(() => { F.q = q.value; draw(); }, 150));

  // ---------- الجدول ----------
  const tableBox = h('div');
  const totalsBox = h('div', { class: 'log-totals' });
  let shown = [];
  function draw() {
    const s = F.q.trim().toLowerCase();
    shown = visits.filter((v) =>
      (!s || (v.patient?.full_name || '').toLowerCase().includes(s) || (v.patient?.phone || '').includes(s) || (v.case?.treatment_name || '').toLowerCase().includes(s) || (v.notes || '').toLowerCase().includes(s)));
    const total = sum(shown);
    const people = new Set(shown.map((v) => v.patient_id)).size;
    totalsBox.replaceChildren(
      h('span', null, h('b', { class: 'num' }, people), ' مريض'),
      h('span', null, h('b', { class: 'num' }, shown.length), ' زيارة'),
      h('span', null, 'اتقبض ', h('b', null, money(total))));
    if (!shown.length) { tableBox.replaceChildren(emptyState(visits.length ? 'مفيش نتايج بالبحث ده' : `مفيش زيارات ${range.label}`, 'activity')); return; }
    // تجميع حسب اليوم
    const days = new Map();
    for (const v of shown) { if (!days.has(v.visit_date)) days.set(v.visit_date, []); days.get(v.visit_date).push(v); }
    const multiDay = days.size > 1;
    const tbody = h('tbody');
    for (const [d, list] of days) {
      if (multiDay) tbody.append(h('tr', { class: 'day-row' }, h('td', { colspan: 5 },
        h('b', null, d === t ? 'النهاردة' : d === addDays(t, -1) ? 'امبارح' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })),
        h('span', { class: 'muted small' }, ` — ${list.length} زيارة • `, money(sum(list))))));
      for (const v of list) {
        tbody.append(h('tr', { class: 'clickable', title: 'افتح ملف المريض', onclick: () => (location.hash = '#/patients/' + v.patient_id) },
          h('td', null, h('div', { class: 'who-cell' }, h('div', { class: 'mini-avatar' }, (v.patient?.full_name || '؟')[0]),
            h('div', null, h('b', null, v.patient?.full_name || '—'), h('div', { class: 'muted small' }, h('span', { class: 'num' }, v.patient?.phone || ''))))),
          h('td', null, v.case ? h('span', { class: 'tx-pill', dir: 'ltr' }, v.case.treatment_name) : '—', v.case?.tooth ? h('div', { class: 'muted small' }, v.case.tooth) : null),
          h('td', { class: 'notes-cell' }, v.notes || h('span', { class: 'muted' }, '—')),
          h('td', { class: 'muted small' }, multiDay ? null : fmtDateShort(v.visit_date), multiDay ? null : null),
          h('td', { class: 'money bold ' + (Number(v.amount_paid) > 0 ? '' : 'muted') }, Number(v.amount_paid) > 0 ? money(v.amount_paid) : 'بدون دفع')));
      }
    }
    tableBox.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 't log' },
      h('thead', null, h('tr', null, h('th', null, 'المريض'), h('th', null, 'العلاج'), h('th', null, 'اتعمل إيه'), h('th', null, multiDay ? '' : 'التاريخ'), h('th', { class: 'money' }, 'المدفوع'))),
      tbody)));
  }
  draw();

  const doExport = () => exportExcel(`زيارات عيادة الشروق - ${range.label}`, [{ name: 'الزيارات', rows: shown.map((v) => ({
    'التاريخ': v.visit_date, 'المريض': v.patient?.full_name || '', 'التليفون': v.patient?.phone || '', 'العلاج': v.case?.treatment_name || '', 'السنة': v.case?.tooth || '',
    'اتعمل إيه': v.notes || '', 'المدفوع': Number(v.amount_paid) })) }]);

  const s = settle(monthIncome, monthExp.reduce((a, e) => a + Number(e.amount), 0));
  page.append(
    h('div', { class: 'hello' },
      h('div', null,
        h('div', { class: 'hello-title' }, `${hour < 12 ? 'صباح الخير' : 'مساء الخير'}، ${app.me.full_name} ☀️`),
        h('div', { class: 'muted' }, fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))),
    h('div', { class: 'grid kpis' },
      kpi('hero', 'activity', 'النهاردة', money(sum(todayV)), `${new Set(todayV.map((v) => v.patient_id)).size} مريض • ${todayV.length} زيارة`),
      kpi('', 'coins', `إيراد ${monthName(thisMonth())}`, money(monthIncome), `${mv.length} زيارة`),
      kpi('sun', 'pie', `صافي العيادة ${num(app.settings.clinic_share)}% — الشهر`, money(s.clinic), h('span', null, `الدكتور: `, money(s.doctor), s.expenses ? h('span', null, ' • فواتير ', money(s.expenses)) : null)),
      kpi('red', 'alert', 'متبقي عند المرضى', money(due), `${outstanding.length} علاج`)),
    h('div', { class: 'card', style: 'margin-top:18px' },
      h('div', { class: 'card-head log-head' },
        h('h3', null, 'مين جه وعمل إيه'),
        seg),
      h('div', { class: 'log-tools' }, custom, h('div', { class: 'search grow' }, icon('search'), q),
        h('button', { class: 'btn sm', onclick: doExport, title: 'تصدير Excel' }, icon('download'), 'Excel')),
      totalsBox,
      tableBox));
}
