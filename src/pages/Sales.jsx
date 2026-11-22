import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useRate, fmt, toSyp } from '../rate.js'
import SalesLog from '../components/SalesLog.jsx'

export default function Sales() {
  const rate = useRate()
  const [items, setItems] = useState([]); const [id, setId] = useState(''); const [qty, setQty] = useState('1')
  const [msg, setMsg] = useState(null); const [ver, setVer] = useState(0)
  const load = () => supabase.from('items').select('id,name,stock,price_usd').order('name').then(({ data }) => setItems(data || []))
  useEffect(() => { load() }, [])
  const it = items.find(i => i.id === id)
  const sell = async (e) => {
    e.preventDefault(); setMsg(null)
    const { error } = await supabase.from('sales').insert({ item_id: id, qty: parseInt(qty) || 1, unit_price_usd: it.price_usd })
    if (error) return setMsg({ err: error.message })
    setMsg({ ok: 'تم تسجيل البيعة وخصمها من المخزون' }); setQty('1'); setId(''); load(); setVer(v => v + 1)
  }
  return (<>
    <h2>المبيعات</h2>
    <form className="card" onSubmit={sell}>
      <div className="grid g2">
        <div><label>القطعة</label><select value={id} onChange={e => setId(e.target.value)} required>
          <option value="">اختر…</option>{items.map(i => <option key={i.id} value={i.id} disabled={i.stock < 1}>{i.name} ({i.stock})</option>)}</select></div>
        <div><label>الكمية</label><input className="num" type="number" min="1" max={it?.stock} value={qty} onChange={e => setQty(e.target.value)} required /></div>
      </div>
      {it && <p style={{ color: 'var(--muted)' }}>السعر: <span className="num">{fmt(it.price_usd)}$</span> ({fmt(toSyp(+it.price_usd, rate), 0)} ل.س) — المتوفر: {it.stock}
        — الإجمالي: <b className="num">{fmt(it.price_usd * (parseInt(qty) || 0))}$</b></p>}
      {msg?.err && <div className="err">{msg.err}</div>}{msg?.ok && <div className="ok">{msg.ok}</div>}
      <button className="btn" disabled={!id}>تسجيل البيعة</button>
    </form>
    <SalesLog ver={ver} />
  </>)
}
