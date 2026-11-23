import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useRate, fmt, toSyp } from '../rate.js'
import SalesLog from '../components/SalesLog.jsx'

export default function Sales() {
  const rate = useRate()
  const [items, setItems] = useState([]); const [cats, setCats] = useState([]); const [cat, setCat] = useState(''); const [q, setQ] = useState('')
  const [id, setId] = useState(''); const [qty, setQty] = useState('1'); const [msg, setMsg] = useState(null); const [ver, setVer] = useState(0)
  const load = async () => {
    const [a, b] = await Promise.all([supabase.from('items').select('id,name,stock,price_usd,category_id').order('name'),
      supabase.from('categories').select('*').order('name')])
    setItems(a.data || []); setCats(b.data || [])
  }
  useEffect(() => { load() }, [])
  const shown = useMemo(() => items.filter(i => (!cat || (cat === 'none' ? !i.category_id : i.category_id === cat)) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()))), [items, cat, q])
  const it = items.find(i => i.id === id)
  const sell = async (e) => {
    e.preventDefault(); setMsg(null)
    const { error } = await supabase.from('sales').insert({ item_id: id, qty: parseInt(qty) || 1, unit_price_usd: it.price_usd })
    if (error) return setMsg({ err: error.message })
    setMsg({ ok: 'تم تسجيل البيعة وخصمها من المخزون' }); setQty('1'); setId(''); load(); setVer(v => v + 1)
  }
  return (<>
    <h2>المبيعات</h2>
    <div className="card">
      <div className="chips">
        <button className={'chip ' + (!cat ? 'on' : '')} onClick={() => setCat('')}>الكل</button>
        {cats.map(c => <button key={c.id} className={'chip ' + (cat === c.id ? 'on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>)}
        {items.some(i => !i.category_id) && <button className={'chip ' + (cat === 'none' ? 'on' : '')} onClick={() => setCat('none')}>بدون تصنيف</button>}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن قطعة…" style={{ marginBottom: 12 }} />
      <div className="pick">
        {shown.map(i => <button key={i.id} type="button" disabled={i.stock < 1} className={'pickitem ' + (id === i.id ? 'on' : '')} onClick={() => { setId(i.id); setQty('1'); setMsg(null) }}>
          <div style={{ fontWeight: 700 }}>{i.name}</div>
          <div className="num" style={{ color: 'var(--yellow)' }}>{fmt(i.price_usd)}$</div>
          <div style={{ color: i.stock <= 2 ? 'var(--danger)' : 'var(--muted)', fontSize: '.8rem' }}>المتوفر: {i.stock}</div></button>)}
        {!shown.length && <div style={{ color: 'var(--muted)' }}>لا توجد قطع في هذا القسم</div>}
      </div>
    </div>
    <form className="card" onSubmit={sell} style={{ marginTop: 16 }}>
      {it ? <>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.name}</div>
        <div style={{ maxWidth: 200 }}><label>الكمية</label><input className="num" type="number" min="1" max={it.stock} value={qty} onChange={e => setQty(e.target.value)} required /></div>
        <p style={{ color: 'var(--muted)' }}>السعر: <span className="num">{fmt(it.price_usd)}$</span> ({fmt(toSyp(+it.price_usd, rate), 0)} ل.س) — الإجمالي: <b className="num">{fmt(it.price_usd * (parseInt(qty) || 0))}$</b> ≈ <b className="num">{fmt(toSyp(it.price_usd * (parseInt(qty) || 0), rate), 0)} ل.س</b></p>
      </> : <p style={{ color: 'var(--muted)', margin: 0 }}>اختر قطعة من الأعلى لتسجيل بيعها.</p>}
      {msg?.err && <div className="err">{msg.err}</div>}{msg?.ok && <div className="ok">{msg.ok}</div>}
      <button className="btn" disabled={!id} style={{ marginTop: 8 }}>تسجيل البيعة</button>
    </form>
    <SalesLog ver={ver} />
  </>)
}
