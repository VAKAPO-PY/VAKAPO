import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Configuración de la nube:
 * 1) Variables de compilación (GitHub Actions → secrets VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), o
 * 2) Cargada a mano desde Ajustes → "Conectar a la nube" (se guarda en el dispositivo).
 * Si no hay ninguna, la app funciona en MODO LOCAL (un solo equipo, sin login).
 */
const CFG_KEY = 'vk_nube'

function leerCfg(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return { url, key }
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (raw) {
      const c = JSON.parse(raw)
      if (c.url && c.key) return c
    }
  } catch { /* sin config */ }
  return null
}

const cfg = leerCfg()
export const MODO_NUBE = !!cfg
export const CFG_DE_COMPILACION = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase: SupabaseClient | null = cfg
  ? createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vakapo-auth', detectSessionInUrl: false }
    })
  : null

export function guardarCfgNube(url: string, key: string) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }))
}
export function borrarCfgNube() {
  localStorage.removeItem(CFG_KEY)
}
