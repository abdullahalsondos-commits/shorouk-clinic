-- =====================================================================
--  عيادة الشروق — قاعدة البيانات
--  الصق الملف ده كله في Supabase → SQL Editor → New query → Run
--  (آمن لو اتشغّل أكتر من مرة)
-- =====================================================================

-- ---------- المستخدمين (الأدمن والدكاترة) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  username    text,
  full_name   text not null default '',
  role        text not null default 'doctor' check (role in ('admin','doctor')),
  is_doctor   boolean not null default true,   -- يظهر في قائمة الدكاترة والحسابات
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
update public.profiles set username = lower(split_part(email, '@', 1)) where username is null and email is not null;
create unique index if not exists profiles_username_idx on public.profiles (lower(username));

-- ---------- الإعدادات (نِسَب التقسيم) ----------
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  clinic_share  numeric(5,2) not null default 60,
  doctor_share  numeric(5,2) not null default 40,
  currency      text not null default 'ج.م',
  updated_at    timestamptz not null default now(),
  check (clinic_share >= 0 and doctor_share >= 0 and clinic_share + doctor_share = 100)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
-- الفواتير بتتخصم منين: before_split = من الإجمالي قبل التقسيم، clinic_only = من نصيب العيادة بس
alter table public.settings add column if not exists expenses_mode text not null default 'before_split';
do $$ begin
  alter table public.settings add constraint settings_expenses_mode_chk check (expenses_mode in ('before_split','clinic_only'));
exception when duplicate_object then null; end $$;

