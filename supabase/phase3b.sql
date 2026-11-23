-- عرض الاسم الكامل للجميع (أسماء فقط) بدل البريد
drop policy if exists "own or admin read" on public.profiles;
create policy "authenticated read profiles" on public.profiles for select using (auth.uid() is not null);
