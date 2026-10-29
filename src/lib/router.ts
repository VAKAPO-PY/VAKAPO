import { useEffect, useState } from 'react'

const RUTA_KEY = 'vk_ruta'

export function rutaActual(): string {
  const h = location.hash.replace(/^#/, '')
  return h || '/'
}

/** Al reabrir la app (o si el equipo se apagó), vuelve al mismo punto de trabajo si fue hace menos de 12 h. */
export function restaurarRuta() {
  if (rutaActual() !== '/') return
  try {
    const raw = localStorage.getItem(RUTA_KEY)
    if (!raw) return
    const { r, t } = JSON.parse(raw)
    if (r && r !== '/' && Date.now() - t < 12 * 3600_000) location.replace('#' + r)
  } catch { /* nada */ }
}

export function useRuta(): string {
  const [r, setR] = useState(rutaActual())
  useEffect(() => {
    const f = () => {
      const nueva = rutaActual()
      setR(nueva)
      localStorage.setItem(RUTA_KEY, JSON.stringify({ r: nueva, t: Date.now() }))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export function ir(path: string, reemplazar = false) {
  if (reemplazar) location.replace('#' + path)
  else location.hash = path
}

/** Compara "/t/:id/v/:vaca" con la ruta y devuelve los parámetros. */
export function coincide(patron: string, ruta: string): Record<string, string> | null {
  const [base] = ruta.split('?')
  const a = patron.split('/').filter(Boolean)
  const b = base.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const p: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) p[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return p
}
