import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth.jsx'
import { useRate, fmt, toSyp, fmtDT } from '../rate.js'
import { exportPdf } from '../pdf.js'

export default function SalesLog({ since, ver = 0, title = 'سجل المبيعات' }) {
  const { isAdmin } = useAuth(); const rate = useRate()
  const [rows, setRows] = useState([]); const [seller, setSeller] = useState('')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  useEffect(() => {
    let q = supabase.from('sales').select('*').order('sold_at', { ascending: false }).limit(1000)
    const s = since || (from ? from + 'T00:00:00' : null)
    if (s) q = q.gte('sold_at', s)
    if (!since && to) q = q.lte('sold_at', to + 'T23:59:59')
    q.then(({ data }) => setRows(data || []))
  }, [since, from, to, ver])
  const sellers = useMemo(() => [...new Map(rows.map(r => [r.seller_id, r.seller_name])).entries()], [rows])
  const shown = rows.filter(r => !seller || r.seller_id === seller)
  const total = shown.reduce((s, r) => s + r.qty * +r.unit_price_usd, 0)
  const pdf = () => exportPdf({ title: title + (seller ? ' - ' + (sellers.find(s => s[0] === seller)?.[1] || '') : ''),
    filename: `roby-sales-${new Date().toISOString().slice(0, 10)}.pdf`,
    columns: [{ key: 'at', label: 'التاريخ والوقت', num: 1 }, { key: 'item', label: 'القطعة' }, { key: 'qty', label: 'الكمية', num: 1 },
      { key: 'tot', label: 'المبلغ ($)', num: 1 }, { key: 'by', label: 'البائع' }],
    rows: shown.map(r => ({ at: fmtDT(r.sold_at), item: r.item_name, qty: r.qty, tot: fmt(r.qty * +r.unit_price_usd), by: r.seller_name })),
    summary: [['عدد العمليات', shown.length], ['الإجمالي ($)', fmt(total)], ['الإجمالي (ل.س)', fmt(toSyp(total, rate), 0)]] })
  return (
    <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
        {isAdmin && <div style={{ flex: '1 1 160px' }}><label>الموظف</label>
          <select value={seller} onChange={e => setSeller(e.target.value)}><option value="">كل الموظفين</option>
            {sellers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>}
        {!since && <><div><label>من</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label>إلى</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div></>}
        <button className="btn ghost" onClick={pdf} disabled={!shown.length}>تصدير PDF</button>
      </div>
      <table><thead><tr><th>الوقت</th><th>القطعة</th><th>الكمية</th><th>المبلغ ($)</th><th>البائع</th></tr></thead>
        <tbody>{shown.map(r => <tr key={r.id}><td className="num">{fmtDT(r.sold_at)}</td><td>{r.item_name}</td><td className="num">{r.qty}</td>
          <td className="num">{fmt(r.qty * +r.unit_price_usd)}</td><td>{r.seller_name}</td></tr>)}
          {!shown.length && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)' }}>لا توجد مبيعات</td></tr>}</tbody></table>
      <p style={{ color: 'var(--muted)', marginBottom: 0 }}>الإجمالي: <span className="num">{fmt(total)}$</span> ≈ <span className="num">{fmt(toSyp(total, rate), 0)} ل.س</span></p>
    </div>)
}
