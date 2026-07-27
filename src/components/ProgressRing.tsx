import type { CSSProperties } from 'react'

export default function ProgressRing({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return <div className="progress-ring" style={{ '--value': `${safe * 3.6}deg` } as CSSProperties}><div><strong>{Math.round(safe)}%</strong>{label && <span>{label}</span>}</div></div>
}
