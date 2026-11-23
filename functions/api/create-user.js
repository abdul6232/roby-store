// Cloudflare Pages Function: POST /api/create-user  (بدون أي مكتبات، fetch فقط)
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export async function onRequestPost(context) {
  const { request, env } = context
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json({ error: 'متغيرات البيئة غير مضبوطة في Cloudflare' }, 500)
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }

  // 1) التحقق من هوية المتصل
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '')
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: 'Bearer ' + token } })
  if (!who.ok) return json({ error: 'غير مصرّح' }, 401)
  const caller = await who.json()

  // 2) يجب أن يكون مشرفاً
  const me = await (await fetch(`${url}/rest/v1/profiles?id=eq.${caller.id}&select=role`, { headers: H })).json()
  if (me?.[0]?.role !== 'admin') return json({ error: 'للمشرف فقط' }, 403)

  // 3) إنشاء الحساب
  const { email, password, full_name, role } = await request.json().catch(() => ({}))
  if (!email || !password || !['admin', 'employee'].includes(role)) return json({ error: 'بيانات ناقصة' }, 400)
  const cr = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: H,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }) })
  const created = await cr.json()
  if (!cr.ok) return json({ error: created.msg || created.message || created.error_description || 'تعذّر إنشاء الحساب' }, 400)

  // 4) حفظ الاسم والصلاحية في profiles
  const up = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, { method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: created.id, full_name: (full_name || '').trim(), role }) })
  if (!up.ok) return json({ error: 'أُنشئ الحساب لكن تعذّر حفظ الاسم: ' + (await up.text()) }, 500)
  return json({ ok: true })
}
