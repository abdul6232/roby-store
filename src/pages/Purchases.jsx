import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useRate, useNames, fmt, toSyp, fmtDT } from '../rate.js'
import { exportPdf } from '../pdf.js'
const blank = { item_id: '', qty: '1', usd: '', syp: '', supplier: '' }
export default function Purchases() {
  const rate = useRate(); const names = useNames()
  const [items, setItems] = useState([]); const [rows, setRows] = useState([]); const [f, setF] = useState(blank); const [msg, setMsg] = useState(null)
  const load = async () => {
    const [a, b] = await Promise.all([supabase.from('items').select('id,name').order('name'),
      supabase.from('purchases').select('*').order('purchased_at', { ascending: false }).limit(500)])
    setItems(a.data || []); setRows(b.data || [])
  }
  useEffect(() => { load() }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const onUsd = (v) => { const n = parseFloat(v); setF({ ...f, usd: v, syp: isNaN(n) ? '' : String(toSyp(n, rate)) }) }
  const onSyp = (v) => { const n = parseFloat(v); setF({ ...f, syp: v, usd: isNaN(n) || !rate ? '' : String(+(n / rate).toFixed(4)) }) }
  const save = async (e) => {
    e.preventDefault(); setMsg(null)
    const { error } = await supabase.from('purchases').insert({ item_id: f.item_id, qty: parseInt(f.qty) || 1,
      unit_cost_usd: parseFloat(f.usd) || 0, supplier: f.supplier.trim() || null })
    if (error) return setMsg({ err: error.message })
    setMsg({ ok: 'تمت الإضافة إلى المخزون' }); setF(blank); load()
  }
  const total = rows.reduce((s, r) => s + r.qty * +r.unit_cost_usd, 0)
  const pdf = () => exportPdf({ title: 'سجل المشتريات', filename: `roby-purchases-${new Date().toISOString().slice(0, 10)}.pdf`,
    columns: [{ key: 'at', label: 'التاريخ', num: 1 }, { key: 'item', label: 'القطعة' }, { key: 'qty', label: 'الكمية', num: 1 },
      { key: 'cost', label: 'التكلفة ($)', num: 1 }, { key: 'tot', label: 'الإجمالي ($)', num: 1 }, { key: 'sup', label: 'المورّد' }],
    rows: rows.map(r => ({ at: fmtDT(r.purchased_at), item: r.item_name, qty: r.qty, cost: fmt(r.unit_cost_usd), tot: fmt(r.qty * +r.unit_cost_usd), sup: r.supplier || '—' })),
    summary: [['عدد العمليات', rows.length], ['إجمالي المشتريات ($)', fmt(total)], ['إجمالي المشتريات (ل.س)', fmt(toSyp(total, rate), 0)]] })
  return (<>
    <h2>المشتريات</h2>
    <form className="card" onSubmit={save}>
      <div className="grid g2">
        <div><label>القطعة</label><select value={f.item_id} onChange={set('item_id')} required><option value="">اختر…</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
        <div><label>الكمية</label><input className="num" type="number" min="1" value={f.qty} onChange={set('qty')} required /></div>
        <div><label>سعر الشراء للقطعة ($)</label><input className="num" inputMode="decimal" value={f.usd} onChange={e => onUsd(e.target.value)} /></div>
        <div><label>سعر الشراء للقطعة (ل.س)</label><input className="num" inputMode="decimal" value={f.syp} onChange={e => onSyp(e.target.value)} disabled={!rate} /></div>
        <div><label>المورّد (اختياري)</label><input value={f.supplier} onChange={set('supplier')} /></div>
      </div>
      {msg?.err && <div className="err">{msg.err}</div>}{msg?.ok && <div className="ok">{msg.ok}</div>}
      <div style={{ height: 12 }} /><button className="btn" disabled={!f.item_id}>تسجيل الشراء</button>
    </form>
    <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
      <button className="btn ghost" onClick={pdf} disabled={!rows.length} style={{ marginBottom: 12 }}>تصدير PDF</button>
      <table><thead><tr><th>التاريخ</th><th>القطعة</th><th>الكمية</th><th>التكلفة ($)</th><th>المورّد</th><th>سجّلها</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td className="num">{fmtDT(r.purchased_at)}</td><td>{r.item_name}</td><td className="num">{r.qty}</td>
          <td className="num">{fmt(r.unit_cost_usd)}</td><td>{r.supplier || '—'}</td><td>{names[r.created_by] || r.created_by_name}</td></tr>)}
          {!rows.length && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>لا توجد مشتريات</td></tr>}</tbody></table>
    </div></>)
}
