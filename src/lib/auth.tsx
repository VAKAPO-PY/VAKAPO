import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, TABLAS_SYNC, type Perfil, type Rol } from './db'
import { supabase, MODO_NUBE } from './supabase'
import { fijarRolSync, iniciarSync, sincronizar, contarPendientes } from './sync'
import { sembrarCatalogos } from './seed'

export interface Usuario { id: string; nombre: string; email?: string; rol: Rol }

interface Ctx {
  usuario: Usuario | null
  cargando: boolean
  esAdmin: boolean
  entrar(email: string, clave: string): Promise<void>
  registrar(nombre: string, email: string, clave: string): Promise<string>
  salir(): Promise<void>
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

const LOCAL: Usuario = { id: 'local', nombre: 'Este equipo', rol: 'admin' }
const PERFIL_KEY = 'vk_perfil'

async function borrarDatosLocales() {
  for (const t of TABLAS_SYNC) await db.table(t).clear()
  await db.blobs.clear()
  const metas = await db.meta.toArray()
  for (const m of metas) if (m.key.startsWith('cursor_') || m.key === 'ultimo_sync') await db.meta.delete(m.key)
}

async function cargarPerfil(id: string, email?: string): Promise<Usuario | null> {
  // 1) Del servidor, si hay señal
  if (supabase && navigator.onLine) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', id).maybeSingle()
    if (data) {
      const p = data as Perfil
      await db.perfiles.put({ ...p, _dirty: 0, _ts: 0 })
      const u = { id, nombre: p.nombre || email || 'Usuario', email: p.email || email, rol: p.rol }
      localStorage.setItem(PERFIL_KEY, JSON.stringify(u))
      return u
    }
  }
  // 2) Copia guardada (sin señal)
  try {
    const raw = localStorage.getItem(PERFIL_KEY)
    if (raw) {
      const u = JSON.parse(raw) as Usuario
      if (u.id === id) return u
    }
  } catch { /* nada */ }
  const p = await db.perfiles.get(id)
  if (p) return { id, nombre: p.nombre || 'Usuario', email: p.email, rol: p.rol }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(MODO_NUBE ? null : LOCAL)
  const [cargando, setCargando] = useState(MODO_NUBE)

  async function activar(id: string, email?: string) {
    const previo = localStorage.getItem('vk_ultimo_usuario')
    if (previo && previo !== id) await borrarDatosLocales() // otro usuario en este equipo
    localStorage.setItem('vk_ultimo_usuario', id)
    const u = await cargarPerfil(id, email)
    const final = u ?? { id, nombre: email || 'Usuario', email, rol: 'propietario' as Rol }
    setUsuario(final)
    fijarRolSync(final.rol)
    iniciarSync()
    void sincronizar().then(async () => {
      // Primer administrador: cargar el catálogo ICAR si la nube está vacía
      if (final.rol === 'admin' && (await db.lesiones.count()) === 0) {
        await sembrarCatalogos(true)
        void sincronizar()
      }
    })
  }

  useEffect(() => {
    if (!MODO_NUBE || !supabase) {
      fijarRolSync('admin')
      void sembrarCatalogos(false)
      return
    }
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      if (data.session) await activar(data.session.user.id, data.session.user.email)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((ev, ses) => {
      if (ev === 'SIGNED_OUT') { setUsuario(null); fijarRolSync(null) }
      if (ev === 'TOKEN_REFRESHED' && ses) void sincronizar()
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ctx: Ctx = {
    usuario,
    cargando,
    esAdmin: usuario?.rol === 'admin',
    async entrar(email, clave) {
      if (!supabase) return
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
      await activar(data.user.id, data.user.email)
    },
    async registrar(nombre, email, clave) {
      if (!supabase) return ''
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: clave, options: { data: { nombre } } })
      if (error) throw new Error(error.message)
      if (data.session && data.user) { await activar(data.user.id, data.user.email); return '' }
      return 'Cuenta creada. Revisá tu correo para confirmarla y luego ingresá.'
    },
    async salir() {
      const n = await contarPendientes()
      if (n > 0 && !confirm(`Hay ${n} registros sin subir a la nube. Si salís ahora se pierden. ¿Salir igual?`)) return
      await supabase?.auth.signOut()
      await borrarDatosLocales()
      localStorage.removeItem(PERFIL_KEY)
      localStorage.removeItem('vk_ultimo_usuario')
      setUsuario(null)
      fijarRolSync(null)
    }
  }
  return <AuthCtx.Provider value={ctx}>{children}</AuthCtx.Provider>
}
