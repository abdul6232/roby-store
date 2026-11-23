import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth.jsx'
import { useRate, useNames, fmt, toSyp } from '../rate.js'
import { exportPdf } from '../pdf.js'
import SalesLog from '../components/SalesLog.jsx'

const pos = (n) => Math.max(n, 0)
const cumul = (sts, reset) => sts.filter(s => !reset || s.created_at > reset.reset_at)
  .reduce((t, s) => t + s.stocktake_lines.reduce((a, l) => a + pos(l.shortage_qty) * +l.unit_price_usd, 0), 0)

export default function Stocktake() {
  const { isAdmin } = useAuth(); const rate = useRate(); const names = useNames(); const auto = useRef(false)
  const [sts, setSts] = useState([]); const [resets, setResets] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [draft, setDraft] = useState(null); const [shelf, setShelf] = useState({}); const [msg, setMsg] = useState('')
  const lastSt = sts[0]; const periodStart = lastSt?.created_at || '1970-01-01T00:00:00Z'
  const cum = cumul(sts, resets[0])

  const load = async () => {
    const [a, b] = await Promise.all([supabase.from('stocktakes').select('*, stocktake_lines(*)').order('created_at', { ascending: false }),
      supabase.from('shortage_resets').select('*').order('reset_at', { ascending: false })])
    const S = a.data || [], R = b.data || []; setSts(S); setResets(R)
    const ref = R[0]?.reset_at || S[S.length - 1]?.created_at, now = new Date()   // تصفير شهري تلقائي
    if (isAdmin && !auto.current && ref && new Date(ref).getFullYear() * 12 + new Date(ref).getMonth() < now.getFullYear() * 12 + now.getMonth()) {
      auto.current = true
      await supabase.from('shortage_resets').insert({ kind: 'monthly', total_usd: cumul(S, R[0]) }); load()
    }
  }
  useEffect(() => { load() }, [isAdmin])

  const start = async () => {
    const [{ data: items }, { data: sales }] = await Promise.all([supabase.from('items').select('id,name,stock,price_usd').order('name'),
      supabase.from('sales').select('item_id,qty').gte('sold_at', periodStart)])
    const sold = {}; (sales || []).forEach(s => { sold[s.item_id] = (sold[s.item_id] || 0) + s.qty })
    setDraft((items || []).map(i => ({ item_id: i.id, item_name: i.name, sold_qty: sold[i.id] || 0, before_qty: i.stock + (sold[i.id] || 0),
      expected_qty: i.stock, unit_price_usd: +i.price_usd }))); setShelf({})
  }
  const lines = (draft || []).filter(r => shelf[r.item_id] !== undefined && shelf[r.item_id] !== '')
    .map(r => ({ ...r, shelf_qty: parseInt(shelf[r.item_id]) || 0, shortage_qty: r.expected_qty - (parseInt(shelf[r.item_id]) || 0) }))
  const shortUsd = lines.reduce((t, l) => t + pos(l.shortage_qty) * l.unit_price_usd, 0)

  const pdf = (L, d, summaryExtra = []) => {
    const stockV = L.reduce((t, l) => t + l.expected_qty * +l.unit_price_usd, 0), shelfV = L.reduce((t, l) => t + l.shelf_qty * +l.unit_price_usd, 0)
    const sh = L.reduce((t, l) => t + pos(l.shortage_qty) * +l.unit_price_usd, 0)
    const day = new Date(d).toLocaleDateString('ar', { weekday: 'long' })
    exportPdf({ title: `تقرير الجرد - ${day} ${new Date(d).toLocaleDateString('en-GB')}`, filename: `roby-stocktake-${d}.pdf`,
      columns: [{ key: 'n', label: 'القطعة' }, { key: 'b', label: 'قبل البيع', num: 1 }, { key: 's', label: 'المباع', num: 1 },
        { key: 'e', label: 'المتوقع', num: 1 }, { key: 'sh', label: 'على الرف', num: 1 }, { key: 'sq', label: 'النقص', num: 1 }, { key: 'sv', label: 'قيمة النقص ($)', num: 1 }],
      rows: L.map(l => ({ n: l.item_name, b: l.before_qty, s: l.sold_qty, e: l.expected_qty, sh: l.shelf_qty, sq: l.shortage_qty, sv: fmt(pos(l.shortage_qty) * +l.unit_price_usd) })),
      summary: [['نقص الأسبوع ($)', fmt(sh)], ['نقص الأسبوع (ل.س)', fmt(toSyp(sh, rate), 0)],
        ['قيمة المخزون بعد الخصم ($)', fmt(stockV)], ['قيمة المخزون بعد الخصم (ل.س)', fmt(toSyp(stockV, rate), 0)],
        ['قيمة الموجود فعلياً على الرف ($)', fmt(shelfV)], ...summaryExtra] })
  }
  const save = async () => {
    if (!lines.length) return setMsg('أدخل عدد القطع الموجودة على الرف لقطعة واحدة على الأقل')
    const { data: st, error } = await supabase.from('stocktakes').insert({ stock_date: date, period_start: periodStart }).select().single()
    if (error) return setMsg(error.message)
    const { error: e2 } = await supabase.from('stocktake_lines').insert(lines.map(l => ({ stocktake_id: st.id, item_id: l.item_id, item_name: l.item_name,
      before_qty: l.before_qty, sold_qty: l.sold_qty, expected_qty: l.expected_qty, shelf_qty: l.shelf_qty, shortage_qty: l.shortage_qty, unit_price_usd: l.unit_price_usd })))
    if (e2) return setMsg(e2.message)
    setMsg('تم حفظ الجرد'); setDraft(null); load()
  }
  const reset = async () => { if (!confirm('تصفير النقص التراكمي الآن؟')) return
    const { error } = await supabase.from('shortage_resets').insert({ kind: 'manual', total_usd: cum }); error ? setMsg(error.message) : load() }

  return (<>
    <h2>الجرد وضبط النقص</h2>
    <div className="grid g2">
      <div className="card">
        <label>يوم الجرد</label><input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <p style={{ color: 'var(--muted)' }}>{new Date(date).toLocaleDateString('ar', { weekday: 'long' })}</p>
        <button className="btn" onClick={start}>بدء جرد جديد</button>
      </div>
      <div className="card">
        <label>النقص التراكمي منذ آخر تصفير {resets[0] && `(${new Date(resets[0].reset_at).toLocaleDateString('en-GB')})`}</label>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--yellow)' }} className="num">{fmt(cum)}$</div>
        <div className="num" style={{ color: 'var(--muted)' }}>{fmt(toSyp(cum, rate), 0)} ل.س</div>
        {isAdmin && <><div style={{ height: 10 }} /><button className="btn ghost" onClick={reset}>تصفير النقص</button>
          <p style={{ color: 'var(--muted)', fontSize: '.8rem', marginBottom: 0 }}>يُصفَّر تلقائياً مع بداية كل شهر عند دخول المشرف.</p></>}
      </div>
    </div>
    {msg && <div className={msg.startsWith('تم') ? 'ok' : 'err'}>{msg}</div>}

    {draft && <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>قيمة المخزون بعد الخصم: <b className="num">{fmt(draft.reduce((t, r) => t + r.expected_qty * r.unit_price_usd, 0))}$</b></div>
        <div>نقص هذا الجرد: <b className="num" style={{ color: 'var(--danger)' }}>{fmt(shortUsd)}$ ({fmt(toSyp(shortUsd, rate), 0)} ل.س)</b></div>
      </div>
      <table><thead><tr><th>القطعة</th><th>قبل البيع</th><th>المباع</th><th>المتوقع</th><th>على الرف</th><th>النقص</th></tr></thead>
        <tbody>{draft.map(r => { const v = shelf[r.item_id], sq = v === undefined || v === '' ? null : r.expected_qty - (parseInt(v) || 0)
          return <tr key={r.item_id}><td>{r.item_name}</td><td className="num">{r.before_qty}</td><td className="num">{r.sold_qty}</td><td className="num">{r.expected_qty}</td>
            <td style={{ width: 100 }}><input className="num" type="number" min="0" value={v ?? ''} onChange={e => setShelf({ ...shelf, [r.item_id]: e.target.value })} /></td>
            <td className="num" style={{ fontWeight: 700, color: sq > 0 ? 'var(--danger)' : sq < 0 ? 'var(--blue)' : 'inherit' }}>{sq === null ? '' : sq}</td></tr> })}</tbody></table>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn" onClick={save}>حفظ الجرد</button>
        <button className="btn ghost" onClick={() => pdf(lines, date, [['النقص التراكمي ($)', fmt(cum + shortUsd)]])} disabled={!lines.length}>تصدير PDF</button>
        <button className="btn ghost" onClick={() => setDraft(null)}>إلغاء</button></div>
      <p style={{ color: 'var(--muted)', marginBottom: 0 }}>اترك خانة «على الرف» فارغة للقطعة التي لم تُجرد. المتوقع = قبل البيع − المباع، والنقص = المتوقع − الموجود على الرف.</p>
    </div>}

    <SalesLog since={periodStart} title="مبيعات فترة الجرد (منذ الجرد السابق)" />

    <div className="card" style={{ marginTop: 16 }}><h3 style={{ marginTop: 0 }}>الجردات السابقة</h3>
      <table><thead><tr><th>اليوم</th><th>نقص الجرد ($)</th><th>أجراه</th><th></th></tr></thead>
        <tbody>{sts.map(s => <tr key={s.id}><td className="num">{new Date(s.stock_date).toLocaleDateString('en-GB')}</td>
          <td className="num">{fmt(s.stocktake_lines.reduce((a, l) => a + pos(l.shortage_qty) * +l.unit_price_usd, 0))}</td><td>{names[s.created_by] || s.created_by_name}</td>
          <td><button className="nav" style={{ color: 'var(--blue)' }} onClick={() => pdf(s.stocktake_lines, s.stock_date, [['النقص التراكمي الحالي ($)', fmt(cum)]])}>PDF</button></td></tr>)}
          {!sts.length && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>لا توجد جردات</td></tr>}</tbody></table></div>
  </>)
}
