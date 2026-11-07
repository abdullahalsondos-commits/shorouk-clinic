// ===== تشغيل التطبيق: شاشة البداية، تسجيل الدخول، القائمة، التنقل =====
import { h, icon, modal, field, input, toast, errToast, initials } from './core.js';
import { createDB } from './db.js';
import { app, isAdmin, loadShared } from './state.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPatients } from './views/patients.js';
import { renderPatient } from './views/patient.js';
import { renderAccounting } from './views/accounting.js';
import { renderSettings } from './views/settings.js';
import { renderExpenses } from './views/expenses.js';

const root = document.getElementById('app');

const ROUTES = [
  { path: /^\/?$/, title: 'الرئيسية — سجل الزيارات', nav: 'home', render: renderDashboard },
  { path: /^\/patients$/, title: 'المرضى', nav: 'patients', render: renderPatients },
  { path: /^\/patients\/(\d+)$/, title: 'ملف المريض', nav: 'patients', render: renderPatient },
  { path: /^\/expenses$/, title: 'الفواتير', nav: 'expenses', render: renderExpenses },
  { path: /^\/accounting$/, title: 'الحسابات', nav: 'accounting', render: renderAccounting },
  { path: /^\/settings$/, title: 'الإعدادات', nav: 'settings', render: renderSettings, admin: true },
];
const NAV = [
  { key: 'home', href: '#/', label: 'الرئيسية', icon: 'home' },
  { key: 'patients', href: '#/patients', label: 'المرضى', icon: 'users' },
  { key: 'expenses', href: '#/expenses', label: 'الفواتير', icon: 'receipt' },
  { key: 'accounting', href: '#/accounting', label: 'الحسابات', icon: 'wallet' },
  { key: 'settings', href: '#/settings', label: 'الإعدادات', icon: 'settings', admin: true },
];

function hideSplash() {
  if (window.__splash) window.__splash.finish();
  else document.getElementById('splash')?.remove();
}

async function boot() {
  try {
    app.db = await createDB(window.CLINIC_CONFIG);
  } catch (e) {
    console.error(e);
    const notCfg = e.code === 'NOT_CONFIGURED';
    root.replaceChildren(h('div', { class: 'setup-screen' },
      h('div', { class: 'setup-card' },
        h('div', { 'data-logo-target': '', html: window.logoSVG({ cls: 'live' }) }),
        h('h2', null, notCfg ? 'السيستم لسه متربطش بقاعدة البيانات' : 'مش قادر أتصل بقاعدة البيانات'),
        h('p', { class: 'muted' }, notCfg
          ? 'افتح ملف js/config.js وحط فيه الـ Project URL والـ Publishable key من Supabase (الخطوات في README.md).'
          : 'اتأكد إن النت شغال، وإن المفاتيح في js/config.js صح، وإن مشروع Supabase مش متوقف.'),
        notCfg ? null : h('button', { class: 'btn primary', onclick: () => location.reload() }, 'جرّب تاني'))));
    hideSplash();
    return;
  }
  app.db.onAuth((event) => { if (event === 'SIGNED_OUT') { app.me = null; showLogin(); } });
  const session = await app.db.session().catch(() => null);
  if (session) await enter().catch((e) => { errToast(e); showLogin(); });
  else showLogin();
  hideSplash();
}

async function enter() {
  const me = await app.db.me();
  if (!me) throw new Error('مفيش حساب مرتبط بالإيميل ده');
  if (!me.active) { await app.db.signOut(); throw new Error('الحساب ده متوقف، كلّم مدير العيادة'); }
  app.me = me;
  await loadShared();
  showShell();
}

// ---------- تسجيل الدخول ----------
function showLogin() {
  const user = input({ type: 'text', placeholder: 'اسم المستخدم', dir: 'ltr', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', class: 'input with-icon' });
  const pw = input({ type: 'password', placeholder: '••••••••', dir: 'ltr', autocomplete: 'current-password', class: 'input with-icon' });
  let saved = ''; try { saved = localStorage.getItem('shorouk-last-user') || ''; } catch {}
  user.value = saved;
  let rememberOn = true; try { rememberOn = localStorage.getItem('shorouk-remember') !== '0'; } catch {}
  const remember = h('input', { type: 'checkbox', checked: rememberOn });
  const eye = h('button', { type: 'button', class: 'eye', title: 'إظهار الباسورد', onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; eye.classList.toggle('on'); } }, icon('eye'));
  const btn = h('button', { class: 'btn primary login-btn', type: 'submit' }, h('span', null, 'تسجيل الدخول'), icon('chevL'));
  const form = h('form', { class: 'login-card' },
    h('div', { class: 'login-mobile-brand' }, h('div', { 'data-logo-target': window.innerWidth <= 900 ? '' : null, html: window.logoSVG({ cls: 'live' }) }), h('b', null, 'عيادة الشروق')),
    h('div', { class: 'login-kicker' }, 'سيستم العيادة'),
    h('h1', null, 'أهلاً بيك تاني 👋'),
    h('p', { class: 'lead' }, 'ادخل باسم المستخدم والباسورد بتوعك'),
    h('label', { class: 'field' }, h('span', null, 'اسم المستخدم'), h('div', { class: 'input-icon' }, icon('user'), user)),
    h('label', { class: 'field' }, h('span', null, 'الباسورد'), h('div', { class: 'input-icon' }, icon('key'), pw, eye)),
    h('div', { class: 'login-row' }, h('label', { class: 'check', style: 'margin:0' }, remember, 'تذكرني'), h('span', { class: 'muted small' }, 'نسيت الباسورد؟ كلّم مدير العيادة')),
    btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!user.value.trim() || !pw.value) return errToast(new Error('اكتب اسم المستخدم والباسورد'));
    btn.disabled = true; btn.firstChild.textContent = 'جاري الدخول...';
    try {
      await app.db.signIn(user.value, pw.value, remember.checked);
      try { localStorage.setItem('shorouk-last-user', remember.checked ? user.value.trim() : ''); } catch {}
      await enter();
    } catch (err) { errToast(err); btn.disabled = false; btn.firstChild.textContent = 'تسجيل الدخول'; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
  });
  root.replaceChildren(h('div', { class: 'login' },
    h('div', { class: 'login-art' },
      h('div', { class: 'art-rings' }, h('i'), h('i'), h('i')),
      h('div', { class: 'art-logo', 'data-logo-target': window.innerWidth > 900 ? '' : null, html: window.logoSVG({ cls: 'live' }) }),
      h('h2', null, 'عيادة الشروق'),
      h('p', null, 'لطب وجراحة الفم والأسنان'),
      h('div', { class: 'features' }, [['users', 'ملفات المرضى'], ['coins', 'الزيارات والمدفوعات'], ['wallet', 'الحسابات']].map(([ic, t]) => h('span', null, icon(ic), t)))),
    h('div', { class: 'login-form-wrap' }, form)));
  setTimeout(() => (user.value ? pw : user).focus(), 100);
}

