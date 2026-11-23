import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useNames, fmtDT } from '../rate.js'
import { exportPdf } from '../pdf.js'

const T = { add: ['إضافة', 'var(--ok)'], edit_qty: ['تعديل الكمية', 'var(--blue)'], edit_price: ['تعديل السعر', 'var(--yellow)'],
  edit_data: ['تعديل بيانات', 'var(--muted)'], delete: ['حذف', 'var(--danger)'] }

export default function InventoryHistory() {
  const names = useNames()
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [type, setType] = useState('')
  useEffect(() => { supabase.from('inventory_history').select('*').order('created_at', { ascending: false }).limit(500)
    .then(({ data }) => setRows(data || [])) }, [])
  const val = (r, v) => v == null ? '—' : r.change_type === 'edit_price' ? v + '$' : v
  const who = (r) => names[r.created_by] || r.created_by_name || '—'
  const shown = useMemo(() => rows.filter(r => (!type || r.change_type === type) && (!q ||
    [r.item_name, who(r), r.field, r.old_value, r.new_value].some(x => (x || '').toLowerCase().includes(q.toLowerCase())))), [rows, q, type, names])
  const label = (r) => T[r.change_type][0] + (r.field ? ' - ' + r.field : '')
  const pdf = () => exportPdf({ title: 'سجل تعديلات المخزون', filename: `roby-inventory-history-${new Date().toISOString().slice(0, 10)}.pdf`,
    columns: [{ key: 'at', label: 'الوقت', num: 1 }, { key: 'item', label: 'القطعة' }, { key: 'type', label: 'النوع' },
      { key: 'old', label: 'قبل', num: 1 }, { key: 'new', label: 'بعد', num: 1 }, { key: 'by', label: 'الموظف' }],
    rows: shown.map(r => ({ at: fmtDT(r.created_at), item: r.item_name, type: label(r), old: val(r, r.old_value), new: val(r, r.new_value), by: who(r) })),
    summary: [['عدد التعديلات', shown.length]] })
  return (<>
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="chips">
        <button className={'chip ' + (!type ? 'on' : '')} onClick={() => setType('')}>الكل</button>
        {Object.entries(T).map(([k, [l]]) => <button key={k} className={'chip ' + (type === k ? 'on' : '')} onClick={() => setType(k)}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: '1 1 220px' }}><label>بحث (قطعة، موظف، قيمة…)</label><input value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn ghost" onClick={pdf} disabled={!shown.length}>تصدير PDF</button>
      </div>
    </div>
    <div className="card" style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>الوقت</th><th>القطعة</th><th>النوع</th><th>قبل</th><th>بعد</th><th>الموظف</th></tr></thead>
        <tbody>{shown.map(r => <tr key={r.id}><td className="num">{fmtDT(r.created_at)}</td><td>{r.item_name}</td>
          <td style={{ color: T[r.change_type][1], fontWeight: 700 }}>{label(r)}</td>
          <td className="num">{val(r, r.old_value)}</td><td className="num">{val(r, r.new_value)}</td><td>{who(r)}</td></tr>)}
          {!shown.length && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>لا توجد تعديلات</td></tr>}</tbody></table>
    </div></>)
}
