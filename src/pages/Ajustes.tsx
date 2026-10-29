import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, setMeta, TABLAS_SYNC } from '../lib/db'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { MODO_NUBE, CFG_DE_COMPILACION, guardarCfgNube, borrarCfgNube } from '../lib/supabase'
import { marcarTodoParaSubir } from '../lib/sync'
import { bus } from '../lib/repo'
import { hoy } from '../lib/util'
import { BottomNav, BotonSync, CampoTexto, Seccion, TopBar, toast, useEstadoSync, usePendientes, Logo } from '../components/ui'
import { Icono } from '../components/Icono'

function MetaSwitch({ k, def, texto }: { k: string; def: boolean; texto: string }) {
  const v = useLiveQuery(() => getMeta(k, def), [k], def)
  return <label className="switch">{texto}<input type="checkbox" checked={v} onChange={e => setMeta(k, e.target.checked)} /></label>
}

export function AjustesPage() {
  const { usuario, esAdmin, salir } = useAuth()
  const e = useEstadoSync()
  const pend = usePendientes()
  const operador = useLiveQuery(() => getMeta('operador', ''), [], '')
  const umbral = useLiveQuery(() => getMeta('umbral_recurrente', 3), [], 3)
  const [esp, setEsp] = useState<{ usado: number; cuota: number; persistente: boolean } | null>(null)
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const archivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const est = await navigator.storage?.estimate?.()
      const persistente = (await navigator.storage?.persisted?.()) ?? false
      setEsp({ usado: est?.usage ?? 0, cuota: est?.quota ?? 0, persistente })
    })()
  }, [])

  async function exportarRespaldo() {
    const datos: Record<string, unknown[]> = {}
    for (const t of TABLAS_SYNC) datos[t] = (await db.table(t).toArray()).map(({ _dirty, _ts, ...r }) => r)
    const blob = new Blob([JSON.stringify({ app: 'vakapo', version: 1, fecha: new Date().toISOString(), datos })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vakapo-respaldo-${hoy()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  async function importarRespaldo(f: File) {
    try {
      const j = JSON.parse(await f.text())
      if (j.app !== 'vakapo') throw new Error('Archivo no válido')
      if (!confirm('Se agregarán/actualizarán los datos del respaldo en este equipo. ¿Continuar?')) return
      const ts = Date.now()
      for (const t of TABLAS_SYNC) {
        const filas = (j.datos?.[t] ?? []) as Record<string, unknown>[]
        if (filas.length) await db.table(t).bulkPut(filas.map(r => ({ ...r, _dirty: 1, _ts: ts })))
      }
      bus.dispatchEvent(new Event('cambio'))
      toast('Respaldo importado')
    } catch (err) { toast('No se pudo importar: ' + (err instanceof Error ? err.message : '')) }
  }
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB'

  return (
    <div className="app">
      <TopBar titulo="Ajustes" />
      <main className="page">
        <Seccion titulo="Cuenta">
          <div className="stack">
            <div className="hstack" style={{ flexWrap: 'nowrap' }}>
              <Icono n="usuario" size={32} />
              <div className="grow"><b>{usuario?.nombre}</b><div className="muted small">{usuario?.email ?? (MODO_NUBE ? '' : 'Modo local: datos solo en este equipo')}</div></div>
              <span className={'tag ' + (esAdmin ? 'n0' : '')}>{esAdmin ? 'Administrador' : 'Propietario'}</span>
            </div>
            {MODO_NUBE && <button className="btn block" onClick={() => void salir()}>Cerrar sesión</button>}
          </div>
        </Seccion>

        {MODO_NUBE && (
          <Seccion titulo="Sincronización">
            <div className="stack">
              <div className={'aviso ' + (e.error ? 'warn' : pend ? 'info' : 'ok')}>
                <Icono n={e.online ? 'nube' : 'nubeOff'} />
                <span>
                  {!e.online ? 'Sin señal. Todo se guarda en el equipo y se sube solo cuando vuelva la conexión.' : e.error ? e.error : pend ? `${pend} registros esperando para subir.` : 'Todo está en la nube.'}
                  {e.ultimo && <><br /><small>Última sincronización: {new Date(e.ultimo).toLocaleString('es-PY')}</small></>}
                </span>
              </div>
              <BotonSync />
              {esAdmin && <MetaSwitch k="foto_solo_wifi" def={true} texto="Subir fotos solo con WiFi" />}
            </div>
          </Seccion>
        )}

        {esAdmin && (
          <Seccion titulo="Trabajo">
            <div className="stack">
              <CampoTexto etiqueta="Nombre del operador (aparece en jornadas)" valor={operador} onGuardar={v => setMeta('operador', v)} />
              <CampoTexto etiqueta="Vaca recurrente: misma lesión cuántas veces en 12 meses" tipo="number" valor={String(umbral)}
                onGuardar={v => setMeta('umbral_recurrente', Math.max(2, Number(v) || 3))} />
            </div>
          </Seccion>
        )}

        {esAdmin && (
          <section className="card flat lista">
            {[
              { p: '/ajustes/lesiones', n: 'pezuna', t: 'Catálogo de lesiones (ICAR)', s: 'Abreviaturas, nombres, gravedades y zonas' },
              { p: '/ajustes/items', n: 'dinero', t: 'Productos y servicios', s: 'Precios generales en guaraníes' },
              { p: '/ajustes/categorias', n: 'lista', t: 'Categorías de vacas', s: 'Vaquillona, en ordeñe, seca…' },
              ...(MODO_NUBE ? [{ p: '/ajustes/usuarios', n: 'usuarios', t: 'Usuarios y permisos', s: 'Administradores y propietarios' }] : [])
            ].map(m => (
              <button key={m.p} className="row" onClick={() => ir(m.p)}>
                <Icono n={m.n} size={28} /><div className="main"><b>{m.t}</b><small>{m.s}</small></div><Icono n="sig" />
              </button>
            ))}
          </section>
        )}

        <Seccion titulo="Datos en este equipo">
          <div className="stack">
            {esp && <p className="small muted" style={{ margin: 0 }}>Espacio usado: {mb(esp.usado)}{esp.cuota ? ` de ${mb(esp.cuota)} disponibles` : ''} · Almacenamiento {esp.persistente ? 'protegido ✓' : 'no protegido (el navegador podría borrarlo si falta espacio)'}</p>}
            {esp && !esp.persistente && <button className="btn block" onClick={async () => {
              const ok = await navigator.storage?.persist?.()
              toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo permitió. Instalá la app en la pantalla de inicio.')
              setEsp({ ...esp, persistente: !!ok })
            }}>Proteger datos del equipo</button>}
            {esAdmin && <button className="btn block" onClick={exportarRespaldo}><Icono n="descargar" /> Descargar respaldo (JSON)</button>}
            {esAdmin && <button className="btn block" onClick={() => archivo.current?.click()}>Importar respaldo</button>}
            <input ref={archivo} type="file" accept="application/json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importarRespaldo(f) }} />
          </div>
        </Seccion>

        {!CFG_DE_COMPILACION && esAdmin && (
          <Seccion titulo={MODO_NUBE ? 'Nube conectada' : 'Conectar a la nube'}>
            {MODO_NUBE ? (
              <button className="btn danger block" onClick={() => { if (confirm('¿Desconectar este equipo de la nube?')) { borrarCfgNube(); location.reload() } }}>Desconectar</button>
            ) : (
              <div className="stack">
                <p className="small muted" style={{ margin: 0 }}>Ahora la app funciona solo en este equipo. Para usar varios equipos y usuarios, pegá los datos de Supabase (ver guía).</p>
                <label className="campo">Project URL<input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></label>
                <label className="campo">Anon / publishable key<input className="input" value={key} onChange={e => setKey(e.target.value)} /></label>
                <button className="btn pri block" disabled={!url.startsWith('https://') || key.length < 20} onClick={async () => {
                  await marcarTodoParaSubir()
                  guardarCfgNube(url, key)
                  location.reload()
                }}>Conectar</button>
              </div>
            )}
          </Seccion>
        )}

        <div className="hstack center" style={{ justifyContent: 'center', opacity: .8 }}><Logo size={28} /><span className="small muted">VAKAPO v1.0 · podología bovina</span></div>
      </main>
      <BottomNav />
    </div>
  )
}
