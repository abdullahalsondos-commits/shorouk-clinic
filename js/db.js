// ===== طبقة البيانات: Supabase =====

export const USER_DOMAIN = 'shorouk.clinic';
export const toEmail = (login) => {
  const l = String(login || '').trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${USER_DOMAIN}`;
};
export const REMEMBER_KEY = 'shorouk-remember';
export const setRemember = (v) => { try { localStorage.setItem(REMEMBER_KEY, v ? '1' : '0'); } catch {} };
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; } };
// تخزين الجلسة: "تذكرني" = تفضل مسجّل، غير كده = بتخرج لما تقفل المتصفح
export const sessionStore = {
  getItem(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; } },
  setItem(k, v) {
    try {
      const [keep, drop] = remembered() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(k, v); drop.removeItem(k);
    } catch {}
  },
  removeItem(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} },
};

export async function createDB(cfg) {
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    const e = new Error('NOT_CONFIGURED'); e.code = 'NOT_CONFIGURED'; throw e;
  }
  return createSupabaseDB(cfg);
}

function translate(err) {
  const m = (err && (err.message || err.error_description || String(err))) || '';
  if (/row-level security|permission denied|violates row/i.test(m)) return 'مش مسموح لك تعمل الحركة دي';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'مفيش اتصال بالإنترنت، جرّب تاني';
  if (/foreign key/i.test(m)) return 'مينفعش تمسح ده لأنه مرتبط ببيانات تانية';
  if (/duplicate key|unique/i.test(m)) return 'الاسم ده موجود قبل كده';
  if (/clinic_share|check constraint/i.test(m)) return 'القيمة دي مش مقبولة';
  if (/multiple \(or no\) rows|0 rows/i.test(m)) return 'مش مسموح لك تعمل الحركة دي';
  if (/JWT|expired/i.test(m)) return 'انتهت الجلسة، سجّل دخول تاني';
  return m || 'حصل خطأ، جرّب تاني';
}

async function createSupabaseDB(cfg) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: sessionStore, storageKey: 'shorouk-auth' },
  });
  const un = ({ data, error }) => { if (error) throw new Error(translate(error)); return data; };
  const all = async (build) => {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const data = un(await build().range(i, i + 999));
      out.push(...data);
      if (data.length < 1000) return out;
    }
  };
  const nextDay = (d) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  const clean = (o) => { const c = { ...o }; for (const k of Object.keys(c)) if (c[k] === '') c[k] = null; return c; };
  const save = async (table, row, cols) => {
    const data = {};
    for (const k of cols) if (k in row) data[k] = row[k] === '' ? null : row[k];
    if (row.id) return un(await sb.from(table).update(data).eq('id', row.id).select().single());
    return un(await sb.from(table).insert(data).select().single());
  };
  const del = async (table, id) => {
    const d = un(await sb.from(table).delete().eq('id', id).select('id'));
    if (!d || !d.length) throw new Error('مش مسموح لك تعمل الحركة دي');
  };
  const VISIT_SEL = '*, patient:patients(id,full_name,phone), cs:cases(id,treatment_name,tooth,total_price,discount,status)';
  const fixCase = (rows) => rows.map((r) => { r.case = r.cs; delete r.cs; return r; });

  return {
    mode: 'live',
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(login, password, remember = true) {
      setRemember(remember);
      const { error } = await sb.auth.signInWithPassword({ email: toEmail(login), password });
      if (error) {
        console.error('signIn', error);
        const m = String(error.message || '');
        if (/confirm/i.test(m)) throw new Error('الحساب لسه متفعّلش — علّم على Auto Confirm في Supabase');
        if (/invalid login credentials|invalid_credentials/i.test(m + ' ' + (error.code || ''))) throw new Error('اسم المستخدم أو الباسورد غلط');
        if (/api key|apikey|jwt|unauthorized|forbidden/i.test(m)) throw new Error('مفتاح Supabase في js/config.js مش صح');
        if (/fetch|network/i.test(m)) throw new Error('مش قادر أوصل لـ Supabase — اتأكد من النت ومن الـ Project URL');
        throw new Error('معرفتش أدخل: ' + m);
      }
    },
    async signOut() { await sb.auth.signOut(); },
    async changePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(translate(error)); },
    onAuth(cb) { sb.auth.onAuthStateChange((event) => cb(event)); },
    async me() {
      const s = await this.session(); if (!s) return null;
      return un(await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
    },

    getSettings: async () => un(await sb.from('settings').select('*').eq('id', 1).single()),
    updateSettings: async (p) => un(await sb.from('settings').update({ ...p, updated_at: new Date().toISOString() }).eq('id', 1).select().single()),

    listUsers: async () => un(await sb.from('profiles').select('*').order('created_at')),
    updateProfile: async (id, p) => un(await sb.from('profiles').update(p).eq('id', id).select().single()),
    async adminUser(action, payload) {
      const s = await this.session();
      const r = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ action, ...payload }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'حصل خطأ في السيرفر');
      return j;
    },

    listTreatments: async () => un(await sb.from('treatments').select('*').order('id')),
    saveTreatment: (t) => save('treatments', t, ['name', 'default_price', 'active']),
    deleteTreatment: (id) => del('treatments', id),

    async listPatients(q = '', limit = 300) {
      let qb = sb.from('patient_summary').select('*').order('created_at', { ascending: false }).limit(limit);
      const s = q.replace(/[,()%*\\]/g, ' ').trim();
      if (s) qb = qb.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
      return un(await qb);
    },
    getPatient: async (id) => un(await sb.from('patient_summary').select('*').eq('id', id).maybeSingle()),
    getPatientsByIds: async (ids) => (ids.length ? un(await sb.from('patients').select('id,full_name,phone').in('id', ids)) : []),
    savePatient: (p) => save('patients', clean(p), ['full_name', 'phone', 'age', 'gender', 'address', 'medical_notes', 'notes']),
    deletePatient: (id) => del('patients', id),
    async countPatients() { const { count, error } = await sb.from('patients').select('id', { count: 'exact', head: true }); if (error) throw new Error(translate(error)); return count || 0; },

    async listCases({ patientId, from, to, outstanding } = {}) {
      return all(() => {
        let qb = sb.from('case_summary').select('*').order('created_at', { ascending: false });
        if (patientId) qb = qb.eq('patient_id', patientId);
        if (from) qb = qb.gte('created_at', from);
        if (to) qb = qb.lt('created_at', nextDay(to));
        if (outstanding) qb = qb.gt('remaining', 0).neq('status', 'cancelled');
        return qb;
      });
    },
    saveCase: (c) => save('cases', c, ['patient_id', 'treatment_id', 'treatment_name', 'tooth', 'total_price', 'discount', 'doctor_id', 'status', 'notes']),
    deleteCase: (id) => del('cases', id),

    async listVisits({ patientId, from, to, limit } = {}) {
      const build = () => {
        let qb = sb.from('visits').select(VISIT_SEL).order('visit_date', { ascending: false }).order('created_at', { ascending: false });
        if (patientId) qb = qb.eq('patient_id', patientId);
        if (from) qb = qb.gte('visit_date', from);
        if (to) qb = qb.lte('visit_date', to);
        return qb;
      };
      if (limit) return fixCase(un(await build().limit(limit)));
      return fixCase(await all(build));
    },
    saveVisit: (v) => save('visits', v, ['case_id', 'patient_id', 'doctor_id', 'visit_date', 'amount_paid', 'notes']),
    deleteVisit: (id) => del('visits', id),

    async listExpenses({ from, to } = {}) {
      return all(() => {
        let qb = sb.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false });
        if (from) qb = qb.gte('expense_date', from);
        if (to) qb = qb.lte('expense_date', to);
        return qb;
      });
    },
    saveExpense: (e) => save('expenses', e, ['title', 'amount', 'expense_date', 'notes']),
    deleteExpense: (id) => del('expenses', id),

    listNotes: async (patientId) => un(await sb.from('patient_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })),
    async saveNote(n) {
      if (n.id) return un(await sb.from('patient_notes').update({ body: n.body, updated_at: new Date().toISOString() }).eq('id', n.id).select().single());
      return un(await sb.from('patient_notes').insert({ patient_id: n.patient_id, body: n.body }).select().single());
    },
    deleteNote: (id) => del('patient_notes', id),

    async exportAll() {
      const t = (name) => all(() => sb.from(name).select('*').order('id'));
      const [patients, cases, visits, notes, treatments, expenses] = await Promise.all(
        ['patients', 'case_summary', 'visits', 'patient_notes', 'treatments', 'expenses'].map(t));
      const users = un(await sb.from('profiles').select('*'));
      return { patients, cases, visits, notes, treatments, expenses, users };
    },
  };
}
