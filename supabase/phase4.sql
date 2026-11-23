-- المرحلة 4: صلاحية تعديل المخزون + سجل التعديلات (نفّذه بعد phase3b.sql)

-- 1) الصلاحية
alter table public.profiles add column if not exists can_edit_inventory boolean not null default false;

create or replace function public.can_edit_inventory() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or can_edit_inventory)) $$;

-- 2) سياسات items: القراءة للجميع، والكتابة للمشرف أو من يملك الصلاحية
drop policy if exists "item insert" on public.items;
drop policy if exists "item update" on public.items;
drop policy if exists "item delete" on public.items;
create policy "item insert" on public.items for insert with check (public.can_edit_inventory());
create policy "item update" on public.items for update using (public.can_edit_inventory());
create policy "item delete" on public.items for delete using (public.can_edit_inventory());
-- (البيع والشراء يعملان عبر triggers بصلاحية security definer فلا يتأثران)

-- 3) سجل التعديلات
create table public.inventory_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid,
  item_name text not null,
  change_type text not null check (change_type in ('add','edit_qty','edit_price','edit_data','delete')),
  field text, old_value text, new_value text,
  created_by uuid, created_by_name text,
  created_at timestamptz not null default now()
);
create index inventory_history_at_idx on public.inventory_history (created_at desc);
alter table public.inventory_history enable row level security;
create policy "history read" on public.inventory_history for select using (public.can_edit_inventory());
-- لا توجد سياسة إدخال/تعديل/حذف: الكتابة فقط عبر الـ trigger أدناه

create or replace function public.log_inventory(p_item uuid, p_name text, p_type text, p_field text, p_old text, p_new text)
returns void language sql security definer set search_path = public as $$
  insert into public.inventory_history (item_id, item_name, change_type, field, old_value, new_value, created_by, created_by_name)
  values (p_item, p_name, p_type, p_field, p_old, p_new, auth.uid(), public.actor_name(auth.uid())) $$;

create or replace function public.log_item_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare cn_old text; cn_new text;
begin
  -- تغييرات الرصيد الناتجة عن البيع/الشراء لها سجلاتها الخاصة، فلا تُسجَّل هنا
  if coalesce(current_setting('roby.skip_history', true), '') = '1' then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then
    perform public.log_inventory(new.id, new.name, 'add', null, null,
      'الرصيد: ' || new.stock || ' | السعر: ' || trim_scale(new.price_usd) || '$ | الحد الأدنى: ' || new.min_stock);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      perform public.log_inventory(new.id, new.name, 'edit_data', 'الاسم', old.name, new.name); end if;
    if new.stock is distinct from old.stock then
      perform public.log_inventory(new.id, new.name, 'edit_qty', 'الرصيد', old.stock::text, new.stock::text); end if;
    if new.price_usd is distinct from old.price_usd then
      perform public.log_inventory(new.id, new.name, 'edit_price', 'السعر', trim_scale(old.price_usd)::text, trim_scale(new.price_usd)::text); end if;
    if new.min_stock is distinct from old.min_stock then
      perform public.log_inventory(new.id, new.name, 'edit_data', 'الحد الأدنى', old.min_stock::text, new.min_stock::text); end if;
    if new.category_id is distinct from old.category_id then
      select name into cn_old from public.categories where id = old.category_id;
      select name into cn_new from public.categories where id = new.category_id;
      perform public.log_inventory(new.id, new.name, 'edit_data', 'التصنيف', coalesce(cn_old, 'بدون'), coalesce(cn_new, 'بدون')); end if;
    return new;
  else
    perform public.log_inventory(old.id, old.name, 'delete', null,
      'الرصيد: ' || old.stock || ' | السعر: ' || trim_scale(old.price_usd) || '$', null);
    return old;
  end if;
end $$;
create trigger items_history after insert or update or delete on public.items
  for each row execute function public.log_item_change();

-- 4) تحديث دالتي الشراء والبيع لتجاوز التسجيل في سجل المخزون
create or replace function public.on_purchase() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select * into it from public.items where id = new.item_id for update;
  if not found then raise exception 'القطعة غير موجودة'; end if;
  perform set_config('roby.skip_history', '1', true);
  update public.items set stock = stock + new.qty, updated_at = now() where id = new.item_id;
  perform set_config('roby.skip_history', '', true);
  new.item_name := it.name; new.purchased_at := now();
  new.created_by := auth.uid(); new.created_by_name := public.actor_name(auth.uid());
  return new;
end $$;

create or replace function public.on_sale() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select * into it from public.items where id = new.item_id for update;
  if not found then raise exception 'القطعة غير موجودة'; end if;
  if it.stock < new.qty then raise exception 'الرصيد غير كافٍ (المتوفر: %)', it.stock; end if;
  perform set_config('roby.skip_history', '1', true);
  update public.items set stock = stock - new.qty, updated_at = now() where id = new.item_id;
  perform set_config('roby.skip_history', '', true);
  new.item_name := it.name; new.sold_at := now();
  new.unit_price_usd := coalesce(new.unit_price_usd, it.price_usd);
  new.rate := (select usd_to_syp from public.settings where id = 1);
  new.seller_id := auth.uid(); new.seller_name := public.actor_name(auth.uid());
  return new;
end $$;
