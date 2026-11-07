// Vercel Serverless Function: إدارة المستخدمين (إضافة / باسورد / إيقاف)
// محتاج متغيرين في Vercel → Settings → Environment Variables:
//   SUPABASE_URL                = نفس الـ Project URL
//   SUPABASE_SECRET_KEY         = الـ Secret key (sb_secret_...) — سري، أوعى تحطه في config.js

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const USER_DOMAIN = 'shorouk.clinic'; // لازم يبقى نفس اللي في js/db.js
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function sb(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(URL_ + path, {
    method,
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let s = ''; req.on('data', (c) => (s += c));
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  const send = (code, obj) => res.status(code).json(obj);
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
  if (!URL_ || !KEY) return send(500, { error: 'السيرفر مش متظبط: ضيف SUPABASE_URL و SUPABASE_SECRET_KEY في Vercel' });

  // 1) اتأكد إن اللي باعت الطلب أدمن مفعّل
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(401, { error: 'سجّل دخول الأول' });
  const who = await sb('/auth/v1/user', { token });
  if (!who.ok || !who.data?.id) return send(401, { error: 'انتهت الجلسة، سجّل دخول تاني' });
  const prof = await sb(`/rest/v1/profiles?id=eq.${who.data.id}&select=role,active`);
  const me = Array.isArray(prof.data) ? prof.data[0] : null;
  if (!me || me.role !== 'admin' || !me.active) return send(403, { error: 'الحركة دي للمدير بس' });

  const body = await readBody(req);
  const { action } = body;

  try {
    if (action === 'create') {
      const username = String(body.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return send(400, { error: 'اسم المستخدم لازم يكون حروف إنجليزي أو أرقام من غير مسافات' });
      const email = `${username}@${USER_DOMAIN}`;
      const full_name = String(body.full_name || '').trim();
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'doctor';
      if (!full_name) return send(400, { error: 'اكتب الاسم' });
      if (password.length < 6) return send(400, { error: 'الباسورد لازم يكون 6 حروف على الأقل' });
      const r = await sb('/auth/v1/admin/users', {
        method: 'POST',
        body: { email, password, email_confirm: true, user_metadata: { full_name }, app_metadata: { created_by_admin: true } },
      });
      if (!r.ok) {
        const msg = JSON.stringify(r.data || '');
        if (/already|exists|registered/i.test(msg)) return send(400, { error: 'اسم المستخدم ده موجود قبل كده' });
        if (/password/i.test(msg)) return send(400, { error: 'الباسورد ضعيف، جرّب واحد أطول' });
        return send(400, { error: 'معرفتش أضيف المستخدم: ' + (r.data?.msg || r.data?.message || r.status) });
      }
      const id = r.data.id || r.data.user?.id;
      // الـ trigger بيعمل الـ profile — نظبط الاسم والصلاحية
      await sb(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: { full_name, role, active: true, email, username } });
      return send(200, { ok: true, id });
    }

    if (action === 'password') {
      if (String(body.password || '').length < 6) return send(400, { error: 'الباسورد لازم يكون 6 حروف على الأقل' });
      const r = await sb(`/auth/v1/admin/users/${body.id}`, { method: 'PUT', body: { password: body.password } });
      if (!r.ok) return send(400, { error: 'معرفتش أغير الباسورد' });
      return send(200, { ok: true });
    }

    if (action === 'active') {
      if (body.id === who.data.id) return send(400, { error: 'مينفعش توقف حسابك إنت' });
      const active = !!body.active;
      const r = await sb(`/auth/v1/admin/users/${body.id}`, { method: 'PUT', body: { ban_duration: active ? 'none' : '876000h' } });
      if (!r.ok) return send(400, { error: 'معرفتش أغير حالة الحساب' });
      await sb(`/rest/v1/profiles?id=eq.${body.id}`, { method: 'PATCH', body: { active } });
      return send(200, { ok: true });
    }

    return send(400, { error: 'طلب مش معروف' });
  } catch (e) {
    return send(500, { error: 'حصل خطأ في السيرفر' });
  }
};
