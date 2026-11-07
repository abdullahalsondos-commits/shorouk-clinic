// بيشتغل أوتوماتيك كل يوم (من vercel.json) عشان Supabase المجاني ميوقفش المشروع لو العيادة قفلت أسبوع
module.exports = async (req, res) => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return res.status(500).json({ ok: false, error: 'missing env' });
  const r = await fetch(url + '/rest/v1/settings?select=id&limit=1', { headers: { apikey: key } });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(r.ok ? 200 : 500).json({ ok: r.ok, at: new Date().toISOString() });
};
