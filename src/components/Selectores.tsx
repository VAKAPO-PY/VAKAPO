import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Cargo, type Item, type ItemTipo } from '../lib/db'
import { cambiarCantidad, precioDe } from '../lib/acciones'
import { gs, num } from '../lib/util'
import { Hoja } from './ui'
import { Icono } from './Icono'

const TITULO_TIPO: Record<ItemTipo, string> = { servicio: 'Servicios', producto: 'Productos y materiales', cargo_fijo: 'Cargos de la jornada' }

/** Lista de productos/servicios con su precio para este tambo. Un toque = agregar 1. */
export function ElegirItem({ tambo_id, tipos, onElegir, onCerrar, titulo = 'Agregar' }: {
  tambo_id: string; tipos: ItemTipo[]; onElegir: (i: Item) => void; onCerrar: () => void; titulo?: string
}) {
  const items = useLiveQuery(async () => {
    const xs = vivos(await db.items.toArray()).filter(i => i.activo !== false && tipos.includes(i.tipo)).sort((a, b) => a.orden - b.orden)
    return Promise.all(xs.map(async i => ({ i, precio: await precioDe(tambo_id, i) })))
  }, [tambo_id, tipos.join()])
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {tipos.map(t => {
        const xs = items?.filter(x => x.i.tipo === t) ?? []
        if (!xs.length) return null
        return (
          <div key={t} className="stack">
            <h3 className="muted">{TITULO_TIPO[t]}</h3>
            <div className="card flat lista">
              {xs.map(({ i, precio }) => (
                <button key={i.id} className="row" onClick={() => onElegir(i)}>
                  <div className="main"><b>{i.nombre}</b><small>{gs(precio)}{i.unidad ? ` / ${i.unidad}` : ''}</small></div>
                  <span className="icon-btn" style={{ background: 'var(--pri)', color: '#fff' }}><Icono n="mas" /></span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {items && !items.length && <p className="muted">No hay ítems cargados. Agregalos en Ajustes → Productos y servicios.</p>}
    </Hoja>
  )
}

/** Renglones de cobro con +/− */
export function ListaCargos({ cargos, editable }: { cargos: Cargo[]; editable: boolean }) {
  const vs = cargos.filter(c => !c.deleted)
  if (!vs.length) return <p className="muted small" style={{ margin: 0 }}>Sin productos ni servicios cargados.</p>
  return (
    <div className="lista">
      {vs.map(c => (
        <div key={c.id} className="row" style={{ padding: '8px 0' }}>
          <div className="main"><b>{c.descripcion}</b><small style={{ whiteSpace: 'normal' }}>{num(c.cantidad)} × {gs(c.precio_unit)} = {gs(c.cantidad * c.precio_unit)}</small></div>
          {editable && (
            <div className="hstack" style={{ flexWrap: 'nowrap' }}>
              <button className="btn sm" aria-label="Quitar uno" onClick={() => cambiarCantidad(c, -1)}><Icono n={c.cantidad <= 1 ? 'basura' : 'menos'} /></button>
              <b style={{ minWidth: 24, textAlign: 'center' }}>{num(c.cantidad)}</b>
              <button className="btn sm" aria-label="Agregar uno" onClick={() => cambiarCantidad(c, 1)}><Icono n="mas" /></button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function Chips<T extends string | number | null>({ opciones, valor, onCambio, scroll }: {
  opciones: { v: T; t: string }[]; valor: T; onCambio: (v: T) => void; scroll?: boolean
}) {
  return (
    <div className={'chips' + (scroll ? ' scroll' : '')}>
      {opciones.map(o => (
        <button key={String(o.v)} className={'chip' + (o.v === valor ? ' on' : '')} onClick={() => onCambio(o.v)}>{o.t}</button>
      ))}
    </div>
  )
}
