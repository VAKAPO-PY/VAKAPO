import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Lote, type Miembro, type Tarifa } from '../lib/db'
import { actualizar, borrar, guardar } from '../lib/repo'
import { ir } from '../lib/router'
import { MODO_NUBE } from '../lib/supabase'
import { gs, idDe, uid } from '../lib/util'
import { BottomNav, CampoTexto, Hoja, Seccion, TopBar, toast } from '../components/ui'
import { Icono } from '../components/Icono'

export function TamboConfigPage({ tid }: { tid: string }) {
  const [agregarUsuario, setAgregarUsuario] = useState(false)
  const [nuevoLote, setNuevoLote] = useState('')
  const d = useLiveQuery(async () => {
    const t = await db.tambos.get(tid)
    const lotes = vivos(await db.lotes.where('tambo_id').equals(tid).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const items = vivos(await db.items.toArray()).filter(i => i.activo !== false).sort((a, b) => a.orden - b.orden)
    const tarifas = new Map(vivos(await db.tarifas.where('tambo_id').equals(tid).toArray()).map(x => [x.item_id, x]))
    const miembros = vivos(await db.miembros.where('tambo_id').equals(tid).toArray())
    const perfiles = vivos(await db.perfiles.toArray())
    return { t, lotes, items, tarifas, miembros, perfiles }
  }, [tid])
  if (!d?.t) return null
  const t = d.t

  return (
    <div className="app">
      <TopBar titulo="Configuración" sub={t.nombre} atras={`/t/${tid}`} />
      <main className="page">
        <Seccion titulo="Datos del tambo">
          <div className="stack">
            <CampoTexto etiqueta="Nombre" valor={t.nombre} onGuardar={v => v.trim() && actualizar('tambos', tid, { nombre: v.trim() })} />
            <CampoTexto etiqueta="Ubicación" valor={t.ubicacion ?? ''} onGuardar={v => actualizar('tambos', tid, { ubicacion: v })} />
            <CampoTexto etiqueta="Notas" multilinea valor={t.notas ?? ''} onGuardar={v => actualizar('tambos', tid, { notas: v })} />
          </div>
        </Seccion>

        <Seccion titulo="Lotes de ordeñe">
          <div className="stack">
            {d.lotes.map(l => (
              <div key={l.id} className="hstack" style={{ flexWrap: 'nowrap' }}>
                <div className="grow"><CampoTexto valor={l.nombre} onGuardar={v => v.trim() && actualizar('lotes', l.id, { nombre: v.trim() })} /></div>
                <button className="btn sm danger" aria-label="Borrar lote" onClick={() => confirm(`¿Borrar el lote ${l.nombre}? Las vacas quedan sin lote.`) && borrar('lotes', l.id)}><Icono n="basura" /></button>
              </div>
            ))}
            <div className="hstack" style={{ flexWrap: 'nowrap' }}>
              <input className="input grow" placeholder="Nuevo lote (ej. Lote 1, Alta producción)" value={nuevoLote} onChange={e => setNuevoLote(e.target.value)} />
              <button className="btn pri" disabled={!nuevoLote.trim()} onClick={async () => {
                await guardar<Lote>('lotes', { id: uid(), tambo_id: tid, nombre: nuevoLote.trim() })
                setNuevoLote('')
              }}><Icono n="mas" /></button>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Precios de este tambo">
          <p className="muted small" style={{ marginTop: 0 }}>Vacío = usa el precio general. Los cambios valen para lo que se registre desde ahora; lo ya registrado conserva su precio.</p>
          <div className="lista">
            {d.items.map(i => {
              const tar = d.tarifas.get(i.id)
              return (
                <div key={i.id} className="row" style={{ padding: '8px 0' }}>
                  <div className="main"><b>{i.nombre}</b><small>General: {gs(i.precio)}{i.unidad ? ` / ${i.unidad}` : ''}</small></div>
                  <div style={{ width: 140 }}>
                    <CampoTexto tipo="number" placeholder="Gs." valor={tar ? String(tar.precio) : ''} onGuardar={async v => {
                      const id = idDe('tar', tid, i.id)
                      if (v.trim() === '') { if (tar) await borrar('tarifas', id) }
                      else await guardar<Tarifa>('tarifas', { id, tambo_id: tid, item_id: i.id, precio: Math.max(0, Math.round(Number(v) || 0)) })
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Seccion>

        {MODO_NUBE && (
          <Seccion titulo="Usuarios con acceso" accion={<button className="btn sm" onClick={() => setAgregarUsuario(true)}><Icono n="mas" /> Dar acceso</button>}>
            <p className="muted small" style={{ marginTop: 0 }}>Propietarios y encargados ven solo este tambo y pueden dejar notas. No pueden modificar registros.</p>
            {d.miembros.length === 0 && <p className="muted">Nadie más tiene acceso.</p>}
            <div className="lista">
              {d.miembros.map(m => {
                const p = d.perfiles.find(x => x.id === m.user_id)
                return (
                  <div key={m.id} className="row" style={{ padding: '8px 0' }}>
                    <Icono n="usuario" />
                    <div className="main"><b>{p?.nombre ?? 'Usuario'}</b><small>{p?.email ?? m.user_id}</small></div>
                    <button className="btn sm danger" onClick={() => confirm('¿Quitar acceso?') && borrar('miembros', m.id)}>Quitar</button>
                  </div>
                )
              })}
            </div>
          </Seccion>
        )}

        <button className="btn danger block" onClick={async () => {
          if (!confirm(`¿Borrar el tambo "${t.nombre}"? Desaparece para todos los usuarios.`)) return
          if (prompt('Escribí BORRAR para confirmar') !== 'BORRAR') return
          await borrar('tambos', tid)
          toast('Tambo borrado')
          ir('/')
        }}><Icono n="basura" /> Borrar tambo</button>
      </main>
      {agregarUsuario && (
        <Hoja titulo="Dar acceso a este tambo" onCerrar={() => setAgregarUsuario(false)}>
          <p className="muted small" style={{ margin: 0 }}>La persona primero crea su cuenta en la app. Después aparece acá.</p>
          <div className="card flat lista">
            {d.perfiles.filter(p => p.rol !== 'admin' && !d.miembros.some(m => m.user_id === p.id)).map(p => (
              <button key={p.id} className="row" onClick={async () => {
                await guardar<Miembro>('miembros', { id: idDe('m', tid, p.id), tambo_id: tid, user_id: p.id })
                toast(`${p.nombre ?? p.email} tiene acceso`)
                setAgregarUsuario(false)
              }}>
                <Icono n="usuario" />
                <div className="main"><b>{p.nombre ?? 'Sin nombre'}</b><small>{p.email}</small></div>
                <Icono n="mas" />
              </button>
            ))}
          </div>
          {d.perfiles.filter(p => p.rol !== 'admin' && !d.miembros.some(m => m.user_id === p.id)).length === 0 && <p className="muted">No hay usuarios disponibles. Sincronizá si alguien acaba de registrarse.</p>}
        </Hoja>
      )}
      <BottomNav />
    </div>
  )
}
