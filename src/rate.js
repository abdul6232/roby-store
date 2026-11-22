import { useEffect, useState } from 'react'
import { supabase } from './supabase'
export function useRate() {
  const [rate, setRate] = useState(0)
  useEffect(() => { supabase.from('settings').select('usd_to_syp').eq('id', 1).single()
    .then(({ data }) => data && setRate(+data.usd_to_syp)) }, [])
  return rate
}
export const fmt = (n, d = 2) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })
export const toSyp = (usd, rate) => Math.round(usd * rate)
export const fmtDT = (t) => new Date(t).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
export const fmtD = (t) => new Date(t).toLocaleDateString('en-GB')
