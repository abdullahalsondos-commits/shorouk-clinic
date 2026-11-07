import { h, icon, money, num, fmtDate, fmtDateShort, thisMonth, shiftMonth, monthRange, monthName, emptyState, exportExcel, round2, today } from '../core.js';
import { app, settle } from '../state.js';
import { expenseForm } from '../forms.js';

const P = { mode: 'month', ym: null, from: null, to: null };

export async function renderAccounting(page, ctx) {
  P.ym = P.ym || thisMonth();
  if (!P.from) Object.assign(P, monthRange(P.ym));
  const range = P.mode === 'month' ? monthRange(P.ym) : { from: P.from, to: P.to };
  const label = P.mode === 'month' ? monthName(P.ym) : `من ${fmtDate(range.from)} لحد ${fmtDate(range.to)}`;

  const histFrom = monthRange(shiftMonth(thisMonth(), -11)).from;
  const [visits, newCases, outstanding, expenses, histVisits, histExp] = await Promise.all([
    app.db.listVisits(range),
    app.db.listCases(range),
    app.db.listCases({ outstanding: true }),
    app.db.listExpenses(range),
    app.db.listVisits({ from: histFrom, to: today() }),
    app.db.listExpenses({ from: histFrom, to: today() }),
  ]);
  const outPatients = await app.db.getPatientsByIds([...new Set(outstanding.map((c) => c.patient_id))]);
  if (!ctx.alive()) return;
  const pName = new Map(outPatients.map((p) => [p.id, p.full_name]));

  const total = round2(visits.reduce((a, v) => a + Number(v.amount_paid), 0));
  const expTotal = round2(expenses.reduce((a, e) => a + Number(e.amount), 0));
  const T = settle(total, expTotal);
  const live = newCases.filter((c) => c.status !== 'cancelled');
  const discounts = round2(live.reduce((a, c) => a + Number(c.discount || 0), 0));
  const due = outstanding.reduce((a, c) => a + Number(c.remaining), 0);
  const cs = Number(app.settings.clinic_share), ds = Number(app.settings.doctor_share);

  // ---- حسب نوع العلاج ----
  const byT = new Map();
  for (const v of visits) {
    const k = v.case?.treatment_name || '—';
    if (!byT.has(k)) byT.set(k, { name: k, visits: 0, patients: new Set(), collected: 0 });
    const r = byT.get(k); r.visits++; r.patients.add(v.patient_id); r.collected += Number(v.amount_paid);
  }
  const tRows = [...byT.values()].sort((a, b) => b.collected - a.collected);

  // ---- كل الشهور (آخر 12 شهر) ----
  const months = new Map();
  for (let i = 0; i < 12; i++) { const m = shiftMonth(thisMonth(), -i); months.set(m, { ym: m, visits: 0, patients: new Set(), collected: 0, exp: 0 }); }
  for (const v of histVisits) { const r = months.get(v.visit_date.slice(0, 7)); if (r) { r.visits++; r.patients.add(v.patient_id); r.collected += Number(v.amount_paid); } }
  for (const e of histExp) { const r = months.get(e.expense_date.slice(0, 7)); if (r) r.exp += Number(e.amount); }
  const mRows = [...months.values()].map((r) => ({ ...r, ...settle(r.collected, r.exp) }));
  const firstActive = mRows.map((r) => r.visits > 0 || r.exp > 0).lastIndexOf(true);
  const mShown = mRows.slice(0, Math.max(firstActive + 1, 1));

  // ---- شريط الفترة ----
  const set = (patch) => { Object.assign(P, patch); ctx.rerender(); };
  const seg = h('div', { class: 'segmented' },
    h('button', { class: P.mode === 'month' ? 'on' : '', onclick: () => set({ mode: 'month' }) }, 'شهر'),
    h('button', { class: P.mode === 'range' ? 'on' : '', onclick: () => set({ mode: 'range', from: range.from, to: range.to }) }, 'فترة مخصصة'));
  const picker = P.mode === 'month'
    ? h('div', { style: 'display:flex;gap:6px;align-items:center' },
      h('button', { class: 'btn icon-btn', title: 'الشهر اللي فات', onclick: () => set({ ym: shiftMonth(P.ym, -1) }) }, icon('chevR')),
      h('input', { type: 'month', class: 'input', style: 'width:auto', value: P.ym, onchange: (e) => e.target.value && set({ ym: e.target.value }) }),
      h('button', { class: 'btn icon-btn', title: 'الشهر الجاي', onclick: () => set({ ym: shiftMonth(P.ym, 1) }) }, icon('chevL')),
      P.ym !== thisMonth() ? h('button', { class: 'btn sm ghost', onclick: () => set({ ym: thisMonth() }) }, 'الشهر الحالي') : null)
    : h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
      h('span', { class: 'muted small' }, 'من'), h('input', { type: 'date', class: 'input', style: 'width:auto', value: P.from, onchange: (e) => e.target.value && set({ from: e.target.value }) }),
      h('span', { class: 'muted small' }, 'لحد'), h('input', { type: 'date', class: 'input', style: 'width:auto', value: P.to, onchange: (e) => e.target.value && set({ to: e.target.value }) }));

  const kpi = (cls, ic, lbl, val, hint) => h('div', { class: 'card kpi ' + cls }, h('div', { class: 'label' }, h('i', null, icon(ic)), lbl), h('div', { class: 'value' }, val), hint ? h('div', { class: 'hint' }, hint) : null);

  // ---- التقسيم الكبير ----
  const modeNote = app.settings.expenses_mode === 'clinic_only' ? 'الفواتير على العيادة بس' : 'بعد خصم الفواتير';
  const splitCard = h('div', { class: 'card split-card four' },
    h('div', { class: 'split-mid' }, h('small', null, 'اتقبض'), h('b', null, money(total)), h('div', { class: 'small muted' }, `${visits.length} زيارة`)),
    h('div', { class: 'split-mid exp' }, h('small', null, 'الفواتير'), h('b', null, expTotal ? '− ' : '', money(expTotal)), h('div', { class: 'small muted' }, `${expenses.length} فاتورة`)),
    h('div', { class: 'split-side clinic' }, h('small', null, `العيادة ${num(cs)}%`), h('b', null, money(T.clinic)), h('div', { class: 'small', style: 'opacity:.8' }, modeNote)),
    h('div', { class: 'split-side doctor' }, h('small', null, `الدكتور ${num(ds)}%`), h('b', null, money(T.doctor)), h('div', { class: 'small', style: 'opacity:.75' }, app.settings.expenses_mode === 'clinic_only' ? 'من غير خصم' : 'بعد خصم الفواتير')));

  const expCard = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', null, 'فواتير الفترة'), h('span', { class: 'badge red' }, money(expTotal)),
      h('button', { class: 'btn sm', onclick: () => expenseForm({}, ctx.rerender) }, icon('plus'), 'فاتورة'),
      h('a', { class: 'btn sm ghost', href: '#/expenses' }, 'كل الفواتير')),
    expenses.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
      h('tbody', null, expenses.map((e) => h('tr', null,
        h('td', { class: 'muted', style: 'white-space:nowrap' }, fmtDateShort(e.expense_date)), h('td', null, h('b', null, e.title)),
        h('td', { class: 'muted small' }, e.notes || ''), h('td', { class: 'money red-t bold' }, money(e.amount)))))))
      : emptyState('مفيش فواتير في الفترة دي', 'file'));

  const monthsTable = h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, h('th', null, 'الشهر'), h('th', null, 'زيارات'), h('th', null, 'مرضى'), h('th', { class: 'money' }, 'اتقبض'), h('th', { class: 'money' }, 'الفواتير'), h('th', { class: 'money' }, 'الصافي'), h('th', { class: 'money' }, `العيادة ${num(cs)}%`), h('th', { class: 'money' }, `الدكتور ${num(ds)}%`))),
    h('tbody', null, mShown.map((r) => h('tr', { class: 'clickable' + (P.mode === 'month' && r.ym === P.ym ? ' current-row' : ''), title: 'افتح الشهر ده', onclick: () => { set({ mode: 'month', ym: r.ym }); } },
      h('td', null, h('b', null, monthName(r.ym))), h('td', { class: 'num' }, r.visits), h('td', { class: 'num' }, r.patients.size),
      h('td', { class: 'money bold' }, money(r.collected)), h('td', { class: 'money red-t' }, r.exp ? money(r.exp) : '—'),
      h('td', { class: 'money' }, money(r.net)), h('td', { class: 'money', style: 'color:var(--navy);font-weight:700' }, money(r.clinic)), h('td', { class: 'money', style: 'color:#9a6b00;font-weight:700' }, money(r.doctor))))),
    h('tfoot', null, (() => { const S = mShown.reduce((a, r) => ({ v: a.v + r.visits, c: a.c + r.collected, e: a.e + r.exp, n: a.n + r.net, cl: a.cl + r.clinic, d: a.d + r.doctor }), { v: 0, c: 0, e: 0, n: 0, cl: 0, d: 0 });
      return h('tr', null, h('td', null, 'الإجمالي'), h('td', { class: 'num' }, S.v), h('td'), h('td', { class: 'money' }, money(S.c)), h('td', { class: 'money' }, money(S.e)), h('td', { class: 'money' }, money(S.n)), h('td', { class: 'money' }, money(S.cl)), h('td', { class: 'money' }, money(S.d))); })())));

  const tTable = tRows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, h('th', null, 'العلاج'), h('th', null, 'زيارات'), h('th', null, 'مرضى'), h('th', { class: 'money' }, 'اتقبض'))),
    h('tbody', null, tRows.map((r) => h('tr', null,
      h('td', null, h('span', { class: 'tx-pill', dir: 'ltr' }, r.name)), h('td', { class: 'num' }, r.visits), h('td', { class: 'num' }, r.patients.size),
      h('td', { class: 'money bold' }, money(r.collected))))),
    h('tfoot', null, h('tr', null, h('td', null, 'الإجمالي'), h('td', { class: 'num' }, visits.length), h('td', { class: 'num' }, new Set(visits.map((v) => v.patient_id)).size),
      h('td', { class: 'money' }, money(total))))))
    : emptyState('مفيش مدفوعات في الفترة دي', 'wallet');

  // ---- كل الزيارات بالتفصيل (مقفولة لحد ما تفتحها) ----
  const detailBody = h('div', { style: 'display:none' }, visits.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, ['التاريخ', 'المريض', 'العلاج', 'اتعمل إيه'].map((x) => h('th', null, x)), h('th', { class: 'money' }, 'المدفوع'))),
    h('tbody', null, visits.map((v) => { return h('tr', { class: 'clickable', onclick: () => (location.hash = '#/patients/' + v.patient_id) },
      h('td', { class: 'num' }, fmtDateShort(v.visit_date)), h('td', null, h('b', null, v.patient?.full_name)),
      h('td', null, v.case ? h('span', { class: 'tx-pill', dir: 'ltr' }, v.case.treatment_name) : '—'),
      h('td', { class: 'muted small' }, v.notes || ''), h('td', { class: 'money bold' }, money(v.amount_paid))); })))) : emptyState('مفيش زيارات', 'activity'));
  const chev = icon('chevD'); chev.style.cssText = 'width:18px;height:18px;transition:transform .2s';
  const detailHead = h('div', { class: 'card-head clickable-head', onclick: () => { const o = detailBody.style.display === 'none'; detailBody.style.display = o ? '' : 'none'; chev.style.transform = o ? 'rotate(180deg)' : ''; } },
    h('h3', null, 'كل الزيارات بالتفصيل'), h('span', { class: 'badge' }, visits.length), chev);

  // ---- المتبقي ----
  const outTable = outstanding.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, ['المريض', 'العلاج', 'آخر زيارة'].map((x) => h('th', null, x)), h('th', { class: 'money' }, 'المطلوب'), h('th', { class: 'money' }, 'اتدفع'), h('th', { class: 'money' }, 'الباقي'))),
    h('tbody', null, [...outstanding].sort((a, b) => b.remaining - a.remaining).map((c) => h('tr', { class: 'clickable', onclick: () => (location.hash = '#/patients/' + c.patient_id) },
      h('td', null, h('b', null, pName.get(c.patient_id) || '—')), h('td', null, h('span', { class: 'tx-pill', dir: 'ltr' }, c.treatment_name)),
      h('td', { class: 'muted' }, c.last_visit ? fmtDateShort(c.last_visit) : 'لسه'),
      h('td', { class: 'money' }, money(c.net_price), Number(c.discount) ? h('div', { class: 'small muted' }, 'بعد خصم ', num(c.discount)) : null),
      h('td', { class: 'money green-t' }, money(c.paid)), h('td', { class: 'money red-t bold' }, money(c.remaining))))))) : emptyState('مفيش أي فلوس متبقية عند المرضى 👌', 'check');

  const doExport = () => exportExcel(`حسابات عيادة الشروق - ${label}`, [
    { name: 'الملخص', rows: [
      { 'البند': 'إجمالي اللي اتقبض', 'المبلغ': total },
      { 'البند': 'الفواتير', 'المبلغ': expTotal },
      { 'البند': 'الصافي', 'المبلغ': T.net },
      { 'البند': `نصيب العيادة ${cs}%`, 'المبلغ': T.clinic },
      { 'البند': `نصيب الدكتور ${ds}%`, 'المبلغ': T.doctor },
      { 'البند': 'الخصومات على العلاجات الجديدة', 'المبلغ': discounts },
      { 'البند': 'متبقي عند المرضى (الكل)', 'المبلغ': round2(due) }] },
    { name: 'كل الشهور', rows: mShown.map((r) => ({ 'الشهر': r.ym, 'زيارات': r.visits, 'اتقبض': r.collected, 'الفواتير': r.exp, 'الصافي': r.net, 'العيادة': r.clinic, 'الدكتور': r.doctor })) },
    { name: 'الفواتير', rows: expenses.map((e) => ({ 'التاريخ': e.expense_date, 'الفاتورة': e.title, 'المبلغ': Number(e.amount), 'ملاحظات': e.notes || '' })) },
    { name: 'حسب العلاج', rows: tRows.map((r) => ({ 'العلاج': r.name, 'زيارات': r.visits, 'مرضى': r.patients.size, 'اتقبض': r.collected })) },
    { name: 'الزيارات', rows: visits.map((v) => ({ 'التاريخ': v.visit_date, 'المريض': v.patient?.full_name, 'التليفون': v.patient?.phone || '', 'العلاج': v.case?.treatment_name || '', 'اتعمل إيه': v.notes || '', 'المدفوع': Number(v.amount_paid) })) },
    { name: 'المتبقي عند المرضى', rows: outstanding.map((c) => ({ 'المريض': pName.get(c.patient_id) || '', 'العلاج': c.treatment_name, 'السعر': Number(c.total_price), 'الخصم': Number(c.discount || 0), 'المطلوب': Number(c.net_price), 'اتدفع': Number(c.paid), 'الباقي': Number(c.remaining) })) },
  ]);

  page.append(
    h('div', { class: 'print-only' }, h('img', { src: 'assets/logo-original.jpg', alt: '' }), h('div', null, h('h2', { style: 'margin:0' }, 'تقرير الحسابات'), h('div', null, label))),
    h('div', { class: 'toolbar no-print' }, seg, picker, h('div', { class: 'grow' }),
      h('button', { class: 'btn', onclick: doExport }, icon('download'), 'Excel'),
      h('button', { class: 'btn', onclick: () => window.print() }, icon('printer'), 'طباعة')),
    splitCard,
    h('div', { class: 'grid kpis', style: 'margin-top:16px' },
      kpi('', 'activity', 'عدد الزيارات', h('span', { class: 'num' }, visits.length), `${new Set(visits.map((v) => v.patient_id)).size} مريض — ${label}`),
      kpi('', 'tooth', 'علاجات جديدة', h('span', { class: 'num' }, live.length), h('span', null, 'قيمتها ', money(live.reduce((a, c) => a + Number(c.net_price), 0)))),
      kpi('sun', 'tag', 'الخصومات', money(discounts), 'على العلاجات اللي اتفتحت في الفترة'),
      kpi('red', 'alert', 'متبقي عند المرضى (الكل)', money(due), `${outstanding.length} علاج`)),
    h('div', { class: 'muted small', style: 'margin-top:8px' }, app.settings.expenses_mode === 'clinic_only'
      ? `الحساب: اللي اتقبض بيتقسم ${num(cs)}% للعيادة و${num(ds)}% للدكتور، والفواتير بتتخصم من نصيب العيادة.`
      : `الحساب: (اللي اتقبض − الفواتير) وبعدين بيتقسم ${num(cs)}% للعيادة و${num(ds)}% للدكتور.`),
    h('div', { class: 'grid two', style: 'margin-top:18px' },
      expCard,
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, 'حسب العلاج')), tTable)),
    h('div', { class: 'section-title' }, h('h2', null, 'كل الشهور'), h('span', { class: 'muted small no-print' }, 'اضغط على أي شهر تفتحه')),
    h('div', { class: 'card' }, monthsTable),
    h('div', { class: 'card', style: 'margin-top:18px' }, detailHead, detailBody),
    h('div', { class: 'section-title' }, h('h2', null, 'فلوس متبقية عند المرضى'), h('span', { class: 'badge red' }, money(due))),
    h('div', { class: 'card' }, outTable));
}
