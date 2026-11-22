-- المرحلة 3: المشتريات، المبيعات، النواقص، الجرد (نفّذه بعد phase2.sql)

-- اسم المستخدم الحالي (الاسم، وإن لم يوجد فالبريد)
create or replace function public.actor_name(uid uuid) returns text
language sql security definer set search_path = public stable as $$
  select coalesce(nullif(p.full_name,''), u.email) from auth.users u
  left join public.profiles p on p.id = u.id where u.id = uid $$;

-- يسجّل المستخدم تلقائياً على أي سجل (لا يمكن تزويره من المتصفح)
create or replace function public.set_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.created_by_name := public.actor_name(auth.uid());
  return new;
end $$;

-- ===== المشتريات =====
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  item_name text,
  qty integer not null check (qty > 0),
  unit_cost_usd numeric(14,4) not null default 0 check (unit_cost_usd >= 0),
  supplier text,
  purchased_at timestamptz not null default now(),
  created_by uuid, created_by_name text
);
create or replace function public.on_purchase() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select * into it from public.items where id = new.item_id for update;
  if not found then raise exception 'القطعة غير موجودة'; end if;
  update public.items set stock = stock + new.qty, updated_at = now() where id = new.item_id;
  new.item_name := it.name; new.purchased_at := now();
  new.created_by := auth.uid(); new.created_by_name := public.actor_name(auth.uid());
  return new;
end $$;
create trigger purchases_before before insert on public.purchases for each row execute function public.on_purchase();

-- ===== المبيعات (تخصم من المخزون وتسجّل البائع والوقت) =====
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  item_name text,
  qty integer not null check (qty > 0),
  unit_price_usd numeric(14,4) not null default 0,
  rate numeric,
  sold_at timestamptz not null default now(),
  seller_id uuid, seller_name text
);
create or replace function public.on_sale() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select * into it from public.items where id = new.item_id for update;
  if not found then raise exception 'القطعة غير موجودة'; end if;
  if it.stock < new.qty then raise exception 'الرصيد غير كافٍ (المتوفر: %)', it.stock; end if;
  update public.items set stock = stock - new.qty, updated_at = now() where id = new.item_id;
  new.item_name := it.name; new.sold_at := now();
  new.unit_price_usd := coalesce(new.unit_price_usd, it.price_usd);
  new.rate := (select usd_to_syp from public.settings where id = 1);
  new.seller_id := auth.uid(); new.seller_name := public.actor_name(auth.uid());
  return new;
end $$;
create trigger sales_before before insert on public.sales for each row execute function public.on_sale();

-- ===== النواقص اليدوية =====
create table public.manual_shortages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items(id) on delete cascade,
  note text, created_at timestamptz default now(),
  created_by uuid, created_by_name text
);
create trigger ms_actor before insert on public.manual_shortages for each row execute function public.set_actor();

-- ===== الجرد =====
create table public.stocktakes (
  id uuid primary key default gen_random_uuid(),
  stock_date date not null,
  period_start timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid, created_by_name text
);
create trigger st_actor before insert on public.stocktakes for each row execute function public.set_actor();
create table public.stocktake_lines (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references public.stocktakes(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  before_qty integer not null, sold_qty integer not null, expected_qty integer not null,
  shelf_qty integer not null, shortage_qty integer not null,
  unit_price_usd numeric(14,4) not null default 0
);
create table public.shortage_resets (
  id uuid primary key default gen_random_uuid(),
  reset_at timestamptz not null default now(),
  kind text not null check (kind in ('manual','monthly')),
  total_usd numeric(14,4) default 0,
  created_by uuid, created_by_name text
);
create trigger sr_actor before insert on public.shortage_resets for each row execute function public.set_actor();

-- ===== RLS =====
alter table public.purchases enable row level security;
alter table public.sales enable row level security;
alter table public.manual_shortages enable row level security;
alter table public.stocktakes enable row level security;
alter table public.stocktake_lines enable row level security;
alter table public.shortage_resets enable row level security;
create policy "p read"  on public.purchases for select using (auth.uid() is not null);
create policy "p ins"   on public.purchases for insert with check (auth.uid() is not null);
create policy "s read"  on public.sales for select using (auth.uid() is not null);
create policy "s ins"   on public.sales for insert with check (auth.uid() is not null);
create policy "ms read" on public.manual_shortages for select using (auth.uid() is not null);
create policy "ms ins"  on public.manual_shortages for insert with check (auth.uid() is not null);
create policy "ms del"  on public.manual_shortages for delete using (auth.uid() is not null);
create policy "st read" on public.stocktakes for select using (auth.uid() is not null);
create policy "st ins"  on public.stocktakes for insert with check (auth.uid() is not null);
create policy "st del"  on public.stocktakes for delete using (public.is_admin());
create policy "sl read" on public.stocktake_lines for select using (auth.uid() is not null);
create policy "sl ins"  on public.stocktake_lines for insert with check (auth.uid() is not null);
create policy "sr read" on public.shortage_resets for select using (auth.uid() is not null);
create policy "sr ins"  on public.shortage_resets for insert with check (public.is_admin());
