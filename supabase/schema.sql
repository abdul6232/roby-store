-- المرحلة 1: الحسابات والصلاحيات وسعر الصرف
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('admin','employee')),
  created_at timestamptz default now()
);
create table public.settings (
  id int primary key default 1 check (id = 1),
  usd_to_syp numeric not null default 15000,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1);

-- أول حساب = مشرف تلقائياً
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, case when exists (select 1 from public.profiles) then 'employee' else 'admin' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
create policy "own or admin read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admin update profiles" on public.profiles for update using (public.is_admin());
create policy "all read settings" on public.settings for select using (auth.uid() is not null);
create policy "admin update settings" on public.settings for update using (public.is_admin());
