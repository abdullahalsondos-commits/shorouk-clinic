import { h, icon, money, fmtDate, thisMonth, shiftMonth, monthRange, monthName, emptyState, confirmDialog, toast, errToast, exportExcel } from '../core.js';
import { app, isAdmin, userName } from '../state.js';
import { expenseForm } from '../forms.js';

let ym = null;

export async function renderExpenses(page, ctx) {
  ym = ym || thisMonth();
  const range = monthRange(ym);
  const list = await app.db.listExpenses(range);
  if (!ctx.alive()) return;
  const total = list.reduce((a, e) => a + Number(e.amount), 0);
  const go = (m) => { ym = m; ctx.rerender(); };
  const canEdit = (e) => isAdmin() || e.created_by === app.me.id;

  // تجميع حسب الاسم
  const byTitle = new Map();
  for (const e of list) byTitle.set(e.title, (byTitle.get(e.title) || 0) + Number(e.amount));
  const top = [...byTitle.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...top.map((x) => x[1]));

  page.append(
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn icon-btn', title: 'الشهر اللي فات', onclick: () => go(shiftMonth(ym, -1)) }, icon('chevR')),
      h('input', { type: 'month', class: 'input', style: 'width:auto', value: ym, onchange: (e) => e.target.value && go(e.target.value) }),
      h('button', { class: 'btn icon-btn', title: 'الشهر الجاي', onclick: () => go(shiftMonth(ym, 1)) }, icon('chevL')),
      ym !== thisMonth() ? h('button', { class: 'btn sm ghost', onclick: () => go(thisMonth()) }, 'الشهر الحالي') : null,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn', onclick: () => exportExcel(`فواتير عيادة الشروق - ${monthName(ym)}`, [{ name: 'الفواتير', rows: list.map((e) => ({ 'التاريخ': e.expense_date, 'الفاتورة': e.title, 'المبلغ': Number(e.amount), 'ملاحظات': e.notes || '', 'سجّلها': userName(e.created_by) })) }]) }, icon('download'), 'Excel'),
      h('button', { class: 'btn primary', onclick: () => expenseForm({}, ctx.rerender) }, icon('plus'), 'فاتورة جديدة')),
    h('div', { class: 'grid two' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', null, `فواتير ${monthName(ym)}`), h('span', { class: 'badge red' }, money(total))),
        list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'التاريخ'), h('th', null, 'الفاتورة'), h('th', null, 'ملاحظات'), h('th', { class: 'money' }, 'المبلغ'), h('th', null, ''))),
          h('tbody', null, list.map((e) => h('tr', null,
            h('td', { class: 'muted', style: 'white-space:nowrap' }, fmtDate(e.expense_date, { day: 'numeric', month: 'short' })),
            h('td', null, h('b', null, e.title), userName(e.created_by) ? h('div', { class: 'muted small' }, userName(e.created_by)) : null),
            h('td', { class: 'muted small', style: 'white-space:pre-wrap;max-width:280px' }, e.notes || '—'),
            h('td', { class: 'money bold red-t' }, money(e.amount)),
            h('td', { style: 'white-space:nowrap' }, canEdit(e) ? [
              h('button', { class: 'btn sm ghost icon-btn', title: 'تعديل', onclick: () => expenseForm(e, ctx.rerender) }, icon('edit')),
              h('button', { class: 'btn sm ghost icon-btn', title: 'مسح', onclick: async () => {
                if (!(await confirmDialog(`تمسح فاتورة "${e.title}"؟`, { okLabel: 'امسح' }))) return;
                try { await app.db.deleteExpense(e.id); toast('اتمسحت الفاتورة'); ctx.rerender(); } catch (err) { errToast(err); }
              } }, icon('trash'))] : null)))),
          h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, `الإجمالي — ${list.length} فاتورة`), h('td', { class: 'money' }, money(total)), h('td')))))
          : emptyState('مفيش فواتير الشهر ده. اضغط "فاتورة جديدة"', 'file')),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', null, 'الفلوس راحت فين')),
        top.length ? h('div', { class: 'bars' }, top.map(([t, v]) => h('div', { class: 'b-row' },
          h('span', null, t), h('div', { class: 'b-track' }, h('i', { style: `width:${(v / max) * 100}%;background:linear-gradient(90deg,#f6b623,#e8890c)` })), h('b', null, money(v, false)))))
          : emptyState('لسه مفيش', 'pie'),
        h('div', { class: 'muted small', style: 'padding:0 22px 16px' },
          app.settings.expenses_mode === 'clinic_only'
            ? 'الفواتير بتتخصم من نصيب العيادة بس (تقدر تغيّر ده من الإعدادات).'
            : 'الفواتير بتتخصم من الإجمالي قبل تقسيم العيادة والدكتور (تقدر تغيّر ده من الإعدادات).'))));
}
