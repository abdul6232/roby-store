import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { exportPdf } from '../pdf.js'
import { fmtD } from '../rate.js'
export default function Shortages() {
  const [items, setItems] = useState([]); const [cats, setCats] = useState([]); const [man, setMan] = useState([])
  const [add, setAdd] = useState(''); const [note, setNote] = useState(''); const [msg, setMsg] = useState('')
  const load = async () => {
    const [a, b, c] = await Promise.all([supabase.from('items').select('*').order('name'),
      supabase.from('categories').select('*'), supabase.from('manual_shortages').select('*')])
    setItems(a.data || []); setCats(b.data || []); setMan(c.data || [])
  }
  useEffect(() => { load() }, [])
  const rows = useMemo(() => items.map(it => {
    const m = man.find(x => x.item_id === it.id), auto = it.stock <= it.min_stock && it.min_stock > 0
    return (auto || m) ? { it, m, src: auto && m ? 'تلقائي + يدوي' : auto ? 'تلقائي' : 'يدوي' } : null }).filter(Boolean), [items, man])
  const cat = (id) => cats.find(c => c.id === id)?.name || '—'
  const addManual = async () => { if (!add) return
    const { error } = await supabase.from('manual_shortages').insert({ item_id: add, note: note.trim() || null })
    error ? setMsg(error.code === '23505' ? 'القطعة مضافة مسبقاً' : error.message) : (setAdd(''), setNote(''), setMsg(''), load()) }
  const rm = async (m) => { await supabase.from('manual_shortages').delete().eq('id', m.id); load() }
  const pdf = () => exportPdf({ title: `قائمة النواقص - ${fmtD(new Date())}`, filename: `roby-shortages-${new Date().toISOString().slice(0, 10)}.pdf`,
    columns: [{ key: 'name', label: 'القطعة' }, { key: 'cat', label: 'التصنيف' }, { key: 'stock', label: 'الرصيد', num: 1 },
      { key: 'min', label: 'الحد الأدنى', num: 1 }, { key: 'src', label: 'المصدر' }, { key: 'note', label: 'ملاحظة' }],
    rows: rows.map(r => ({ name: r.it.name, cat: cat(r.it.category_id), stock: r.it.stock, min: r.it.min_stock, src: r.src, note: r.m?.note || '' })),
    summary: [['عدد النواقص', rows.length]] })
  return (<>
    <h2>النواقص</h2>
    <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
      <div style={{ flex: '1 1 200px' }}><label>إضافة يدوية</label><select value={add} onChange={e => setAdd(e.target.value)}>
        <option value="">اختر قطعة…</option>{items.filter(i => !man.some(m => m.item_id === i.id)).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      <div style={{ flex: '1 1 160px' }}><label>ملاحظة</label><input value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn" onClick={addManual}>إضافة</button>
      <button className="btn ghost" onClick={pdf} disabled={!rows.length}>تصدير PDF</button>
    </div>
    {msg && <div className="err">{msg}</div>}
    <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
      <table><thead><tr><th>القطعة</th><th>التصنيف</th><th>الرصيد</th><th>الحد الأدنى</th><th>المصدر</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.it.id}><td>{r.it.name}</td><td>{cat(r.it.category_id)}</td>
          <td className="num" style={{ color: 'var(--danger)', fontWeight: 700 }}>{r.it.stock}</td><td className="num">{r.it.min_stock}</td>
          <td>{r.src}</td><td>{r.m?.note || ''}</td>
          <td>{r.m && <button className="nav" style={{ color: 'var(--danger)' }} onClick={() => rm(r.m)}>إزالة</button>}</td></tr>)}
          {!rows.length && <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)' }}>لا توجد نواقص 🎉 (تأكد من ضبط «الحد الأدنى» للقطع)</td></tr>}</tbody></table>
    </div></>)
}
