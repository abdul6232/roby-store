-- المرحلة 2: التصنيفات والمخزون (نفّذه بعد schema.sql)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  stock integer not null default 0 check (stock >= 0),
  price_usd numeric(14,4) not null default 0 check (price_usd >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index items_category_idx on public.items(category_id);

alter table public.categories enable row level security;
alter table public.items enable row level security;

-- التصنيفات: الجميع يقرأ ويضيف، والمشرف فقط يعدّل ويحذف
create policy "cat read"   on public.categories for select using (auth.uid() is not null);
create policy "cat insert" on public.categories for insert with check (auth.uid() is not null);
create policy "cat update" on public.categories for update using (public.is_admin());
create policy "cat delete" on public.categories for delete using (public.is_admin());
-- القطع: الجميع يقرأ ويضيف ويعدّل، والمشرف فقط يحذف
create policy "item read"   on public.items for select using (auth.uid() is not null);
create policy "item insert" on public.items for insert with check (auth.uid() is not null);
create policy "item update" on public.items for update using (auth.uid() is not null);
create policy "item delete" on public.items for delete using (public.is_admin());
