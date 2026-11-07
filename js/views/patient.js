import { h, icon, money, num, fmtDate, fmtDateShort, emptyState, confirmDialog, toast, errToast, initials, textarea } from '../core.js';
import { app, userName, isAdmin } from '../state.js';
import { patientForm, caseForm, visitForm, canEditVisit } from '../forms.js';

const CASE_STATUS = { open: ['شغّال', ''], done: ['خلص', 'green'], cancelled: ['اتلغى', 'gray'] };

export async function renderPatient(page, ctx) {
  const id = Number(ctx.arg);
  const [p, cases, visits, notes] = await Promise.all([
    app.db.getPatient(id),
    app.db.listCases({ patientId: id }),
    app.db.listVisits({ patientId: id }),
    app.db.listNotes(id),
  ]);
  if (!ctx.alive()) return;
  if (!p) { page.append(emptyState('المريض ده مش موجود', 'users')); return; }
  ctx.setTitle(p.full_name);
  const reload = () => ctx.rerender();
  const totalDiscount = cases.filter((c) => c.status !== 'cancelled').reduce((a, c) => a + Number(c.discount || 0), 0);

  const genderLabel = p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : null;
  const head = h('div', { class: 'card' },
    h('div', { class: 'patient-head' },
      h('div', { class: 'big-avatar' }, initials(p.full_name)),
      h('div', { class: 'info' },
        h('h2', null, p.full_name),
        h('div', { class: 'meta' },
          p.phone ? h('span', null, icon('phone'), h('a', { href: 'tel:' + p.phone, class: 'num' }, p.phone)) : null,
          p.age ? h('span', null, icon('user'), `${p.age} سنة`, genderLabel ? ` — ${genderLabel}` : '') : genderLabel ? h('span', null, icon('user'), genderLabel) : null,
          p.address ? h('span', null, icon('pin'), p.address) : null,
          h('span', null, icon('calendar'), 'مسجل من ', fmtDate(p.created_at))),
        p.medical_notes ? h('div', { class: 'alert-med' }, icon('alert'), h('div', null, h('b', null, 'ملاحظات طبية: '), p.medical_notes)) : null,
        p.notes ? h('div', { class: 'note-box' }, p.notes) : null),
      h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
        h('button', { class: 'btn sm', onclick: () => patientForm(p, reload) }, icon('edit'), 'تعديل'),
        isAdmin() ? h('button', { class: 'btn sm danger', title: 'مسح المريض', onclick: async () => {
          if (!(await confirmDialog(`متأكد إنك عايز تمسح ${p.full_name} وكل زياراته ومدفوعاته؟ الحركة دي مش هترجع.`, { okLabel: 'امسح نهائياً' }))) return;
          try { await app.db.deletePatient(p.id); toast('اتمسح المريض'); location.hash = '#/patients'; } catch (e) { errToast(e); }
        } }, icon('trash')) : null)),
    h('div', { class: 'money-strip four' },
      h('div', null, h('small', null, 'إجمالي العلاج'), h('b', null, money(p.total_due))),
      h('div', null, h('small', null, 'الخصومات'), h('b', { class: totalDiscount ? 'sun-t' : 'muted' }, money(totalDiscount))),
      h('div', null, h('small', null, 'المدفوع'), h('b', { class: 'green-t' }, money(p.total_paid))),
      h('div', null, h('small', null, 'الباقي عليه'), h('b', { class: p.remaining > 0 ? 'red-t' : '' }, money(p.remaining)))));

  const actions = h('div', { class: 'toolbar', style: 'margin-top:18px' },
    h('button', { class: 'btn primary', onclick: () => caseForm(p, null, reload) }, icon('plus'), 'علاج جديد'),
    h('button', { class: 'btn sun', onclick: () => visitForm(p, cases, {}, reload) }, icon('coins'), 'زيارة / دفعة'));

  // ---------- العلاجات ----------
  const vByCase = new Map();
  for (const v of visits) { if (!vByCase.has(v.case_id)) vByCase.set(v.case_id, []); vByCase.get(v.case_id).push(v); }
  const caseCards = cases.map((c) => {
    const net = Number(c.net_price);
    const pct = net > 0 ? Math.min(100, (c.paid / net) * 100) : (c.paid > 0 || c.status === 'done' ? 100 : 0);
    const st = CASE_STATUS[c.status];
    const vs = vByCase.get(c.id) || [];
    const bar = h('i', { style: 'width:0%' });
    requestAnimationFrame(() => setTimeout(() => (bar.style.width = pct + '%'), 60));
    return h('div', { class: 'card case ' + c.status },
      h('div', { class: 'case-top' },
        h('div', { class: 'case-icon' }, icon('tooth')),
        h('div', { class: 'case-title' },
          h('div', null, h('b', { class: 'tx-name', dir: 'ltr' }, c.treatment_name), c.tooth ? h('span', { class: 'muted' }, ' — ' + c.tooth) : null, ' ', h('span', { class: 'badge ' + st[1] }, st[0])),
          h('div', { class: 'muted small' }, 'بدأ ', fmtDateShort(c.created_at), ` • ${c.visits_count} زيارة`),
          c.notes ? h('div', { class: 'small', style: 'margin-top:4px;white-space:pre-wrap' }, c.notes) : null),
        h('div', { class: 'case-money' },
          Number(c.discount) > 0 ? h('div', { class: 'small muted' }, 'السعر ', h('s', null, num(c.total_price)), ' ', h('span', { class: 'badge amber' }, icon('tag'), 'خصم ', num(c.discount))) : null,
          h('div', { class: 'small muted' }, 'اتدفع ', h('b', { class: 'green-t' }, money(c.paid)), ' من ', h('b', null, money(net))),
          h('div', { class: 'progress' }, bar),
          c.status !== 'cancelled' && c.remaining > 0 ? h('div', { class: 'small red-t bold', style: 'margin-top:4px' }, 'الباقي ', money(c.remaining)) : h('div', { class: 'small green-t bold', style: 'margin-top:4px' }, c.status === 'cancelled' ? '' : 'خالص ✓'))),
      vs.length ? h('div', { class: 'case-visits' }, vs.map((v) => h('div', { class: 'visit-line' },
        h('span', { class: 'dot' }),
        h('div', { class: 'v-main' },
          h('div', null, h('b', null, fmtDate(v.visit_date))),
          v.notes ? h('div', { class: 'v-notes' }, v.notes) : null),
        h('b', { class: Number(v.amount_paid) > 0 ? 'green-t' : 'muted' }, Number(v.amount_paid) > 0 ? money(v.amount_paid) : 'بدون دفع'),
        canEditVisit(v) ? h('button', { class: 'btn sm ghost icon-btn', title: 'تعديل', onclick: () => visitForm(p, cases, { visit: v }, reload) }, icon('edit')) : null,
        canEditVisit(v) ? h('button', { class: 'btn sm ghost icon-btn', title: 'مسح', onclick: async () => {
          if (!(await confirmDialog('تمسح الزيارة دي؟ المبلغ بتاعها هيتشال من الحسابات.', { okLabel: 'امسح' }))) return;
          try { await app.db.deleteVisit(v.id); toast('اتمسحت الزيارة'); reload(); } catch (e) { errToast(e); }
        } }, icon('trash')) : null))) : null,
      h('div', { class: 'case-actions' },
        c.status === 'open' ? h('button', { class: 'btn sm sun', onclick: () => visitForm(p, cases, { caseId: c.id }, reload) }, icon('coins'), 'سجّل زيارة / دفعة') : null,
        c.status === 'open' ? h('button', { class: 'btn sm', onclick: async () => { try { await app.db.saveCase({ id: c.id, status: 'done' }); toast('اتقفل العلاج'); reload(); } catch (e) { errToast(e); } } }, icon('check'), 'العلاج خلص') : null,
        c.status !== 'open' ? h('button', { class: 'btn sm', onclick: async () => { try { await app.db.saveCase({ id: c.id, status: 'open' }); reload(); } catch (e) { errToast(e); } } }, 'افتحه تاني') : null,
        h('button', { class: 'btn sm ghost', onclick: () => caseForm(p, c, reload) }, icon('edit'), 'تعديل / خصم'),
        isAdmin() ? h('button', { class: 'btn sm ghost', style: 'color:var(--red)', onclick: async () => {
          if (!(await confirmDialog(`تمسح علاج "${c.treatment_name}" وكل زياراته (${vs.length})؟`, { okLabel: 'امسح' }))) return;
          try { await app.db.deleteCase(c.id); toast('اتمسح العلاج'); reload(); } catch (e) { errToast(e); }
        } }, icon('trash'), 'مسح') : null));
  });

  page.append(head, actions,
    h('div', { class: 'patient-grid' },
      h('div', null,
        h('div', { class: 'section-title' }, h('h2', null, 'العلاجات والزيارات'), h('span', { class: 'muted small' }, `${cases.length} علاج • ${visits.length} زيارة`)),
        ...(cases.length ? caseCards : [h('div', { class: 'card' }, emptyState('لسه مفيش علاجات. اضغط "علاج جديد" وسجّل أول دفعة', 'tooth'))])),
      notesPanel(p, notes, reload)));
}

