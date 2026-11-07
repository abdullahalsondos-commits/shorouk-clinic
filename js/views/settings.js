import { h, icon, modal, field, input, select, toast, errToast, required, toNum, money, fmtDate, emptyState, exportExcel, confirmDialog, today } from '../core.js';
import { app, refreshUsers, loadShared } from '../state.js';

let tab = 'users';

export async function renderSettings(page, ctx) {
  const tabs = [['users', 'المستخدمين'], ['treatments', 'العلاجات والأسعار'], ['shares', 'نسب التقسيم'], ['backup', 'نسخة احتياطية']];
  const body = h('div');
  page.append(h('div', { class: 'tabs' }, tabs.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; ctx.rerender(); } }, l))), body);
  await ({ users, treatments, shares, backup })[tab](body, ctx);
}

// ---------- المستخدمين ----------
async function users(body, ctx) {
  await refreshUsers();
  if (!ctx.alive()) return;
  const list = app.users;
  body.append(
    h('div', { class: 'toolbar' }, h('div', { class: 'grow muted small' }, 'كل واحد بيدخل باسم المستخدم والباسورد بتوعه. المستخدم العادي يشوف كل حاجة ويسجّل مرضى وزيارات، والمسح والإعدادات للمدير بس.'),
      h('button', { class: 'btn primary', onclick: () => addUser(ctx) }, icon('plus'), 'إضافة مستخدم')),
    h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, ['الاسم', 'اسم المستخدم', 'الصلاحية', 'الحالة', ''].map((x) => h('th', null, x)))),
      h('tbody', null, list.map((u) => {
        const self = u.id === app.me.id;
        return h('tr', null,
          h('td', null, h('b', null, u.full_name), self ? h('span', { class: 'badge', style: 'margin-inline-start:6px' }, 'إنت') : null),
          h('td', null, h('span', { class: 'num' }, u.username || (u.email || '').split('@')[0])),
          h('td', null, u.role === 'admin' ? h('span', { class: 'badge amber' }, 'مدير') : h('span', { class: 'badge' }, 'مستخدم')),
          h('td', null, u.active ? h('span', { class: 'badge green' }, 'شغّال') : h('span', { class: 'badge red' }, 'متوقف')),
          h('td', { style: 'white-space:nowrap' },
            h('button', { class: 'btn sm ghost', onclick: () => editUser(u, ctx) }, icon('edit'), 'تعديل'),
            h('button', { class: 'btn sm ghost', onclick: () => resetPw(u) }, icon('key'), 'باسورد'),
            self ? null : h('button', { class: 'btn sm ghost', style: u.active ? 'color:var(--red)' : '', onclick: async () => {
              if (u.active && !(await confirmDialog(`توقف حساب ${u.full_name}؟ مش هيقدر يدخل السيستم، بس شغله القديم هيفضل في الحسابات.`, { okLabel: 'وقّف الحساب' }))) return;
              try { await app.db.adminUser('active', { id: u.id, active: !u.active }); toast(u.active ? 'اتوقف الحساب' : 'اتفعّل الحساب'); ctx.rerender(); } catch (e) { errToast(e); }
            } }, u.active ? 'إيقاف' : 'تفعيل')));
      }))))));
}

function addUser(ctx) {
  const name = input({ placeholder: 'الاسم' });
  const uname = input({ dir: 'ltr', placeholder: 'ahmed', autocapitalize: 'none', spellcheck: 'false', style: 'text-align:right' });
  const pw = input({ type: 'text', dir: 'ltr', placeholder: '6 حروف على الأقل', style: 'text-align:right' });
  const role = select([{ value: 'doctor', label: 'مستخدم عادي' }, { value: 'admin', label: 'مدير (يقدر يضيف مستخدمين ويمسح)' }], 'doctor');
  modal({
    title: 'إضافة مستخدم جديد',
    body: h('div', null, field('الاسم', name),
      field('اسم المستخدم', uname, '(إنجليزي، من غير مسافات — ده اللي هيدخل بيه)'),
      field('الباسورد', pw, '(يقدر يغيّره بعد كده من زرار المفتاح)'), field('الصلاحية', role)),
    actions: [{ label: 'إضافة', cls: 'primary', icon: 'check', run: async () => {
      const full_name = required(name.value, 'الاسم');
      const username = required(uname.value, 'اسم المستخدم').toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('اسم المستخدم لازم يكون حروف إنجليزي أو أرقام (3 حروف على الأقل) من غير مسافات');
      if (pw.value.length < 6) throw new Error('الباسورد لازم يكون 6 حروف على الأقل');
      await app.db.adminUser('create', { full_name, username, password: pw.value, role: role.value });
      toast(`اتضاف ${full_name} — يدخل بـ ${username}`);
      ctx.rerender();
    } }],
  });
}

