import { createClient } from '@supabase/supabase-js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: caller } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token)
  if (!caller?.user) return res.status(401).json({ error: 'غير مصرّح' })
  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single()
  if (me?.role !== 'admin') return res.status(403).json({ error: 'للمشرف فقط' })
  const { email, password, full_name, role } = req.body || {}
  if (!email || !password || !['admin', 'employee'].includes(role)) return res.status(400).json({ error: 'بيانات ناقصة' })
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return res.status(400).json({ error: error.message })
  await admin.from('profiles').update({ full_name, role }).eq('id', data.user.id)
  res.json({ ok: true })
}