// ---------- الملاحظات الحرة ----------
function notesPanel(p, notes, reload) {
  const box = textarea({ placeholder: 'اكتب أي حاجة عن المريض...', rows: 3 });
  const add = h('button', { class: 'btn primary sm' }, icon('plus'), 'حفظ الملاحظة');
  const save = async () => {
    const body = box.value.trim();
    if (!body) return box.focus();
    add.disabled = true;
    try { await app.db.saveNote({ patient_id: p.id, body }); toast('اتحفظت الملاحظة'); reload(); }
    catch (e) { errToast(e); add.disabled = false; }
  };
  add.addEventListener('click', save);
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); });
  const canEdit = (n) => isAdmin() || n.created_by === app.me.id;

  const item = (n) => {
    const el = h('div', { class: 'pnote' });
    const view = () => el.replaceChildren(
      h('div', { class: 'pnote-body' }, n.body),
      h('div', { class: 'pnote-meta' },
        h('span', null, userName(n.created_by) ? userName(n.created_by) + ' • ' : '', fmtDate(n.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), n.updated_at ? ' (اتعدلت)' : ''),
        canEdit(n) ? h('span', { class: 'pnote-actions' },
          h('button', { class: 'btn sm ghost icon-btn', title: 'تعديل', onclick: edit }, icon('edit')),
          h('button', { class: 'btn sm ghost icon-btn', title: 'مسح', onclick: async () => {
            if (!(await confirmDialog('تمسح الملاحظة دي؟', { okLabel: 'امسح' }))) return;
            try { await app.db.deleteNote(n.id); toast('اتمسحت'); reload(); } catch (e) { errToast(e); }
          } }, icon('trash'))) : null));
    const edit = () => {
      const t = textarea({ value: n.body, rows: 4 });
      el.replaceChildren(t, h('div', { style: 'display:flex;gap:6px;margin-top:8px' },
        h('button', { class: 'btn sm primary', onclick: async () => {
          if (!t.value.trim()) return;
          try { await app.db.saveNote({ id: n.id, body: t.value.trim() }); toast('اتحفظ'); reload(); } catch (e) { errToast(e); }
        } }, icon('check'), 'حفظ'),
        h('button', { class: 'btn sm ghost', onclick: view }, 'إلغاء')));
      t.focus();
    };
    view();
    return el;
  };

  return h('aside', { class: 'card notes-panel' },
    h('div', { class: 'card-head' }, icon('note'), h('h3', null, 'ملاحظات'), h('span', { class: 'badge' }, notes.length)),
    h('div', { class: 'notes-new' }, box, h('div', { class: 'notes-new-foot' }, h('span', { class: 'muted small' }, 'Ctrl + Enter للحفظ'), add)),
    h('div', { class: 'notes-list' }, notes.length ? notes.map(item) : h('div', { class: 'muted small', style: 'padding:6px 4px 14px' }, 'مفيش ملاحظات لسه. اكتب أي حاجة عايز تفتكرها عن المريض.')));
}