function editUser(u, ctx) {
  const name = input({ value: u.full_name });
  const role = select([{ value: 'doctor', label: 'مستخدم عادي' }, { value: 'admin', label: 'مدير' }], u.role, u.id === app.me.id ? { disabled: true } : {});
  modal({
    title: 'تعديل ' + u.full_name,
    body: h('div', null, field('الاسم', name), field('الصلاحية', role)),
    actions: [{ label: 'حفظ', cls: 'primary', icon: 'check', run: async () => {
      await app.db.updateProfile(u.id, { full_name: required(name.value, 'الاسم'), role: role.value });
      if (u.id === app.me.id) Object.assign(app.me, { full_name: name.value.trim() });
      toast('اتحفظ'); ctx.rerender();
    } }],
  });
}

function resetPw(u) {
  const pw = input({ type: 'text', dir: 'ltr', style: 'text-align:right' });
  modal({
    title: 'باسورد جديد لـ ' + u.full_name,
    body: field('الباسورد الجديد', pw, '(6 حروف على الأقل)'),
    actions: [{ label: 'حفظ', cls: 'primary', icon: 'check', run: async () => {
      if (pw.value.length < 6) throw new Error('الباسورد لازم يكون 6 حروف على الأقل');
      await app.db.adminUser('password', { id: u.id, password: pw.value });
      toast('اتغير الباسورد');
    } }],
  });
}

// ---------- العلاجات ----------
async function treatments(body, ctx) {
  const list = await app.db.listTreatments();
  if (!ctx.alive()) return;
  const edit = (t = {}) => {
    const name = input({ value: t.name || '' });
    const price = input({ type: 'number', min: 0, value: t.default_price ?? '' });
    const active = h('input', { type: 'checkbox', checked: t.id ? t.active : true });
    modal({
      title: t.id ? 'تعديل العلاج' : 'علاج جديد',
      body: h('div', null, field('اسم العلاج', name), field('السعر الافتراضي', price, '(تقدر تغيّره لكل مريض)'), h('label', { class: 'check' }, active, 'متاح للاختيار')),
      actions: [
        { label: 'حفظ', cls: 'primary', icon: 'check', run: async () => { await app.db.saveTreatment({ id: t.id, name: required(name.value, 'اسم العلاج'), default_price: toNum(price.value), active: active.checked }); toast('اتحفظ'); ctx.rerender(); } },
        t.id && { label: 'مسح', cls: 'danger', icon: 'trash', run: async () => { await app.db.deleteTreatment(t.id); toast('اتمسح'); ctx.rerender(); } },
      ].filter(Boolean),
    });
  };
  body.append(
    h('div', { class: 'toolbar' }, h('div', { class: 'grow muted small' }, 'الأسعار دي بتتملى لوحدها لما تفتح علاج لمريض، وتقدر تعدّلها وقتها.'),
      h('button', { class: 'btn primary', onclick: () => edit() }, icon('plus'), 'علاج جديد')),
    h('div', { class: 'card' }, list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, h('th', null, 'العلاج'), h('th', { class: 'money' }, 'السعر'), h('th', null, 'الحالة'), h('th', null, ''))),
      h('tbody', null, list.map((t) => h('tr', { class: 'clickable', onclick: () => edit(t) },
        h('td', null, h('b', null, t.name)), h('td', { class: 'money' }, money(t.default_price)),
        h('td', null, t.active ? h('span', { class: 'badge green' }, 'متاح') : h('span', { class: 'badge gray' }, 'مخفي')),
        h('td', null, h('span', { class: 'btn sm ghost' }, icon('edit'))))))))
      : emptyState('مفيش علاجات', 'tooth')));
}

