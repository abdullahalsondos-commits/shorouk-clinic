import { h, icon, money, fmtDateShort, emptyState, input, debounce } from '../core.js';
import { app } from '../state.js';
import { patientForm } from '../forms.js';

export async function renderPatients(page, ctx) {
  const q = input({ placeholder: 'ابحث بالاسم أو رقم التليفون...', value: ctx.params.get('q') || '' });
  const body = h('div', { class: 'card' });
  const count = h('span', { class: 'muted small' });

  const load = async () => {
    const rows = await app.db.listPatients(q.value);
    if (!ctx.alive()) return;
    count.textContent = `${rows.length} مريض`;
    if (!rows.length) {
      body.replaceChildren(emptyState(q.value ? 'مفيش مريض بالاسم ده' : 'لسه مفيش مرضى. اضغط "مريض جديد" وابدأ', 'users'));
      return;
    }
    body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, h('th', null, 'المريض'), h('th', null, 'التليفون'), h('th', null, 'آخر زيارة'), h('th', null, 'علاجات شغّالة'), h('th', { class: 'money' }, 'الباقي عليه'))),
      h('tbody', null, rows.map((p) => h('tr', { class: 'clickable', onclick: () => (location.hash = '#/patients/' + p.id) },
        h('td', null, h('b', null, p.full_name), p.medical_notes ? h('span', { class: 'badge red', style: 'margin-inline-start:8px', title: p.medical_notes }, icon('alert'), 'ملاحظة طبية') : null),
        h('td', null, h('span', { class: 'num' }, p.phone || '—')),
        h('td', { class: 'muted' }, p.last_visit ? fmtDateShort(p.last_visit) : '—'),
        h('td', null, p.open_cases ? h('span', { class: 'badge' }, p.open_cases) : h('span', { class: 'muted' }, '—')),
        h('td', { class: 'money ' + (p.remaining > 0 ? 'red-t bold' : 'muted') }, p.remaining > 0 ? money(p.remaining) : 'خالص')))))));
    body.querySelectorAll('.badge.red svg').forEach((s) => (s.style.cssText = 'width:13px;height:13px'));
  };
  q.addEventListener('input', debounce(load, 250));

  page.append(
    h('div', { class: 'toolbar' },
      h('div', { class: 'search grow' }, icon('search'), q),
      count,
      h('button', { class: 'btn primary', onclick: () => patientForm({}, (p) => (location.hash = '#/patients/' + p.id)) }, icon('plus'), 'مريض جديد')),
    body);
  await load();
  setTimeout(() => q.focus(), 50);
  if (ctx.params.get('new')) {
    history.replaceState(null, '', '#/patients');
    patientForm({}, (p) => (location.hash = '#/patients/' + p.id));
  }
}
