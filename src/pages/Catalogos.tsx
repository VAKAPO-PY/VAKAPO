import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Categoria, type Grado, type Item, type ItemTipo, type Lesion, type Perfil, type ZonaId, type Miembro } from '../lib/db'
import { actualizar, borrar, guardar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { LESIONES_ICAR } from '../lib/seed'
import { ZONAS, NIVEL_NOMBRE, COLOR_NIVEL } from '../lib/anatomia'
import { gs, idDe, uid } from '../lib/util'
import { BottomNav, CampoTexto, Hoja, TopBar, Vacio, toast } from '../components/ui'
import { Chips } from '../components/Selectores'
import { Icono } from '../components/Icono'

/* ───────── Lesiones ───────── */
export function LesionesPage() {
  const [editar, setEditar] = useState<Lesion | 'nueva' | null>(null)
  const ls = useLiveQuery(async () => vivos(await db.lesiones.toArray()).sort((a, b) => a.orden - b.orden), [], [])
  return (
    <div className="app">
      <TopBar titulo="Catálogo de lesiones" sub="Basado en ICAR · editable" atras="/ajustes" />
      <main className="page">
        <button className="btn pri block" onClick={() => setEditar('nueva')}><Icono n="mas" /> Nueva lesión</button>
        <section className="card flat lista">
          {ls.map(l => (
            <button key={l.id} className="row" onClick={() => setEditar(l)} style={{ opacity: l.activa === false ? 0.5 : 1 }}>
              <b style={{ minWidth: 56, fontSize: '1.15rem' }}>{l.codigo}</b>
              <div className="main"><b>{l.nombre}</b><small>{l.grados.length} {l.grados.length === 1 ? 'grado' : 'grados'} · zonas {l.zonas.join(', ')}{l.activa === false ? ' · desactivada' : ''}</small></div>
              <Icono n="editar" />
            </button>
          ))}
        </section>
      </main>
      {editar && <EditarLesion l={editar === 'nueva' ? null : editar} orden={ls.length + 1} onCerrar={() => setEditar(null)} />}
      <BottomNav />
    </div>
  )
}

function EditarLesion({ l, orden, onCerrar }: { l: Lesion | null; orden: number; onCerrar: () => void }) {
  const [x, setX] = useState<Lesion>(l ?? { id: uid(), codigo: '', nombre: '', zonas: [], grados: [{ cod: '1', nombre: 'Leve', nivel: 1 }], orden, activa: true })
  const original = LESIONES_ICAR.find(o => o.id === x.id)
  const setG = (i: number, g: Partial<Grado>) => setX({ ...x, grados: x.grados.map((y, j) => (j === i ? { ...y, ...g } : y)) })
  const toggleZona = (z: ZonaId) => setX({ ...x, zonas: x.zonas.includes(z) ? x.zonas.filter(y => y !== z) : [...x.zonas, z] })
  const valido = x.codigo.trim() && x.nombre.trim() && x.grados.length > 0 && x.grados.every(g => g.cod.trim() && g.nombre.trim()) && x.zonas.length > 0
  return (
    <Hoja titulo={l ? `Editar ${l.codigo}` : 'Nueva lesión'} onCerrar={onCerrar}>
      <div className="fila-btns" style={{ gridTemplateColumns: '110px 1fr' }}>
        <label className="campo">Abreviatura<input className="input" value={x.codigo} maxLength={6} onChange={e => setX({ ...x, codigo: e.target.value.toUpperCase() })} /></label>
        <label className="campo">Nombre<input className="input" value={x.nombre} onChange={e => setX({ ...x, nombre: e.target.value })} /></label>
      </div>
      <div className="stack"><b>Zonas donde aparece</b>
        <div className="chips">{ZONAS.map(z => <button key={z.id} className={'chip' + (x.zonas.includes(z.id) ? ' on' : '')} onClick={() => toggleZona(z.id)} title={z.nombre}>{z.id}</button>)}</div>
        <small className="muted">{ZONAS.map(z => `${z.id}: ${z.nombre}`).join(' · ')}</small>
      </div>
      <div className="stack"><b>Grados de gravedad</b>
        {x.grados.map((g, i) => (
          <div key={i} className="card stack" style={{ padding: 10, gap: 8 }}>
            <div className="fila-btns" style={{ gridTemplateColumns: '90px 1fr 50px' }}>
              <input className="input" value={g.cod} placeholder="Cód." onChange={e => setG(i, { cod: e.target.value })} />
              <input className="input" value={g.nombre} placeholder="Descripción" onChange={e => setG(i, { nombre: e.target.value })} />
              <button className="btn sm danger" aria-label="Quitar grado" onClick={() => setX({ ...x, grados: x.grados.filter((_, j) => j !== i) })}><Icono n="basura" /></button>
            </div>
            <div className="chips">
              {NIVEL_NOMBRE.map((n, k) => (
                <button key={k} className={'chip' + (g.nivel === k ? ' on' : '')} onClick={() => setG(i, { nivel: k })}>
                  <span className="dot" style={{ background: COLOR_NIVEL[k] }} /> {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setX({ ...x, grados: [...x.grados, { cod: String(x.grados.length + 1), nombre: '', nivel: 1 }] })}><Icono n="mas" /> Agregar grado</button>
      </div>
      <label className="switch">Lesión activa (aparece al registrar)<input type="checkbox" checked={x.activa !== false} onChange={e => setX({ ...x, activa: e.target.checked })} /></label>
      <button className="btn pri lg block" disabled={!valido} onClick={async () => { await guardar('lesiones', { ...x, codigo: x.codigo.trim(), nombre: x.nombre.trim() }); toast('Guardado'); onCerrar() }}>Guardar</button>
      {original && <button className="btn block" onClick={() => setX({ ...original, id: x.id })}>Volver a los valores ICAR</button>}
      {l && !original && <button className="btn danger block" onClick={async () => { if (confirm('¿Borrar esta lesión? Los registros viejos se conservan.')) { await borrar('lesiones', l.id); onCerrar() } }}>Borrar</button>}
      <p className="small muted" style={{ margin: 0 }}>Los registros ya hechos guardan la abreviatura y el grado que tenían en ese momento.</p>
    </Hoja>
  )
}

/* ───────── Productos y servicios ───────── */
const TIPOS: { v: ItemTipo; t: string }[] = [{ v: 'servicio', t: 'Servicio' }, { v: 'producto', t: 'Producto' }, { v: 'cargo_fijo', t: 'Cargo de jornada' }]

export function ItemsPage() {
  const [editar, setEditar] = useState<Item | 'nuevo' | null>(null)
  const items = useLiveQuery(async () => vivos(await db.items.toArray()).sort((a, b) => a.orden - b.orden), [], [])
  return (
    <div className="app">
      <TopBar titulo="Productos y servicios" sub="Precios generales" atras="/ajustes" />
      <main className="page">
        <p className="muted small" style={{ margin: 0 }}>Cada tambo puede tener precios distintos: Tambo → Configuración → Precios.</p>
        <button className="btn pri block" onClick={() => setEditar('nuevo')}><Icono n="mas" /> Nuevo</button>
        {TIPOS.map(t => (
          <section key={t.v} className="card flat lista">
            <h3 style={{ padding: '12px 14px 4px' }}>{t.t}s</h3>
            {items.filter(i => i.tipo === t.v).map(i => (
              <button key={i.id} className="row" onClick={() => setEditar(i)} style={{ opacity: i.activo === false ? 0.5 : 1 }}>
                <div className="main"><b>{i.nombre}</b><small>{i.unidad ? `por ${i.unidad}` : ''}{i.activo === false ? ' · desactivado' : ''}</small></div>
                <span className="der">{gs(i.precio)}</span>
              </button>
            ))}
            {!items.some(i => i.tipo === t.v) && <Vacio>Sin ítems.</Vacio>}
          </section>
        ))}
      </main>
      {editar && <EditarItem i={editar === 'nuevo' ? null : editar} orden={items.length + 1} onCerrar={() => setEditar(null)} />}
      <BottomNav />
    </div>
  )
}

function EditarItem({ i, orden, onCerrar }: { i: Item | null; orden: number; onCerrar: () => void }) {
  const [x, setX] = useState<Item>(i ?? { id: uid(), tipo: 'producto', nombre: '', unidad: '', precio: 0, activo: true, orden: orden + 50 })
  return (
    <Hoja titulo={i ? 'Editar' : 'Nuevo ítem'} onCerrar={onCerrar}>
      <Chips opciones={TIPOS} valor={x.tipo} onCambio={v => setX({ ...x, tipo: v })} />
      <label className="campo">Nombre<input className="input" value={x.nombre} onChange={e => setX({ ...x, nombre: e.target.value })} /></label>
      <div className="fila-btns">
        <label className="campo">Precio general (Gs.)<input className="input" type="number" inputMode="numeric" value={x.precio || ''} onChange={e => setX({ ...x, precio: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
        <label className="campo">Unidad<input className="input" value={x.unidad ?? ''} placeholder="u, dosis, ml…" onChange={e => setX({ ...x, unidad: e.target.value })} /></label>
      </div>
      <label className="switch">Activo<input type="checkbox" checked={x.activo !== false} onChange={e => setX({ ...x, activo: e.target.checked })} /></label>
      <button className="btn pri lg block" disabled={!x.nombre.trim()} onClick={async () => { await guardar('items', { ...x, nombre: x.nombre.trim() }); toast('Guardado'); onCerrar() }}>Guardar</button>
      {i && <button className="btn danger block" onClick={async () => { if (confirm('¿Borrar? Lo ya cobrado no cambia.')) { await borrar('items', i.id); onCerrar() } }}>Borrar</button>}
    </Hoja>
  )
}

/* ───────── Categorías ───────── */
export function CategoriasPage() {
  const [nueva, setNueva] = useState('')
  const cats = useLiveQuery(async () => vivos(await db.categorias.toArray()).sort((a, b) => a.orden - b.orden), [], [])
  return (
    <div className="app">
      <TopBar titulo="Categorías de vacas" atras="/ajustes" />
      <main className="page">
        <section className="card stack">
          {cats.map(c => (
            <div key={c.id} className="hstack" style={{ flexWrap: 'nowrap' }}>
              <div className="grow"><CampoTexto valor={c.nombre} onGuardar={v => v.trim() && actualizar('categorias', c.id, { nombre: v.trim() })} /></div>
              <button className="btn sm danger" aria-label="Borrar" onClick={() => confirm(`¿Borrar ${c.nombre}?`) && borrar('categorias', c.id)}><Icono n="basura" /></button>
            </div>
          ))}
          <div className="hstack" style={{ flexWrap: 'nowrap' }}>
            <input className="input grow" placeholder="Nueva categoría" value={nueva} onChange={e => setNueva(e.target.value)} />
            <button className="btn pri" disabled={!nueva.trim()} onClick={async () => { await guardar<Categoria>('categorias', { id: uid(), nombre: nueva.trim(), orden: cats.length + 1 }); setNueva('') }}><Icono n="mas" /></button>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  )
}

/* ───────── Usuarios ───────── */
export function UsuariosPage() {
  const { usuario } = useAuth()
  const d = useLiveQuery(async () => ({
    perfiles: vivos(await db.perfiles.toArray()).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')),
    tambos: vivos(await db.tambos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    miembros: vivos(await db.miembros.toArray())
  }), [])
  if (!d) return null
  return (
    <div className="app">
      <TopBar titulo="Usuarios y permisos" atras="/ajustes" />
      <main className="page">
        <div className="aviso info"><Icono n="usuario" /><span>Cada persona crea su cuenta desde la app. Acá le das el rol y los tambos que puede ver. Los administradores (podólogos/veterinarios) ven y registran en todos los tambos.</span></div>
        {d.perfiles.length === 0 && <Vacio>Sincronizá para ver los usuarios registrados.</Vacio>}
        {d.perfiles.map((p: Perfil) => {
          const yo = p.id === usuario?.id
          return (
            <section key={p.id} className="card stack">
              <div className="hstack" style={{ flexWrap: 'nowrap' }}>
                <Icono n="usuario" size={30} />
                <div className="grow"><b>{p.nombre || 'Sin nombre'}{yo ? ' (vos)' : ''}</b><div className="small muted">{p.email}</div></div>
              </div>
              <Chips opciones={[{ v: 'admin' as const, t: 'Administrador' }, { v: 'propietario' as const, t: 'Propietario / encargado' }]} valor={p.rol}
                onCambio={async r => {
                  if (yo) { toast('No podés cambiar tu propio rol'); return }
                  if (confirm(`¿Cambiar a ${r === 'admin' ? 'administrador' : 'propietario'}?`)) await actualizar('perfiles', p.id, { rol: r })
                }} />
              {p.rol !== 'admin' && (
                <div className="stack" style={{ gap: 6 }}>
                  <small className="muted">Tambos que puede ver:</small>
                  <div className="chips">
                    {d.tambos.map(t => {
                      const m = d.miembros.find(x => x.tambo_id === t.id && x.user_id === p.id)
                      return (
                        <button key={t.id} className={'chip' + (m ? ' on' : '')} onClick={async () => {
                          if (m) await borrar('miembros', m.id)
                          else await guardar<Miembro>('miembros', { id: idDe('m', t.id, p.id), tambo_id: t.id, user_id: p.id })
                        }}>{m && <Icono n="check" size={18} />}{t.nombre}</button>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </main>
      <BottomNav />
    </div>
  )
}
