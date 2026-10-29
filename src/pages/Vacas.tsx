import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Hallazgo } from '../lib/db'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { subtotal } from '../lib/acciones'
import { pataCorto, pezunaNombre } from '../lib/anatomia'
import { fechaCorta, gs, hoy, ordenNumero } from '../lib/util'
import { BottomNav, Seccion, TopBar, Vacio } from '../components/ui'
import { Chips } from '../components/Selectores'
import { GaleriaFotos } from '../components/Fotos'
import { Diagrama, claveZona } from '../components/Diagrama'
import { Icono } from '../components/Icono'
import { CrearVaca } from './Jornada'
import { DatosVaca } from './Examen'

export function VacasPage({ tid }: { tid: string }) {
  const { esAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [lote, setLote] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const [inactivas, setInactivas] = useState(false)
  const [nueva, setNueva] = useState(false)
  const d = useLiveQuery(async () => {
    const t = await db.tambos.get(tid)
    const vacas = vivos(await db.vacas.where('tambo_id').equals(tid).toArray()).sort((a, b) => ordenNumero(a.numero, b.numero))
    const exs = vivos(await db.examenes.where('tambo_id').equals(tid).toArray())
    const ult = new Map<string, string>()
    for (const e of exs) if ((ult.get(e.vaca_id) ?? '') < e.fecha) ult.set(e.vaca_id, e.fecha)
    const lotes = vivos(await db.lotes.where('tambo_id').equals(tid).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const cats = vivos(await db.categorias.toArray()).sort((a, b) => a.orden - b.orden)
    return { t, vacas, ult, lotes, cats }
  }, [tid])
  if (!d) return null
  const lista = d.vacas.filter(v => (inactivas ? v.activa === false : v.activa !== false) && (!q || v.numero.includes(q)) && (!lote || v.lote_id === lote) && (!cat || v.categoria_id === cat))
  const nombreLote = (id?: string | null) => d.lotes.find(l => l.id === id)?.nombre
  const nombreCat = (id?: string | null) => d.cats.find(c => c.id === id)?.nombre

  return (
    <div className="app">
      <TopBar titulo="Vacas" sub={d.t?.nombre} atras={`/t/${tid}`} />
      <main className="page">
        <div className="hstack" style={{ flexWrap: 'nowrap' }}>
          <input className="input grow" inputMode="numeric" placeholder="Buscar N°" value={q} onChange={e => setQ(e.target.value)} />
          {esAdmin && <button className="btn pri" onClick={() => setNueva(true)}><Icono n="mas" /> Nueva</button>}
        </div>
        {d.lotes.length > 0 && <Chips scroll opciones={[{ v: null, t: 'Todos los lotes' }, ...d.lotes.map(l => ({ v: l.id as string | null, t: l.nombre }))]} valor={lote} onCambio={setLote} />}
        <Chips scroll opciones={[{ v: null, t: 'Todas las categorías' }, ...d.cats.map(c => ({ v: c.id as string | null, t: c.nombre }))]} valor={cat} onCambio={setCat} />
        <section className="card flat lista">
          {lista.length === 0 && <Vacio>No hay vacas con ese filtro.</Vacio>}
          {lista.map(v => (
            <button key={v.id} className="row" onClick={() => ir(`/t/${tid}/vaca/${v.id}`)}>
              <span className="num">{v.numero}</span>
              <div className="main">
                <b>{[nombreLote(v.lote_id), nombreCat(v.categoria_id)].filter(Boolean).join(' · ') || 'Sin lote ni categoría'}</b>
                <small>{d.ult.get(v.id) ? `Último examen ${fechaCorta(d.ult.get(v.id))}` : 'Nunca examinada'}</small>
              </div>
              <Icono n="sig" />
            </button>
          ))}
        </section>
        <button className="btn ghost" onClick={() => setInactivas(!inactivas)}>{inactivas ? 'Ver vacas activas' : 'Ver vacas inactivas / dadas de baja'}</button>
      </main>
      {nueva && <CrearVaca tid={tid} numero="" onCerrar={() => setNueva(false)} onCreada={id => { setNueva(false); ir(`/t/${tid}/vaca/${id}`) }} />}
      <BottomNav />
    </div>
  )
}

export function VacaPage({ tid, vid }: { tid: string; vid: string }) {
  const { esAdmin } = useAuth()
  const [editar, setEditar] = useState(false)
  const [mapa, setMapa] = useState(false)
  const d = useLiveQuery(async () => {
    const v = await db.vacas.get(vid)
    const exs = vivos(await db.examenes.where('vaca_id').equals(vid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const hs = vivos(await db.hallazgos.where('vaca_id').equals(vid).toArray())
    const cargos = vivos(await db.cargos.where('vaca_id').equals(vid).toArray())
    const recetas = vivos(await db.recetas.where('vaca_id').equals(vid).toArray())
    const fotos = vivos(await db.fotos.where('vaca_id').equals(vid).toArray())
    const notas = vivos(await db.notas_prop.where('vaca_id').equals(vid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const lesiones = vivos(await db.lesiones.toArray())
    const lote = v?.lote_id ? await db.lotes.get(v.lote_id) : undefined
    const cat = v?.categoria_id ? await db.categorias.get(v.categoria_id) : undefined
    return { v, exs, hs, cargos, recetas, fotos, notas, lesiones, lote, cat }
  }, [vid])
  if (!d?.v) return null
  const calor: Record<string, number> = {}
  for (const h of d.hs) if (h.nivel > 0) { const k = claveZona(h.zona, h.pezuna); calor[k] = (calor[k] ?? 0) + 1 }
  const nombreGrado = (h: Hallazgo) => d.lesiones.find(l => l.id === h.lesion_id)?.grados.find(g => g.cod === h.grado)?.nombre ?? h.grado

  return (
    <div className="app">
      <TopBar titulo={`Vaca ${d.v.numero}`} sub={[d.lote?.nombre, d.cat?.nombre].filter(Boolean).join(' · ') || 'Historial'} atras={`/t/${tid}/vacas`}
        derecha={esAdmin ? <button className="icon-btn" aria-label="Editar vaca" onClick={() => setEditar(true)}><Icono n="editar" /></button> : undefined} />
      <main className="page">
        <div className="kpis">
          <div className="kpi"><b>{d.exs.length}</b><span>exámenes</span></div>
          <div className="kpi"><b>{d.hs.filter(h => h.nivel > 0).length}</b><span>lesiones registradas</span></div>
          <div className="kpi"><b>{gs(subtotal(d.cargos))}</b><span>costo acumulado</span></div>
          <div className="kpi"><b>{d.exs[0] ? fechaCorta(d.exs[0].fecha) : '—'}</b><span>último examen</span></div>
        </div>
        {d.v.notas && <div className="aviso info"><Icono n="nota" /> {d.v.notas}</div>}
        {d.hs.some(h => h.nivel > 0) && (
          <button className="btn block" onClick={() => setMapa(!mapa)}><Icono n="pezuna" /> {mapa ? 'Ocultar' : 'Ver'} mapa de lesiones de esta vaca</button>
        )}
        {mapa && <div className="diagrama"><Diagrama calor={calor} /><p className="small muted center" style={{ margin: '4px 0 0' }}>Todas las patas sumadas · número = veces</p></div>}

        {d.notas.length > 0 && (
          <Seccion titulo="Notas del propietario">
            <div className="stack">{d.notas.map(n => <div key={n.id} className="aviso warn"><Icono n="nota" /><span><b>{n.tipo}</b> · {fechaCorta(n.fecha)} · {n.autor_nombre}<br />{n.texto}</span></div>)}</div>
          </Seccion>
        )}

        <h2>Historial</h2>
        {d.exs.length === 0 && <Vacio>Sin exámenes todavía.</Vacio>}
        {d.exs.map(e => {
          const hs = d.hs.filter(h => h.examen_id === e.id)
          const cs = d.cargos.filter(c => c.examen_id === e.id)
          const rs = d.recetas.filter(r => r.examen_id === e.id)
          const fs = d.fotos.filter(f => f.examen_id === e.id)
          return (
            <section key={e.id} className="card stack">
              <div className="sec-head" style={{ margin: 0 }}>
                <h3>{fechaCorta(e.fecha)}</h3>
                <button className="btn sm ghost" onClick={() => ir(`/t/${tid}/j/${e.jornada_id}/v/${vid}`)}>Abrir <Icono n="sig" size={18} /></button>
              </div>
              {e.preventivo && <span className="tag n0" style={{ alignSelf: 'flex-start' }}>Recorte preventivo</span>}
              {hs.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  {hs.map(h => (
                    <div key={h.id} className="hstack" style={{ flexWrap: 'nowrap' }}>
                      <span className={'tag n' + h.nivel}>{h.codigo} {h.grado}</span>
                      <small className="muted">{pataCorto(h.pata)} · Z{h.zona}{h.pezuna ? ' ' + pezunaNombre(h.pezuna) : ''} · {nombreGrado(h)}</small>
                    </div>
                  ))}
                </div>
              )}
              {!e.preventivo && hs.length === 0 && <span className="muted small">Sin lesiones</span>}
              {cs.length > 0 && <small className="muted">{cs.map(c => `${c.descripcion}${c.cantidad > 1 ? ' ×' + c.cantidad : ''}`).join(', ')} · <b>{gs(subtotal(cs))}</b></small>}
              {rs.map(r => <small key={r.id}><Icono n="receta" size={14} /> {r.medicamento} {r.dosis} {r.via} {r.duracion}</small>)}
              {e.revision_fecha && <small className={e.revision_fecha <= hoy() ? '' : 'muted'}><Icono n="reloj" size={14} /> Revisión {fechaCorta(e.revision_fecha)}</small>}
              {e.notas && <small>{e.notas}</small>}
              <GaleriaFotos fotos={fs} />
            </section>
          )
        })}
      </main>
      {editar && <DatosVaca vid={vid} tid={tid} onCerrar={() => setEditar(false)} />}
      <BottomNav />
    </div>
  )
}

export function JornadasPage({ tid }: { tid: string }) {
  const d = useLiveQuery(async () => {
    const t = await db.tambos.get(tid)
    const js = vivos(await db.jornadas.where('tambo_id').equals(tid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const exs = vivos(await db.examenes.where('tambo_id').equals(tid).toArray())
    const cs = vivos(await db.cargos.where('tambo_id').equals(tid).toArray())
    return { t, filas: js.map(j => ({ j, vacas: exs.filter(e => e.jornada_id === j.id).length, total: subtotal(cs.filter(c => c.jornada_id === j.id)) })) }
  }, [tid])
  if (!d) return null
  return (
    <div className="app">
      <TopBar titulo="Jornadas" sub={d.t?.nombre} atras={`/t/${tid}`} />
      <main className="page">
        <section className="card flat lista">
          {d.filas.length === 0 && <Vacio>Sin jornadas.</Vacio>}
          {d.filas.map(({ j, vacas, total }) => (
            <button key={j.id} className="row" onClick={() => ir(`/t/${tid}/j/${j.id}`)}>
              <Icono n={j.estado === 'abierta' ? 'calendario' : 'candado'} />
              <div className="main"><b>{fechaCorta(j.fecha)}</b><small>{vacas} vacas · {j.estado === 'abierta' ? 'abierta' : 'cerrada'}{j.operador ? ' · ' + j.operador : ''}</small></div>
              <span className="der">{gs(total)}</span>
            </button>
          ))}
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
