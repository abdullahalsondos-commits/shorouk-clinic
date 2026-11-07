// ===== النماذج المشتركة (مريض / علاج / زيارة / ميعاد) =====
import { h, icon, modal, field, input, textarea, select, toast, required, toNum, money, moneyText, today, num } from './core.js';
import { app, isAdmin } from './state.js';

// ---------- مريض ----------
export function patientForm(p = {}, onSaved) {
  const f = {
    full_name: input({ value: p.full_name || '', placeholder: 'الاسم بالكامل' }),
    phone: input({ value: p.phone || '', type: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr', style: 'text-align:right' }),
    age: input({ value: p.age ?? '', type: 'number', min: 0, max: 120 }),
    gender: select([{ value: '', label: '—' }, { value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }], p.gender || ''),
    address: input({ value: p.address || '' }),
    medical_notes: textarea({ value: p.medical_notes || '', placeholder: 'حساسية من أدوية، سكر، ضغط، حمل...' }),
    notes: textarea({ value: p.notes || '', placeholder: 'أي ملاحظات عامة' }),
  };
  modal({
    title: p.id ? 'تعديل بيانات المريض' : 'مريض جديد',
    body: h('div', null,
      field('اسم المريض', f.full_name),
      h('div', { class: 'row' }, field('رقم التليفون', f.phone), field('السن', f.age)),
      h('div', { class: 'row' }, field('النوع', f.gender), field('العنوان', f.address)),
      field('ملاحظات طبية', f.medical_notes, '(بتظهر بالأحمر في ملف المريض)'),
      field('ملاحظات', f.notes)),
    actions: [{
      label: p.id ? 'حفظ التعديلات' : 'إضافة المريض', cls: 'primary', icon: 'check',
      run: async () => {
        const row = await app.db.savePatient({
          id: p.id, full_name: required(f.full_name.value, 'اسم المريض'), phone: f.phone.value.trim(),
          age: f.age.value ? parseInt(f.age.value) : null, gender: f.gender.value || null, address: f.address.value.trim(),
          medical_notes: f.medical_notes.value.trim(), notes: f.notes.value.trim(),
        });
        toast(p.id ? 'اتحفظت التعديلات' : 'اتضاف المريض');
        onSaved && onSaved(row);
      },
    }],
  });
}

// ---------- علاج جديد (حالة) ----------
export async function caseForm(patient, c = null, onSaved) {
  const treatments = (await app.db.listTreatments()).filter((t) => t.active || t.id === c?.treatment_id);
  const OTHER = '__other';
  const tSel = select([{ value: '', label: '— اختار العلاج —' }, ...treatments.map((t) => ({ value: t.id, label: `${t.name}  (${num(t.default_price)})` })), { value: OTHER, label: '➕ علاج تاني (اكتب اسمه)' }],
    c ? (c.treatment_id && treatments.some((t) => t.id === c.treatment_id) ? c.treatment_id : OTHER) : '');
  const customName = input({ value: c && (!c.treatment_id || !treatments.some((t) => t.id === c.treatment_id)) ? c.treatment_name : '', placeholder: 'اسم العلاج' });
  const customWrap = field('اسم العلاج', customName);
  const price = input({ type: 'number', min: 0, value: c ? c.total_price : '' });
  const discount = input({ type: 'number', min: 0, value: c && Number(c.discount) ? c.discount : '', placeholder: '0' });
  const netOut = h('div', { class: 'net-box' });
  const showNet = () => {
    const p = toNum(price.value), d = toNum(discount.value);
    netOut.replaceChildren(h('span', null, 'المطلوب بعد الخصم'), h('b', null, money(Math.max(p - d, 0))),
      d > p ? h('em', { class: 'red-t small' }, 'الخصم أكبر من السعر!') : d > 0 ? h('em', { class: 'green-t small' }, `خصم ${num(d)}`) : null);
  };
  price.addEventListener('input', showNet); discount.addEventListener('input', showNet);
  const tooth = input({ value: c?.tooth || '', placeholder: 'مثلاً: 6 علوي يمين' });
  const status = select([{ value: 'open', label: 'شغّال' }, { value: 'done', label: 'خلص' }, { value: 'cancelled', label: 'اتلغى' }], c?.status || 'open');
  const notes = textarea({ value: c?.notes || '', placeholder: 'خطة العلاج، عدد الجلسات المتوقع...' });
  const sync = () => {
    customWrap.style.display = tSel.value === OTHER ? '' : 'none';
    const t = treatments.find((x) => String(x.id) === tSel.value);
    if (t && !c) price.value = t.default_price;
    showNet();
  };
  tSel.addEventListener('change', sync); sync();

  // دفعة أولى + ميعاد (للعلاج الجديد بس)
  const pay = input({ type: 'number', min: 0, placeholder: '0' });
  const payNotes = input({ placeholder: 'اتعمل إيه في الزيارة دي' });
  const payDate = input({ type: 'date', value: today() });
  const nowBlock = c ? null : h('div', { class: 'card card-pad', style: 'background:var(--surface-2);box-shadow:none;margin-bottom:14px' },
    h('div', { class: 'bold', style: 'margin-bottom:10px' }, 'زيارة النهاردة والدفع'),
    h('div', { class: 'row' }, field('المبلغ المدفوع دلوقتي', pay, '(سيبه فاضي لو مدفعش)'), field('تاريخ الزيارة', payDate)),
    field('اتعمل إيه', payNotes));

  modal({
    title: c ? 'تعديل العلاج' : `علاج جديد — ${patient.full_name}`,
    wide: true,
    body: h('div', null,
      field('العلاج', tSel),
      customWrap,
      h('div', { class: 'row' }, field('السعر', price), field('الخصم', discount, '(اختياري)')),
      netOut,
      field('السنة / المكان', tooth),
      c ? field('الحالة', status) : null,
      field('ملاحظات', notes),
      nowBlock),
    actions: [{
      label: c ? 'حفظ' : 'فتح العلاج', cls: 'primary', icon: 'check',
      run: async () => {
        const t = treatments.find((x) => String(x.id) === tSel.value);
        if (!tSel.value) throw new Error('اختار العلاج');
        const name = t ? t.name : required(customName.value, 'اسم العلاج');
        const saved = await app.db.saveCase({
          id: c?.id, patient_id: patient.id, treatment_id: t ? t.id : null, treatment_name: name,
          tooth: tooth.value.trim(), total_price: toNum(price.value), discount: Math.min(toNum(discount.value), toNum(price.value)),
          status: c ? status.value : 'open', notes: notes.value.trim(),
        });
        if (!c) {
          const amt = toNum(pay.value);
          if (amt > 0 || payNotes.value.trim()) {
            await app.db.saveVisit({ case_id: saved.id, patient_id: patient.id, visit_date: payDate.value || today(), amount_paid: amt, notes: payNotes.value.trim() });
          }
        }
        toast(c ? 'اتحفظ العلاج' : 'اتفتح العلاج');
        onSaved && onSaved(saved);
      },
    }],
  });
}

// ---------- زيارة / دفعة ----------
export function visitForm(patient, cases, { caseId, visit } = {}, onSaved) {
  const usable = cases.filter((c) => c.status === 'open' || c.id === (visit?.case_id ?? caseId));
  if (!usable.length) {
    toast('افتح علاج للمريض الأول، وبعدين سجّل الزيارة عليه', 'err');
    return;
  }
  const cSel = select(usable.map((c) => ({ value: c.id, label: `${c.treatment_name}${c.tooth ? ' — ' + c.tooth : ''}  (الباقي ${num(c.remaining)})` })), visit?.case_id ?? caseId ?? usable[0].id);
  const date = input({ type: 'date', value: visit?.visit_date || today() });
  const amount = input({ type: 'number', min: 0, value: visit ? visit.amount_paid : '', placeholder: '0' });
  const notes = textarea({ value: visit?.notes || '', placeholder: 'اتعمل إيه في الزيارة' });
  const extraDisc = input({ type: 'number', min: 0, placeholder: '0' });
  const done = h('input', { type: 'checkbox' });
  const hint = h('div', { class: 'hint-line' });
  const cur = () => usable.find((c) => String(c.id) === cSel.value);
  const refresh = () => {
    const c = cur();
    const rem = c.remaining + (visit && visit.case_id === c.id ? Number(visit.amount_paid) : 0);
    hint.replaceChildren(
      h('span', null, 'المطلوب ', money(c.net_price), Number(c.discount) ? h('span', { class: 'muted' }, ` (بعد خصم ${num(c.discount)})`) : null, ' — اتدفع ', money(c.paid - (visit && visit.case_id === c.id ? Number(visit.amount_paid) : 0)), ' — الباقي ', h('b', null, money(rem))),
      rem > 0 ? h('button', { type: 'button', class: 'btn sm', onclick: () => { amount.value = Math.max(rem - toNum(extraDisc.value), 0); } }, 'دفع الباقي كله') : null);
  };
  cSel.addEventListener('change', refresh); refresh();

  modal({
    title: visit ? 'تعديل الزيارة' : `زيارة / دفعة — ${patient.full_name}`,
    body: h('div', null,
      field('العلاج', cSel),
      field('تاريخ الزيارة', date),
      h('div', { class: 'row' }, field('المبلغ المدفوع', amount), visit ? h('div') : field('خصم على العلاج', extraDisc, '(اختياري)')), hint,
      field('اتعمل إيه', notes),
      visit ? null : h('label', { class: 'check' }, done, 'العلاج ده خلص (اقفله)')),
    actions: [{
      label: 'حفظ الزيارة', cls: 'primary', icon: 'check',
      run: async () => {
        const c = cur();
        const amt = toNum(amount.value);
        await app.db.saveVisit({ id: visit?.id, case_id: c.id, patient_id: patient.id, visit_date: date.value || today(), amount_paid: amt, notes: notes.value.trim() });
        const ed = toNum(extraDisc.value);
        const patch = {};
        if (!visit && ed > 0) patch.discount = Math.min(Number(c.discount || 0) + ed, Number(c.total_price));
        if (!visit && done.checked) patch.status = 'done';
        if (Object.keys(patch).length) await app.db.saveCase({ id: c.id, ...patch });
        toast(amt > 0 ? `اتسجلت دفعة ${moneyText(amt)}` + (ed > 0 ? ` وخصم ${moneyText(ed)}` : '') : 'اتسجلت الزيارة');
        onSaved && onSaved();
      },
    }],
  });
}

export const canEditVisit = (v) => isAdmin() || v.created_by === app.me.id;

// ---------- فاتورة / مصروف ----------
const EXPENSE_SUGGEST = ['إيجار', 'كهربا', 'مية', 'إنترنت', 'خامات', 'معمل', 'مرتبات', 'صيانة', 'أدوات تعقيم', 'نضافة'];
export function expenseForm(e = {}, onSaved) {
  const listId = 'exp-suggest';
  const title = input({ value: e.title || '', placeholder: 'مثلاً: خامات، معمل، إيجار...', list: listId });
  const dl = h('datalist', { id: listId }, EXPENSE_SUGGEST.map((x) => h('option', { value: x })));
  const amount = input({ type: 'number', min: 0, value: e.amount ?? '', placeholder: '0' });
  const date = input({ type: 'date', value: e.expense_date || today() });
  const notes = textarea({ value: e.notes || '', placeholder: 'أي تفاصيل: اتدفعت لمين، رقم الفاتورة...' });
  modal({
    title: e.id ? 'تعديل الفاتورة' : 'فاتورة جديدة',
    body: h('div', null, field('اسم الفاتورة', title), dl,
      h('div', { class: 'row' }, field('المبلغ', amount), field('التاريخ', date)),
      field('ملاحظات', notes, '(اختياري)')),
    actions: [{
      label: e.id ? 'حفظ' : 'إضافة الفاتورة', cls: 'primary', icon: 'check',
      run: async () => {
        const amt = toNum(amount.value);
        if (amt <= 0) throw new Error('اكتب مبلغ الفاتورة');
        await app.db.saveExpense({ id: e.id, title: required(title.value, 'اسم الفاتورة'), amount: amt, expense_date: date.value || today(), notes: notes.value.trim() });
        toast(e.id ? 'اتحفظت الفاتورة' : `اتضافت فاتورة ${moneyText(amt)}`);
        onSaved && onSaved();
      },
    }],
  });
}
