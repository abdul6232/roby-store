import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth.jsx'
const fmt = (n) => (isFinite(n) && n !== '' ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')
export default function Exchange() {
  const { isAdmin } = useAuth()
  const [rate, setRate] = useState(0); const [rateInput, setRateInput] = useState('')
  const [usd, setUsd] = useState(''); const [syp, setSyp] = useState(''); const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('settings').select('usd_to_syp').eq('id', 1).single()
    .then(({ data }) => { if (data) { setRate(+data.usd_to_syp); setRateInput(String(data.usd_to_syp)) } }) }, [])
  const save = async () => {
    const r = parseFloat(rateInput); if (!(r > 0)) return setMsg('أدخل سعراً صحيحاً')
    const { error } = await supabase.from('settings').update({ usd_to_syp: r, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) setMsg(error.message); else { setRate(r); setMsg('تم حفظ سعر الصرف'); setTimeout(() => setMsg(''), 2500) }
  }
  const onUsd = (v) => { setUsd(v); const n = parseFloat(v); setSyp(isNaN(n) ? '' : String(+(n * rate).toFixed(2))) }
  const onSyp = (v) => { setSyp(v); const n = parseFloat(v); setUsd(isNaN(n) || !rate ? '' : String(+(n / rate).toFixed(4))) }
  return (<>
    <h2>سعر الصرف والتحويل الفوري</h2>
    <div className="grid g2">
      <div className="card">
        <label>سعر الدولار بالليرة السورية</label>
        <input className="num" inputMode="decimal" value={rateInput} onChange={e => setRateInput(e.target.value)} disabled={!isAdmin} />
        {isAdmin ? <><div style={{ height: 12 }} /><button className="btn" onClick={save}>حفظ السعر</button></>
          : <p style={{ color: 'var(--muted)' }}>تعديل السعر للمشرف فقط</p>}
        {msg && <div className="ok">{msg}</div>}
        <p style={{ color: 'var(--muted)' }}>1$ = <span className="num">{fmt(rate)}</span> ل.س</p>
      </div>
      <div className="card">
        <label>بالدولار ($)</label><input className="num" inputMode="decimal" value={usd} onChange={e => onUsd(e.target.value)} />
        <div style={{ height: 12 }} />
        <label>بالليرة السورية (ل.س)</label><input className="num" inputMode="decimal" value={syp} onChange={e => onSyp(e.target.value)} />
      </div>
    </div></>)
}
