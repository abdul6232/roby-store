import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
const empty = { full_name: '', email: '', password: '', role: 'employee', can_edit_inventory: false }
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
  const rename = async (u, v) => { v = v.trim(); if (v === (u.full_name || '')) return
    const { error } = await supabase.from('profiles').update({ full_name: v }).eq('id', u.id); setMsg(error ? error.message : 'تم تحديث الاسم'); load() }
  const togglePerm = async (u, v) => { const { error } = await supabase.from('profiles').update({ can_edit_inventory: v }).eq('id', u.id)
    setMsg(error ? error.message : 'تم تحديث الصلاحية'); load() }
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
        {f.role === 'employee' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, color: 'var(--text)' }}><input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={f.can_edit_inventory} onChange={e => setF({ ...f, can_edit_inventory: e.target.checked })} />السماح بتعديل المخزون (إضافة/تعديل/حذف)</label>}
        {msg && <div className={msg.startsWith('تم') ? 'ok' : 'err'}>{msg}</div>}
        <div style={{ height: 14 }} /><button className="btn" disabled={busy}>إنشاء الحساب</button>
      </form>
      <div className="card"><table><thead><tr><th>الاسم</th><th>الصلاحية</th><th>تعديل المخزون</th></tr></thead>
        <tbody>{list.map(u => <tr key={u.id}><td><input defaultValue={u.full_name || ''} placeholder="اكتب الاسم" onBlur={e => rename(u, e.target.value)} /></td><td>{u.role === 'admin' ? 'مشرف' : 'موظف'}</td>
          <td>{u.role === 'admin' ? 'دائماً' : <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={!!u.can_edit_inventory} onChange={e => togglePerm(u, e.target.checked)} />}</td></tr>)}</tbody></table></div>
    </div></>)
}