// ---------- النسب ----------
async function shares(body, ctx) {
  const s = app.settings;
  const clinic = input({ type: 'number', min: 0, max: 100, value: s.clinic_share });
  const docOut = h('b', { class: 'num' }, (100 - Number(s.clinic_share)) + '%');
  const cur = input({ value: s.currency || 'ج.م' });
  const mode = select([{ value: 'before_split', label: 'من الإجمالي قبل التقسيم (العيادة والدكتور يشيلوها بالنسبة)' }, { value: 'clinic_only', label: 'من نصيب العيادة بس' }], s.expenses_mode || 'before_split');
  clinic.addEventListener('input', () => { docOut.textContent = (100 - toNum(clinic.value)) + '%'; });
  body.append(h('div', { class: 'card card-pad', style: 'max-width:520px' },
    h('p', { class: 'muted', style: 'margin-top:0' }, 'كل فلوس بتتقبض بتتقسم: نسبة للعيادة، والباقي للدكتور.'),
    h('div', { class: 'row' }, field('نسبة العيادة %', clinic), h('div', { class: 'field' }, h('span', null, 'نسبة الدكتور'), h('div', { class: 'input', style: 'background:var(--surface-2)' }, docOut))),
    field('الفواتير بتتخصم منين؟', mode),
    field('العملة', cur),
    h('div', { class: 'muted small', style: 'margin-bottom:14px' }, '⚠️ لو غيّرت النسبة أو طريقة خصم الفواتير، الحسابات القديمة كمان هتتحسب بالطريقة الجديدة لما تفتحها.'),
    h('button', { class: 'btn primary', onclick: async () => {
      const c = toNum(clinic.value);
      if (c < 0 || c > 100) return toast('النسبة لازم تبقى بين 0 و 100', 'err');
      try { await app.db.updateSettings({ clinic_share: c, doctor_share: 100 - c, currency: cur.value.trim() || 'ج.م', expenses_mode: mode.value }); await loadShared(); toast('اتحفظت النسب'); ctx.rerender(); } catch (e) { errToast(e); }
    } }, icon('check'), 'حفظ')));
}

// ---------- نسخة احتياطية ----------
async function backup(body) {
  const btn = h('button', { class: 'btn primary' }, icon('download'), 'نزّل نسخة كاملة (Excel)');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const d = await app.db.exportAll();
      const userOf = (id) => app.users.find((u) => u.id === id)?.full_name || '';
      const pn = new Map(d.patients.map((p) => [p.id, p.full_name]));
      await exportExcel(`نسخة احتياطية عيادة الشروق ${today()}`, [
        { name: 'المرضى', rows: d.patients.map((p) => ({ 'رقم': p.id, 'الاسم': p.full_name, 'التليفون': p.phone || '', 'السن': p.age ?? '', 'النوع': p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '', 'العنوان': p.address || '', 'ملاحظات طبية': p.medical_notes || '', 'ملاحظات': p.notes || '', 'تاريخ التسجيل': (p.created_at || '').slice(0, 10) })) },
        { name: 'العلاجات', rows: d.cases.map((c) => ({ 'رقم': c.id, 'المريض': pn.get(c.patient_id) || c.patient_id, 'العلاج': c.treatment_name, 'السنة': c.tooth || '', 'السعر': Number(c.total_price), 'الخصم': Number(c.discount || 0), 'المطلوب': Number(c.net_price), 'اتدفع': Number(c.paid), 'الباقي': Number(c.remaining), 'الحالة': c.status, 'التاريخ': (c.created_at || '').slice(0, 10), 'ملاحظات': c.notes || '' })) },
        { name: 'الزيارات', rows: d.visits.map((v) => ({ 'رقم': v.id, 'التاريخ': v.visit_date, 'المريض': pn.get(v.patient_id) || v.patient_id, 'رقم العلاج': v.case_id, 'المدفوع': Number(v.amount_paid), 'ملاحظات': v.notes || '' })) },
        { name: 'الفواتير', rows: (d.expenses || []).map((e) => ({ 'التاريخ': e.expense_date, 'الفاتورة': e.title, 'المبلغ': Number(e.amount), 'ملاحظات': e.notes || '', 'سجّلها': userOf(e.created_by) })) },
        { name: 'الملاحظات', rows: d.notes.map((n) => ({ 'المريض': pn.get(n.patient_id) || n.patient_id, 'الملاحظة': n.body, 'كتبها': userOf(n.created_by), 'التاريخ': (n.created_at || '').slice(0, 10) })) },
        { name: 'قائمة الأسعار', rows: d.treatments.map((t) => ({ 'العلاج': t.name, 'السعر': Number(t.default_price), 'متاح': t.active ? 'أيوه' : 'لأ' })) },
      ]);
      toast('اتنزلت النسخة');
    } catch (e) { errToast(e); } finally { btn.disabled = false; }
  });
  body.append(h('div', { class: 'card card-pad', style: 'max-width:620px' },
    h('h3', { style: 'margin-top:0' }, 'خد نسخة من كل البيانات'),
    h('p', { class: 'muted' }, 'الخطة المجانية من Supabase مفيهاش نسخ احتياطي أوتوماتيك. اتعوّد تنزّل نسخة كل أسبوع وتحفظها على درايف أو على الكمبيوتر.'),
    btn));
}