// ---------- الهيكل الأساسي ----------
let shell, content, titleEl;
function showShell() {
  const nav = h('nav', { class: 'nav' }, NAV.filter((n) => !n.admin || isAdmin()).map((n) =>
    h('a', { href: n.href, 'data-key': n.key, onclick: () => shell.classList.remove('nav-open') }, icon(n.icon), n.label)));
  const roleLabel = app.me.role === 'admin' ? 'مدير السيستم' : 'مستخدم';
  const sidebar = h('aside', { class: 'sidebar' },
    h('a', { href: '#/', class: 'side-brand' }, h('span', { 'data-logo-target': window.innerWidth > 900 ? '' : null, html: window.logoSVG({ cls: 'live' }) }), h('span', null, h('b', null, 'عيادة الشروق'), h('small', null, 'لطب وجراحة الفم والأسنان'))),
    nav,
    h('div', { class: 'side-user' },
      h('div', { class: 'avatar' }, initials(app.me.full_name)),
      h('div', { class: 'who' }, h('b', null, app.me.full_name), h('small', null, roleLabel)),
      h('button', { title: 'تغيير الباسورد', onclick: changePassword }, icon('key')),
      h('button', { title: 'تسجيل خروج', onclick: async () => { await app.db.signOut(); app.me = null; showLogin(); } }, icon('logout'))));
  titleEl = h('h1');
  content = h('div', { class: 'content' });
  shell = h('div', { class: 'shell' },
    sidebar,
    h('main', { class: 'main' },
      h('div', { class: 'topbar' },
        h('button', { class: 'btn ghost icon-btn menu-btn', onclick: () => shell.classList.toggle('nav-open') }, icon('menu')),
        titleEl,
        h('a', { class: 'btn primary', href: '#/patients?new=1' }, icon('plus'), h('span', { class: 'hide-sm' }, 'مريض جديد'))),
      content));
  shell.addEventListener('click', (e) => { if (shell.classList.contains('nav-open') && e.target === shell) shell.classList.remove('nav-open'); });
  root.replaceChildren(shell);
  route();
}

let renderToken = 0;
async function route() {
  if (!app.me || !content) return;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  let r = ROUTES.find((x) => x.path.test(path));
  if (!r || (r.admin && !isAdmin())) { location.hash = '#/'; return; }
  const m = path.match(r.path);
  titleEl.textContent = r.title;
  document.title = `${r.title} | عيادة الشروق`;
  shell.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.key === r.nav));
  const token = ++renderToken;
  const page = h('div', { class: 'page' });
  const ctx = {
    params, arg: m[1],
    setTitle: (t) => { titleEl.textContent = t; document.title = `${t} | عيادة الشروق`; },
    rerender: () => route(),
    alive: () => token === renderToken,
  };
  content.replaceChildren(page);
  window.scrollTo({ top: 0 });
  try { await r.render(page, ctx); }
  catch (e) { if (token === renderToken) { errToast(e); page.replaceChildren(h('div', { class: 'empty' }, icon('alert'), h('div', null, e.message || 'حصل خطأ'))); } }
}
window.addEventListener('hashchange', route);

function changePassword() {
  const a = input({ type: 'password', dir: 'ltr', autocomplete: 'new-password' });
  const b = input({ type: 'password', dir: 'ltr', autocomplete: 'new-password' });
  modal({
    title: 'تغيير الباسورد',
    body: h('div', null, field('الباسورد الجديد', a, '(6 حروف على الأقل)'), field('اكتبه تاني', b)),
    actions: [{ label: 'حفظ', cls: 'primary', icon: 'check', run: async () => {
      if (a.value.length < 6) throw new Error('الباسورد لازم يكون 6 حروف على الأقل');
      if (a.value !== b.value) throw new Error('الباسوردين مش زي بعض');
      await app.db.changePassword(a.value);
      toast('اتغير الباسورد');
    } }],
  });
}

boot();
