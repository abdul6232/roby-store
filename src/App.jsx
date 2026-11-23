import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth.jsx'
import Exchange from './pages/Exchange.jsx'
import Users from './pages/Users.jsx'
import Inventory from './pages/Inventory.jsx'
import Purchases from './pages/Purchases.jsx'
import Shortages from './pages/Shortages.jsx'
import Sales from './pages/Sales.jsx'
import Stocktake from './pages/Stocktake.jsx'
import Logo from './components/Logo.jsx'

function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [mode, setMode] = useState('in'); const [msg, setMsg] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setMsg('')
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('تم إنشاء الحساب. إن طُلب تأكيد البريد فتحقق من صندوقك.')
  }
  return (
    <div className="center"><form className="card" onSubmit={submit}>
      <Logo />
      <h2>{mode === 'in' ? 'تسجيل الدخول' : 'إنشاء الحساب الأول (المشرف)'}</h2>
      <label>البريد الإلكتروني</label><input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} required />
      <div style={{ height: 12 }} />
      <label>كلمة المرور</label><input type="password" dir="ltr" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
      {msg && <div className="err">{msg}</div>}
      <div style={{ height: 16 }} />
      <button className="btn" style={{ width: '100%' }}>{mode === 'in' ? 'دخول' : 'إنشاء'}</button>
      <p style={{ textAlign: 'center' }}><button type="button" className="nav" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'أول مرة؟ أنشئ حساب المشرف' : 'لدي حساب'}</button></p>
    </form></div>)
}

export default function App() {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  const [tab, setTab] = useState('inventory')
  useEffect(() => { // يضيف عناوين الأعمدة لكل خلية ليظهر الجدول كبطاقات على الجوال
    const apply = () => document.querySelectorAll('table').forEach(t => { const h = [...t.querySelectorAll('thead th')].map(x => x.textContent)
      t.querySelectorAll('tbody tr').forEach(r => [...r.children].forEach((td, i) => { if (!td.hasAttribute('colspan')) td.dataset.label = h[i] || '' })) })
    apply(); const mo = new MutationObserver(apply); mo.observe(document.body, { childList: true, subtree: true }); return () => mo.disconnect()
  }, [])
  if (loading) return <div className="center">جارٍ التحميل…</div>
  if (!session || !profile) return <Login />
  const tabs = [['inventory', 'المخزون'], ['sales', 'المبيعات'], ['purchases', 'المشتريات'], ['shortages', 'النواقص'], ['stocktake', 'الجرد'], ['exchange', 'سعر الصرف'], ...(isAdmin ? [['users', 'الإدارة والحسابات']] : [])]
  return (
    <div className="shell">
      <aside className="side">
        <Logo />
        {tabs.map(([k, t]) => <button key={k} className={'nav ' + (tab === k ? 'on' : '')} onClick={() => setTab(k)}>{t}</button>)}
        <div className="spacer" style={{ flex: 1 }} />
        <div className="who" style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{profile.full_name || session.user.email}<br />({isAdmin ? 'مشرف' : 'موظف'})</div>
        <button className="btn ghost" onClick={signOut}>خروج</button>
      </aside>
      <main className="main">
        {tab === 'inventory' && <Inventory />}
        {tab === 'sales' && <Sales />}
        {tab === 'purchases' && <Purchases />}
        {tab === 'shortages' && <Shortages />}
        {tab === 'stocktake' && <Stocktake />}
        {tab === 'exchange' && <Exchange />}
        {tab === 'users' && isAdmin && <Users />}
      </main>
    </div>)
}
