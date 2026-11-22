import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
const empty = { full_name: '', email: '', password: '', role: 'employee' }
export default function Users() {
  const [list, setList] = useState([]); const [f, setF] = useState(empty)
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/create-user', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(f) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMsg(j.error || 'حدث خطأ')
    setMsg('تم إنشاء الحساب'); setF(empty); load()
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (<>
    <h2>الإدارة والحسابات</h2>
    <div className="grid g2">
      <form className="card" onSubmit={create}>
        <label>الاسم</label><input value={f.full_name} onChange={set('full_name')} required />
        <div style={{ height: 10 }} /><label>البريد الإلكتروني</label><input dir="ltr" type="email" value={f.email} onChange={set('email')} required />
        <div style={{ height: 10 }} /><label>كلمة المرور</label><input dir="ltr" minLength={6} value={f.password} onChange={set('password')} required />
        <div style={{ height: 10 }} /><label>الصلاحية</label>
        <select value={f.role} onChange={set('role')}><option value="employee">موظف</option><option value="admin">مشرف</option></select>
        {msg && <div className={msg.startsWith('تم') ? 'ok' : 'err'}>{msg}</div>}
        <div style={{ height: 14 }} /><button className="btn" disabled={busy}>إنشاء الحساب</button>
      </form>
      <div className="card"><table><thead><tr><th>الاسم</th><th>الصلاحية</th></tr></thead>
        <tbody>{list.map(u => <tr key={u.id}><td>{u.full_name || '—'}</td><td>{u.role === 'admin' ? 'مشرف' : 'موظف'}</td></tr>)}</tbody></table></div>
    </div></>)
}
