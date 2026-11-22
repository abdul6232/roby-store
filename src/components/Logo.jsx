export default function Logo({ size = 34 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <svg width={size} height={size * 1.1} viewBox="0 0 48 54" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 46V20C7 9 14 4 24 4s17 5 17 16v26" stroke="#1aa3e8" />
        <path d="M17 46V24h9a5 5 0 0 1 0 10h-9M26 34l6 12" stroke="#e8c41c" />
        <circle cx="24" cy="50" r="1.5" stroke="#1aa3e8" />
      </svg>
      <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--yellow)', lineHeight: 1 }}>
        روبي<div style={{ fontSize: '.7rem', color: 'var(--blue)', letterSpacing: 2, direction: 'ltr' }}>ROBY</div>
      </div>
    </div>)
}
