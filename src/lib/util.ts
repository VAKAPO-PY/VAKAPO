export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Id estable a partir de partes (evita duplicados cuando dos equipos crean lo mismo sin conexión). */
export const idDe = (...partes: string[]) =>
  partes.map(p => p.toString().trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')).join('_')

const fmtGs = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 })
export const gs = (n: number) => 'Gs. ' + fmtGs.format(Math.round(n || 0))
export const num = (n: number) => fmtGs.format(n || 0)

/** Fecha local YYYY-MM-DD */
export function hoy(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return hoy(new Date(y, m - 1, d + dias))
}
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde.slice(0, 10) + 'T00:00:00')
  const b = new Date(hasta.slice(0, 10) + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function fechaCorta(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${y}`
}
export function mesNombre(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES[m - 1]} ${String(y).slice(2)}`
}
export function horaCorta(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const f = (...a: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  return f
}

export function agrupar<T, K extends string>(arr: T[], key: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const x of arr) (out[key(x)] ||= []).push(x)
  return out
}

/** Orden natural para números de vaca ("2" antes que "10"). */
export const ordenNumero = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true })

export const vibrar = (ms = 15) => { try { navigator.vibrate?.(ms) } catch { /* sin soporte */ } }
