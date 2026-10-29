import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icono } from './Icono'
import { ir, rutaActual } from '../lib/router'
import { estadoSync, sincronizar, contarPendientes } from '../lib/sync'
import { MODO_NUBE } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { calcularAlertas } from '../lib/alertas'
import { db } from '../lib/db'

/* ───────── Toast ───────── */
let mostrarToast: (m: string) => void = () => {}
export const toast = (m: string) => mostrarToast(m)
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    mostrarToast = m => {
      setMsg(m)
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => setMsg(null), 2200)
    }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

/* ───────── Logo ───────── */
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#166534" />
      <path d="M246 132C204 112 132 126 120 196c-12 84 22 168 92 218 16 11 34 2 34-18z" fill="#f3f4ef" />
      <path d="M266 132c42-20 114-6 126 64 12 84-22 168-92 218-16 11-34 2-34-18z" fill="#f3f4ef" />
      <path d="M246 132C204 112 132 126 120 196c40 20 92 20 126 6z" fill="#bbf7d0" />
      <path d="M266 132c42-20 114-6 126 64-40 20-92 20-126 6z" fill="#bbf7d0" />
    </svg>
  )
}

/* ───────── Estado de sincronización ───────── */
export function useEstadoSync() {
  return useSyncExternalStore(estadoSync.sub, estadoSync.get)
}
export function usePendientes() {
  return useLiveQuery(() => contarPendientes(), [], 0)
}

export function SyncChip() {
  const e = useEstadoSync()
  const pend = usePendientes()
  if (!MODO_NUBE) return null
  const texto = e.sincronizando ? 'Subiendo…' : !e.online ? (pend ? `${pend} sin subir` : 'Sin señal') : e.error ? 'Error' : pend ? `${pend} pend.` : 'Al día'
  const icono = !e.online ? 'nubeOff' : e.sincronizando ? 'refrescar' : 'nube'
  return (
    <button className={'sync-chip' + (e.error && e.online ? ' err' : '')} onClick={() => ir('/ajustes')} aria-label="Estado de sincronización">
      <Icono n={icono} size={18} /> {texto}
    </button>
  )
}

/* ───────── Barra superior ───────── */
export function TopBar({ titulo, sub, atras, derecha }: { titulo: string; sub?: string; atras?: string; derecha?: ReactNode }) {
  return (
    <header className="topbar">
      {atras !== undefined && (
        <button className="icon-btn" onClick={() => ir(atras)} aria-label="Volver"><Icono n="atras" size={26} /></button>
      )}
      <div className="titulo">
        <h1>{titulo}</h1>
        {sub && <small>{sub}</small>}
      </div>
      {derecha}
      <SyncChip />
    </header>
  )
}

/* ───────── Navegación inferior ───────── */
export function BottomNav() {
  const { esAdmin } = useAuth()
  const r = rutaActual()
  const alertas = useLiveQuery(() => (esAdmin ? calcularAlertas() : Promise.resolve(null)), [esAdmin])
  const notas = useLiveQuery(async () => {
    if (!esAdmin) return 0
    const visto = (await db.meta.get('notas_visto'))?.value as number | undefined
    const ns = await db.notas_prop.toArray()
    return ns.filter(n => !n.deleted && Date.parse(n.fecha) > (visto ?? 0)).length
  }, [esAdmin], 0)
  const items = [
    { p: '/', n: 'granja', t: 'Tambos', on: r === '/' || r.startsWith('/t/') },
    ...(esAdmin ? [{ p: '/alertas', n: 'campana', t: 'Alertas', on: r.startsWith('/alertas'), b: (alertas?.urgentes ?? 0) + notas }] : []),
    { p: '/reportes', n: 'grafico', t: 'Reportes', on: r.startsWith('/reportes') },
    { p: '/ajustes', n: 'ajustes', t: 'Ajustes', on: r.startsWith('/ajustes') }
  ]
  return (
    <nav className="bottomnav">
      <div className="inner">
        {items.map(i => (
          <button key={i.p} className={i.on ? 'on' : ''} onClick={() => ir(i.p)}>
            <Icono n={i.n} size={26} />
            {i.t}
            {'b' in i && i.b ? <span className="badge">{i.b}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

/* ───────── Hoja inferior (modal) ───────── */
export function Hoja({ titulo, onCerrar, children }: { titulo: ReactNode; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onCerrar])
  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <div className="hoja" role="dialog" aria-modal="true">
        <div className="cab">
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" /></button>
        </div>
        <div className="cuerpo">{children}</div>
      </div>
    </>
  )
}

/**
 * Campo de texto con guardado automático: graba mientras se escribe (cada 0,5 s),
 * al salir del campo y si la app pasa a segundo plano o se cierra.
 */
export function CampoTexto({ valor, onGuardar, placeholder, multilinea, tipo = 'text', etiqueta, disabled }: {
  valor: string; onGuardar: (v: string) => unknown; placeholder?: string; multilinea?: boolean; tipo?: string; etiqueta?: string; disabled?: boolean
}) {
  const [v, setV] = useState(valor ?? '')
  const ult = useRef(valor ?? '')
  const pendiente = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const guardarRef = useRef(onGuardar)
  guardarRef.current = onGuardar

  useEffect(() => {
    if (pendiente.current === null && valor !== ult.current) { setV(valor ?? ''); ult.current = valor ?? '' }
  }, [valor])

  const volcar = () => {
    if (timer.current) clearTimeout(timer.current)
    if (pendiente.current !== null && pendiente.current !== ult.current) {
      ult.current = pendiente.current
      void guardarRef.current(pendiente.current)
    }
    pendiente.current = null
  }
  useEffect(() => {
    const oculto = () => { if (document.visibilityState === 'hidden') volcar() }
    window.addEventListener('pagehide', volcar)
    document.addEventListener('visibilitychange', oculto)
    return () => { volcar(); window.removeEventListener('pagehide', volcar); document.removeEventListener('visibilitychange', oculto) }
  }, [])
  const cambiar = (nv: string) => {
    setV(nv)
    pendiente.current = nv
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(volcar, 500)
  }
  const props = { className: 'input', value: v, placeholder, disabled, onBlur: volcar }
  const campo = multilinea
    ? <textarea {...props} onChange={e => cambiar(e.target.value)} />
    : <input {...props} type={tipo} onChange={e => cambiar(e.target.value)} />
  return etiqueta ? <label className="campo">{etiqueta}{campo}</label> : campo
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>
}

export function Seccion({ titulo, accion, children, flat }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; flat?: boolean }) {
  return (
    <section className={'card' + (flat ? ' flat' : '')}>
      {(titulo || accion) && (
        <div className="sec-head" style={flat ? { padding: '14px 14px 0', marginBottom: 6 } : undefined}>
          {titulo && <h2>{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

export function BotonSync() {
  const e = useEstadoSync()
  return (
    <button className="btn block" disabled={e.sincronizando || !e.online} onClick={() => void sincronizar()}>
      <Icono n="refrescar" /> {e.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
    </button>
  )
}