-- ---------- قائمة العلاجات ----------
create table if not exists public.treatments (
  id             bigint generated always as identity primary key,
  name           text not null unique,
  default_price  numeric(12,2) not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------- المرضى ----------
create table if not exists public.patients (
  id             bigint generated always as identity primary key,
  full_name      text not null,
  phone          text,
  age            int,
  gender         text check (gender in ('male','female')),
  address        text,
  medical_notes  text,          -- حساسية / أمراض مزمنة
  notes          text,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists patients_name_idx  on public.patients (full_name);
create index if not exists patients_phone_idx on public.patients (phone);

-- ---------- الحالات العلاجية (حشو عصب، تركيب...) ----------
create table if not exists public.cases (
  id              bigint generated always as identity primary key,
  patient_id      bigint not null references public.patients(id) on delete cascade,
  treatment_id    bigint references public.treatments(id) on delete set null,
  treatment_name  text not null,
  tooth           text,
  total_price     numeric(12,2) not null default 0 check (total_price >= 0),
  discount        numeric(12,2) not null default 0 check (discount >= 0),
  doctor_id       uuid references public.profiles(id) on delete set null,
  status          text not null default 'open' check (status in ('open','done','cancelled')),
  notes           text,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists cases_patient_idx on public.cases (patient_id);
alter table public.cases add column if not exists discount numeric(12,2) not null default 0 check (discount >= 0);

-- ---------- الزيارات والمدفوعات ----------
create table if not exists public.visits (
  id           bigint generated always as identity primary key,
  case_id      bigint not null references public.cases(id) on delete cascade,
  patient_id   bigint not null references public.patients(id) on delete cascade,
  doctor_id    uuid references public.profiles(id) on delete set null,  -- الدكتور اللي عمل الشغل
  visit_date   date not null default current_date,
  amount_paid  numeric(12,2) not null default 0 check (amount_paid >= 0),
  notes        text,
  created_by   uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists visits_date_idx    on public.visits (visit_date);
create index if not exists visits_patient_idx on public.visits (patient_id);
create index if not exists visits_case_idx    on public.visits (case_id);

-- ---------- المواعيد ----------
create table if not exists public.appointments (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients(id) on delete cascade,
  case_id     bigint references public.cases(id) on delete set null,
  doctor_id   uuid references public.profiles(id) on delete set null,
  appt_at     timestamptz not null,
  note        text,
  status      text not null default 'scheduled' check (status in ('scheduled','done','missed','cancelled')),
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists appointments_at_idx on public.appointments (appt_at);

-- ---------- الفواتير والمصاريف ----------
create table if not exists public.expenses (
  id            bigint generated always as identity primary key,
  title         text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  expense_date  date not null default current_date,
  notes         text,
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (expense_date);

-- ---------- ملاحظات حرة على المريض ----------
create table if not exists public.patient_notes (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients(id) on delete cascade,
  body        text not null,
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index if not exists patient_notes_patient_idx on public.patient_notes (patient_id);

-- =====================================================================
--  ملخصات جاهزة (المدفوع والباقي)
-- =====================================================================
drop view if exists public.patient_summary;
drop view if exists public.case_summary;

create view public.case_summary with (security_invoker = true) as
select c.*,
       greatest(c.total_price - c.discount, 0)                          as net_price,
       coalesce(v.paid, 0)                                              as paid,
       greatest(c.total_price - c.discount - coalesce(v.paid,0), 0)     as remaining,
       coalesce(v.visits_count, 0)                                      as visits_count,
       v.last_visit
from public.cases c
left join (
  select case_id, sum(amount_paid) paid, count(*) visits_count, max(visit_date) last_visit
  from public.visits group by case_id
) v on v.case_id = c.id;

create view public.patient_summary with (security_invoker = true) as
select p.*,
       coalesce(s.total_due, 0)  as total_due,
       coalesce(s.total_paid, 0) as total_paid,
       coalesce(s.remaining, 0)  as remaining,
       coalesce(s.open_cases, 0) as open_cases,
       lv.last_visit
from public.patients p
left join (
  select patient_id,
         sum(net_price) filter (where status <> 'cancelled') total_due,
         sum(paid) total_paid,
         sum(remaining) filter (where status <> 'cancelled') remaining,
         count(*) filter (where status = 'open') open_cases
  from public.case_summary group by patient_id
) s on s.patient_id = p.id
left join (
  select patient_id, max(visit_date) last_visit from public.visits group by patient_id
) lv on lv.patient_id = p.id;

-- =====================================================================
--  الصلاحيات
-- =====================================================================
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

-- أول مستخدم يتعمل = الأدمن. أي مستخدم بعد كده لازم يكون الأدمن اللي عامله من جوه السيستم
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean := not exists (select 1 from public.profiles where role = 'admin');
  by_admin   boolean := coalesce((new.raw_app_meta_data->>'created_by_admin')::boolean, false);
begin
  insert into public.profiles (id, email, username, full_name, role, is_doctor, active)
  values (
    new.id,
    new.email,
    lower(split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    case when first_user then 'admin' else 'doctor' end,
    case when first_user then false else true end,
    first_user or by_admin
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.treatments   enable row level security;
alter table public.patients     enable row level security;
alter table public.cases        enable row level security;
alter table public.visits       enable row level security;
alter table public.appointments enable row level security;
alter table public.patient_notes enable row level security;
alter table public.expenses      enable row level security;

do $$
declare t text;
begin
  -- امسح السياسات القديمة لو الملف اتشغّل قبل كده
  for t in select unnest(array['profiles','settings','treatments','patients','cases','visits','appointments','patient_notes','expenses']) loop
    execute (select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, t), ' '), '')
             from pg_policies where schemaname = 'public' and tablename = t);
  end loop;
end $$;

-- كل مستخدم مفعّل يقدر يشوف كل حاجة
create policy read_all on public.profiles     for select using (public.is_active_user() or id = auth.uid());
create policy read_all on public.settings     for select using (public.is_active_user());
create policy read_all on public.treatments   for select using (public.is_active_user());
create policy read_all on public.patients     for select using (public.is_active_user());
create policy read_all on public.cases        for select using (public.is_active_user());
create policy read_all on public.visits       for select using (public.is_active_user());
create policy read_all on public.appointments for select using (public.is_active_user());
create policy read_all on public.patient_notes for select using (public.is_active_user());
create policy read_all on public.expenses      for select using (public.is_active_user());

-- الأدمن بس: المستخدمين، الإعدادات، قائمة العلاجات
create policy admin_write on public.profiles   for update using (public.is_admin()) with check (public.is_admin());
create policy admin_write on public.settings   for update using (public.is_admin()) with check (public.is_admin());
create policy admin_ins   on public.treatments for insert with check (public.is_admin());
create policy admin_upd   on public.treatments for update using (public.is_admin()) with check (public.is_admin());
create policy admin_del   on public.treatments for delete using (public.is_admin());

-- المرضى والحالات والمواعيد: أي دكتور يضيف ويعدّل، والمسح للأدمن
create policy user_ins on public.patients for insert with check (public.is_active_user());
create policy user_upd on public.patients for update using (public.is_active_user()) with check (public.is_active_user());
create policy admin_del on public.patients for delete using (public.is_admin());

create policy user_ins on public.cases for insert with check (public.is_active_user());
create policy user_upd on public.cases for update using (public.is_active_user()) with check (public.is_active_user());
create policy admin_del on public.cases for delete using (public.is_admin());

create policy user_ins on public.appointments for insert with check (public.is_active_user());
create policy user_upd on public.appointments for update using (public.is_active_user()) with check (public.is_active_user());
create policy user_del on public.appointments for delete using (public.is_active_user());

-- الزيارات (فيها فلوس): أي دكتور يسجّل، والتعديل والمسح للأدمن أو اللي سجّلها
create policy user_ins on public.visits for insert with check (public.is_active_user());
create policy owner_upd on public.visits for update
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()))
  with check (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));
create policy owner_del on public.visits for delete
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));

-- الملاحظات: أي دكتور يكتب، والتعديل والمسح للأدمن أو اللي كتبها
create policy user_ins on public.patient_notes for insert with check (public.is_active_user());
create policy owner_upd on public.patient_notes for update
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()))
  with check (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));
create policy owner_del on public.patient_notes for delete
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));

-- الفواتير: أي مستخدم يسجّل، والتعديل والمسح للأدمن أو اللي سجّلها
create policy user_ins on public.expenses for insert with check (public.is_active_user());
create policy owner_upd on public.expenses for update
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()))
  with check (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));
create policy owner_del on public.expenses for delete
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));

grant select on public.case_summary, public.patient_summary to authenticated;

-- ---------- قائمة العلاجات والأسعار ----------
-- شيل العلاجات العربي القديمة لو مش مستخدمة
delete from public.treatments t
where t.name in ('كشف','حشو عادي (كومبوزيت)','حشو عصب','خلع عادي','خلع جراحي','تنظيف جير','تبييض','تركيبة طربوش','زراعة','تقويم')
  and not exists (select 1 from public.cases c where c.treatment_id = t.id);

insert into public.treatments (name, default_price) values
  ('Diagnosis', 50),
  ('Extraction', 350),
  ('Extraction 8', 500),
  ('Surgical Extraction', 1000),
  ('Pedo Extraction', 250),
  ('Scaling', 250),
  ('Composite', 750),
  ('Endo Anterior', 1300),
  ('Endo Posterior', 1500),
  ('Endo Pedo', 450),
  ('Fixed PFM', 1000),
  ('Fixed Zircon', 2000)
on conflict (name) do update set default_price = excluded.default_price;
