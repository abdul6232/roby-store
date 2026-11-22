// تصدير PDF عربي RTL قابل لإعادة الاستخدام: يرسم الصفحات بخط Cairo ثم يضعها في PDF (حروف متصلة سليمة).
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const el = (tag, css = '', text) => {
  const e = document.createElement(tag); e.style.cssText = css
  if (text !== undefined) e.textContent = text
  return e
}
/**
 * exportPdf({ title, filename, columns:[{key,label,num?,width?}], rows:[{key:value}],
 *            summary:[[label,value]], rowsPerPage })
 */
export async function exportPdf({ title, filename = 'report.pdf', columns, rows, summary = [], rowsPerPage = 20 }) {
  await document.fonts.load('700 16px Cairo'); await document.fonts.load('400 16px Cairo'); await document.fonts.ready
  const pages = []
  for (let i = 0; i < Math.max(rows.length, 1); i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage))
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const date = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
  for (let p = 0; p < pages.length; p++) {
    const page = el('div', 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;background:#fff;color:#111;direction:rtl;font-family:Cairo,sans-serif;padding:44px 40px;box-sizing:border-box;display:flex;flex-direction:column')
    const head = el('div', 'display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #e8c41c;padding-bottom:12px;margin-bottom:16px')
    const brand = el('div', 'font-size:28px;font-weight:700;color:#111'); brand.append(el('span', '', 'روبي '), el('span', 'color:#1aa3e8;font-size:16px;letter-spacing:2px;direction:ltr;display:inline-block', 'ROBY'))
    const meta = el('div', 'text-align:left;font-size:12px;color:#555;direction:ltr', date)
    head.append(brand, meta); page.append(head)
    page.append(el('div', 'font-size:22px;font-weight:700;margin-bottom:12px', title))
    if (p === 0 && summary.length) {
      const box = el('div', 'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px')
      summary.forEach(([l, v]) => { const c = el('div', 'background:#f6f6f7;border-right:4px solid #1aa3e8;padding:8px 14px;border-radius:6px')
        c.append(el('div', 'font-size:11px;color:#666', l), el('div', 'font-size:15px;font-weight:700;direction:ltr;unicode-bidi:plaintext;text-align:right', String(v))); box.append(c) })
      page.append(box)
    }
    const table = el('table', 'width:100%;border-collapse:collapse;font-size:13px')
    const tr0 = el('tr'); columns.forEach(c => tr0.append(el('th', `background:#111;color:#e8c41c;padding:8px 6px;text-align:${c.num ? 'center' : 'right'};${c.width ? 'width:' + c.width + ';' : ''}`, c.label)))
    const thead = el('thead'); thead.append(tr0); table.append(thead)
    const tb = el('tbody')
    pages[p].forEach((r, i) => { const tr = el('tr', i % 2 ? 'background:#f6f6f7' : '')
      columns.forEach(c => tr.append(el('td', `padding:7px 6px;border-bottom:1px solid #e4e4e7;text-align:${c.num ? 'center' : 'right'};${c.num ? 'direction:ltr;unicode-bidi:plaintext;' : ''}`, String(r[c.key] ?? '')))); tb.append(tr) })
    table.append(tb); page.append(table)
    page.append(el('div', 'flex:1'))
    page.append(el('div', 'text-align:center;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:8px;direction:ltr', `${p + 1} / ${pages.length}`))
    document.body.append(page)
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#fff' })
    page.remove()
    if (p > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297)
  }
  pdf.save(filename)
}
