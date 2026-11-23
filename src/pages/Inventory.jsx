import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth.jsx'
import { useRate, fmt, toSyp } from '../rate.js'
import { exportPdf } from '../pdf.js'
import InventoryHistory from '../components/InventoryHistory.jsx'

const blank = { id: null, name: '', category_id: '', stock: '0', min_stock: '0', usd: '', syp: '' }

export default function Inventory() {
  const { isAdmin, canEdit } = useAuth()
  const rate = useRate()
  const [items, setItems] = useState([]); const [cats, setCats] = useState([])
  const [q, setQ] = useState(''); const [catF, setCatF] = useState('')
  const [form, setForm] = useState(null); const [showCats, setShowCats] = useState(false)
  const [newCat, setNewCat] = useState(''); const [msg, setMsg] = useState(''); const [view, setView] = useState('list')

  const load = async () => {
    const [i, c] = await Promise.all([
      supabase.from('items').select('*').order('name'),
      supabase.from('categories').select('*').order('name')])
    setItems(i.data || []); setCats(c.data || [])
  }
  useEffect(() => { load() }, [])
  const catName = (id) => cats.find(c => c.id === id)?.name || 'بدون تصنيف'

  const shown = useMemo(() => items.filter(it =>
    (!catF || it.category_id === catF) && (!q || it.name.toLowerCase().includes(q.toLowerCase()))), [items, q, catF])
  const totalUsd = shown.reduce((s, it) => s + it.stock * +it.price_usd, 0)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const onUsd = (v) => { const n = parseFloat(v); setForm(f => ({ ...f, usd: v, syp: isNaN(n) ? '' : String(toSyp(n, rate)) })) }
  const onSyp = (v) => { const n = parseFloat(v); setForm(f => ({ ...f, syp: v, usd: isNaN(n) || !rate ? '' : String(+(n / rate).toFixed(4)) })) }

  const save = async (e) => {
    e.preventDefault(); setMsg('')
    const row = { name: form.name.trim(), category_id: form.category_id || null,
      stock: parseInt(form.stock) || 0, min_stock: parseInt(form.min_stock) || 0,
      price_usd: parseFloat(form.usd) || 0, updated_at: new Date().toISOString() }
    const { error } = form.id ? await supabase.from('items').update(row).eq('id', form.id)
      : await supabase.from('items').insert(row)
    if (error) return setMsg(error.message)
    setForm(null); load()
  }
  const edit = (it) => setForm({ id: it.id, name: it.name, category_id: it.category_id || '', stock: String(it.stock),
    min_stock: String(it.min_stock), usd: String(it.price_usd), syp: String(toSyp(+it.price_usd, rate)) })
  const del = async (it) => { if (!confirm(`حذف «${it.name}»؟`)) return
    const { error } = await supabase.from('items').delete().eq('id', it.id); error ? setMsg(error.message) : load() }
  const addCat = async () => { if (!newCat.trim()) return
    const { error } = await supabase.from('categories').insert({ name: newCat.trim() })
    error ? setMsg(error.code === '23505' ? 'التصنيف موجود مسبقاً' : error.message) : (setNewCat(''), load()) }
  const delCat = async (c) => { if (!confirm(`حذف التصنيف «${c.name}»؟ (تبقى بضائعه بدون تصنيف)`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id); error ? setMsg(error.message) : load() }

  const doPdf = () => exportPdf({
    title: 'تقرير المخزون', filename: `roby-inventory-${new Date().toISOString().slice(0, 10)}.pdf`,
    columns: [{ key: 'name', label: 'الاسم' }, { key: 'cat', label: 'التصنيف' }, { key: 'stock', label: 'الرصيد', num: 1 },
      { key: 'usd', label: 'السعر ($)', num: 1 }, { key: 'syp', label: 'السعر (ل.س)', num: 1 }, { key: 'tot', label: 'القيمة ($)', num: 1 }],
    rows: shown.map(it => ({ name: it.name, cat: catName(it.category_id), stock: it.stock, usd: fmt(it.price_usd),
      syp: fmt(toSyp(+it.price_usd, rate), 0), tot: fmt(it.stock * +it.price_usd) })),
    summary: [['عدد الأصناف', shown.length], ['القيمة الإجمالية ($)', fmt(totalUsd)],
      ['القيمة الإجمالية (ل.س)', fmt(toSyp(totalUsd, rate), 0)], ['سعر الصرف', `1$ = ${fmt(rate, 0)} ل.س`]] })

  if (view === 'history') return (<>
    <h2>سجل تعديلات المخزون</h2>
    <button className="btn ghost" style={{ marginBottom: 16 }} onClick={() => setView('list')}>← عودة للمخزون</button>
    <InventoryHistory />
  </>)

  return (<>
    <h2>المخزون</h2>
    <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
      <div style={{ flex: '1 1 180px' }}><label>بحث</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="اسم القطعة…" /></div>
      <div style={{ flex: '1 1 150px' }}><label>التصنيف</label>
        <select value={catF} onChange={e => setCatF(e.target.value)}><option value="">الكل</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {canEdit && <button className="btn" onClick={() => setForm({ ...blank })}>+ قطعة جديدة</button>}
      <button className="btn ghost" onClick={() => setShowCats(!showCats)}>التصنيفات</button>
      <button className="btn ghost" onClick={doPdf} disabled={!shown.length}>تصدير PDF</button>
      {canEdit && <button className="btn ghost" onClick={() => setView('history')}>سجل التعديلات</button>}
    </div>
    {msg && <div className="err">{msg}</div>}

    {showCats && <div className="card" style={{ marginBottom: 16 }}>
      <label>تصنيف جديد</label>
      <div style={{ display: 'flex', gap: 8 }}><input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="مثال: كفرات، شواحن، سماعات"
        onKeyDown={e => e.key === 'Enter' && addCat()} /><button className="btn" onClick={addCat}>إضافة</button></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {cats.map(c => <span key={c.id} style={{ background: 'var(--surface2)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--line)' }}>
          {c.name}{isAdmin && <button className="nav" style={{ padding: '0 0 0 4px', color: 'var(--danger)' }} onClick={() => delCat(c)}> ✕</button>}</span>)}
        {!cats.length && <span style={{ color: 'var(--muted)' }}>لا توجد تصنيفات بعد</span>}</div>
    </div>}

    {form && <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{form.id ? 'تعديل القطعة' : 'قطعة جديدة'}</h3>
      <div className="grid g2">
        <div><label>الاسم</label><input value={form.name} onChange={e => setF('name', e.target.value)} required /></div>
        <div><label>التصنيف</label><select value={form.category_id} onChange={e => setF('category_id', e.target.value)}>
          <option value="">بدون تصنيف</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>السعر بالدولار ($)</label><input className="num" inputMode="decimal" value={form.usd} onChange={e => onUsd(e.target.value)} /></div>
        <div><label>السعر بالليرة (ل.س)</label><input className="num" inputMode="decimal" value={form.syp} onChange={e => onSyp(e.target.value)} disabled={!rate} /></div>
        <div><label>الرصيد الحالي</label><input className="num" type="number" min="0" value={form.stock} onChange={e => setF('stock', e.target.value)} /></div>
        <div><label>الحد الأدنى (للنواقص)</label><input className="num" type="number" min="0" value={form.min_stock} onChange={e => setF('min_stock', e.target.value)} /></div>
      </div>
      {!rate && <div className="err">حدّد سعر الصرف أولاً ليعمل التحويل إلى الليرة.</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn">حفظ</button>
        <button type="button" className="btn ghost" onClick={() => setForm(null)}>إلغاء</button></div>
    </form>}

    <div className="card" style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>الاسم</th><th>التصنيف</th><th>الرصيد</th><th>السعر ($)</th><th>السعر (ل.س)</th><th></th></tr></thead>
        <tbody>{shown.map(it => {
          const low = it.stock <= it.min_stock
          return <tr key={it.id}><td>{it.name}</td><td>{catName(it.category_id)}</td>
            <td className="num" style={{ color: low ? 'var(--danger)' : 'inherit', fontWeight: 700 }}>{it.stock}</td>
            <td className="num">{fmt(it.price_usd)}</td><td className="num">{fmt(toSyp(+it.price_usd, rate), 0)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{canEdit && <button className="nav" style={{ color: 'var(--blue)' }} onClick={() => edit(it)}>تعديل</button>}
              {canEdit && <button className="nav" style={{ color: 'var(--danger)' }} onClick={() => del(it)}>حذف</button>}</td></tr>})}
          {!shown.length && <tr><td colSpan="6" style={{ color: 'var(--muted)', textAlign: 'center' }}>لا توجد قطع</td></tr>}</tbody></table>
      <p style={{ color: 'var(--muted)', marginBottom: 0 }}>القيمة الإجمالية: <span className="num">{fmt(totalUsd)}$</span> ≈ <span className="num">{fmt(toSyp(totalUsd, rate), 0)} ل.س</span></p>
    </div>
  </>)
}
