import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type PataId } from '../lib/db'
import { datosReporte, pct } from '../lib/reportes'
import { ir } from '../lib/router'
import { fechaCorta, gs, hoy, mesNombre, sumarDias } from '../lib/util'
import { BottomNav, Seccion, TopBar, Vacio, toast } from '../components/ui'
import { Chips } from '../components/Selectores'
import { Diagrama, claveZona } from '../components/Diagrama'
import { Icono } from '../components/Icono'

type Periodo = '30' | '90' | '180' | '365' | 'todo' | 'custom'
const TIPO_NOMBRE: Record<string, string> = { servicio: 'Servicios', producto: 'Productos', cargo_fijo: 'Cargos fijos' }

export function ReportesInicio() {
  const tambos = useLiveQuery(async () => vivos(await db.tambos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)))
  if (!tambos) return null
  if (tambos.length === 1) { ir(`/reportes/${tambos[0].id}`, true); return null }
  return (
    <div className="app">
      <TopBar titulo="Reportes" />
      <main className="page">
        <h2>Elegí un tambo</h2>
        <section className="card flat lista">
          {tambos.length === 0 && <Vacio>No hay tambos.</Vacio>}
          {tambos.map(t => (
            <button key={t.id} className="row" onClick={() => ir(`/reportes/${t.id}`)}>
              <Icono n="granja" /><div className="main"><b>{t.nombre}</b></div><Icono n="sig" />
            </button>
          ))}
        </section>
      </main>
      <BottomNav />
    </div>
  )
}

export function ReportesPage({ tid }: { tid: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('90')
  const [desdeC, setDesdeC] = useState(sumarDias(hoy(), -30))
  const [hastaC, setHastaC] = useState(hoy())
  const [lote, setLote] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const [grupo, setGrupo] = useState<string>('todas')
  const [codigo, setCodigo] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const desde = periodo === 'custom' ? desdeC : periodo === 'todo' ? '2000-01-01' : sumarDias(hoy(), -Number(periodo))
  const hasta = periodo === 'custom' ? hastaC : hoy()

  const base = useLiveQuery(async () => ({
    t: await db.tambos.get(tid),
    lotes: vivos(await db.lotes.where('tambo_id').equals(tid).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    cats: vivos(await db.categorias.toArray()).sort((a, b) => a.orden - b.orden)
  }), [tid])
  const d = useLiveQuery(() => datosReporte({ tambo_id: tid, desde, hasta, lote_id: lote ?? undefined, categoria_id: cat ?? undefined }), [tid, desde, hasta, lote, cat])
  if (!base?.t || !d) return null

  const patasGrupo: Record<string, PataId[]> = { todas: ['MI', 'MD', 'TI', 'TD'], manos: ['MI', 'MD'], patas: ['TI', 'TD'], MI: ['MI'], MD: ['MD'], TI: ['TI'], TD: ['TD'] }
  const calor: Record<string, number> = {}
  for (const h of d.hallazgos) {
    if (h.nivel <= 0 || !patasGrupo[grupo].includes(h.pata) || (codigo && h.codigo !== codigo)) continue
    const k = claveZona(h.zona, h.pezuna)
    calor[k] = (calor[k] ?? 0) + 1
  }
  const orient: PataId = patasGrupo[grupo].length === 1 ? patasGrupo[grupo][0] : 'TI'
  const maxPrev = Math.max(0.0001, ...d.porLesion.map(l => l.prevalencia))
  const topCods = d.porLesion.filter(l => l.vacas > 0).slice(0, 4).map(l => l.codigo)
  const etiquetaPeriodo = `${fechaCorta(desde === '2000-01-01' ? (d.examenes.map(e => e.fecha).sort()[0] ?? desde) : desde)} – ${fechaCorta(hasta)}`

  async function exportar(tipo: 'pdf' | 'xlsx') {
    setExportando(true)
    try {
      const m = await import('../lib/exportar')
      const filtros = [etiquetaPeriodo, lote && base!.lotes.find(l => l.id === lote)?.nombre, cat && base!.cats.find(c => c.id === cat)?.nombre].filter(Boolean).join(' · ')
      if (tipo === 'pdf') await m.reportePDF(d!, base!.t!.nombre, filtros, svgRef.current)
      else await m.reporteExcel(d!, base!.t!.nombre, filtros)
    } catch (e) { console.error(e); toast('No se pudo exportar') } finally { setExportando(false) }
  }

  return (
    <div className="app">
      <TopBar titulo="Reportes" sub={base.t.nombre} atras={`/t/${tid}`} />
      <main className="page">
        <Chips scroll valor={periodo} onCambio={setPeriodo}
          opciones={[{ v: '30', t: '30 días' }, { v: '90', t: '3 meses' }, { v: '180', t: '6 meses' }, { v: '365', t: '12 meses' }, { v: 'todo', t: 'Todo' }, { v: 'custom', t: 'Fechas…' }]} />
        {periodo === 'custom' && (
          <div className="fila-btns">
            <label className="campo">Desde<input className="input" type="date" value={desdeC} onChange={e => setDesdeC(e.target.value)} /></label>
            <label className="campo">Hasta<input className="input" type="date" value={hastaC} onChange={e => setHastaC(e.target.value)} /></label>
          </div>
        )}
        {base.lotes.length > 0 && <Chips scroll valor={lote} onCambio={setLote} opciones={[{ v: null, t: 'Todos los lotes' }, ...base.lotes.map(l => ({ v: l.id as string | null, t: l.nombre }))]} />}
        <Chips scroll valor={cat} onCambio={setCat} opciones={[{ v: null, t: 'Todas las categorías' }, ...base.cats.map(c => ({ v: c.id as string | null, t: c.nombre }))]} />

        <div className="kpis">
          <div className="kpi"><b>{d.examinadas}</b><span>vacas examinadas</span></div>
          <div className="kpi"><b>{d.examinadas ? pct(d.conLesion / d.examinadas) : '—'}</b><span>con lesión ({d.conLesion})</span></div>
          <div className="kpi"><b>{d.jornadas}</b><span>jornadas</span></div>
          <div className="kpi"><b style={{ fontSize: '1.15rem' }}>{gs(d.costoTotal)}</b><span>costo total</span></div>
        </div>

        <Seccion titulo="Mapa de calor">
          <div className="stack">
            <Chips scroll valor={grupo} onCambio={setGrupo}
              opciones={[{ v: 'todas', t: 'Todas' }, { v: 'patas', t: 'Patas (tras.)' }, { v: 'manos', t: 'Manos' }, { v: 'MI', t: 'Mano izq.' }, { v: 'MD', t: 'Mano der.' }, { v: 'TI', t: 'Pata izq.' }, { v: 'TD', t: 'Pata der.' }]} />
            <Chips scroll valor={codigo} onCambio={setCodigo} opciones={[{ v: null, t: 'Todas las lesiones' }, ...d.porLesion.filter(l => l.vacas > 0).map(l => ({ v: l.codigo as string | null, t: l.codigo }))]} />
            <div className="diagrama" style={{ border: 0, padding: 0 }}><Diagrama ref={svgRef} pata={orient} calor={calor} /></div>
            <p className="small muted center" style={{ margin: 0 }}>Número = cantidad de lesiones en esa zona. Rojo = más frecuente.</p>
          </div>
        </Seccion>

        <Seccion titulo="Prevalencia por lesión">
          {d.porLesion.filter(l => l.vacas > 0).length === 0 && <p className="muted" style={{ margin: 0 }}>Sin lesiones en el período.</p>}
          <div className="stack" style={{ gap: 4 }}>
            {d.porLesion.filter(l => l.vacas > 0).map(l => (
              <div key={l.codigo} className="barra-h" title={l.nombre}>
                <b>{l.codigo}</b>
                <div className="pista"><i style={{ width: `${(l.prevalencia / maxPrev) * 100}%` }} /></div>
                <span>{pct(l.prevalencia)}</span>
              </div>
            ))}
          </div>
          {d.porLesion.some(l => l.vacas > 0) && <p className="small muted" style={{ marginBottom: 0 }}>% de vacas examinadas con esa lesión (grado mayor a normal).</p>}
        </Seccion>

        {d.porMes.length > 0 && (
          <Seccion titulo="Evolución por mes">
            <div className="scroll-x">
              <table className="tabla">
                <thead><tr><th>Mes</th><th className="r">Vacas</th><th className="r">Con lesión</th>{topCods.map(c => <th key={c} className="r">{c}</th>)}</tr></thead>
                <tbody>
                  {d.porMes.map(m => (
                    <tr key={m.mes}>
                      <td>{mesNombre(m.mes)}</td><td className="r">{m.examinadas}</td>
                      <td className="r"><b>{pct(m.examinadas ? m.conLesion / m.examinadas : 0)}</b></td>
                      {topCods.map(c => <td key={c} className="r">{pct(m.examinadas ? (m.porCodigo[c] ?? 0) / m.examinadas : 0)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>
        )}

        {d.porLote.length > 0 && (
          <Seccion titulo="Por lote">
            <table className="tabla">
              <thead><tr><th>Lote</th><th className="r">Vacas</th><th className="r">Con lesión</th><th className="r">Principal</th></tr></thead>
              <tbody>{d.porLote.map(l => <tr key={l.lote}><td>{l.lote}</td><td className="r">{l.examinadas}</td><td className="r"><b>{pct(l.prevalencia)}</b></td><td className="r">{l.principal}</td></tr>)}</tbody>
            </table>
          </Seccion>
        )}

        <Seccion titulo="Costos">
          <div className="stack">
            {Object.entries(d.costoPorTipo).map(([t, v]) => (
              <div key={t} className="sec-head" style={{ margin: 0 }}><span>{TIPO_NOMBRE[t] ?? t}</span><b>{gs(v)}</b></div>
            ))}
            <div className="sec-head" style={{ margin: 0, borderTop: '1px solid var(--line)', paddingTop: 8 }}><b>Total</b><b>{gs(d.costoTotal)}</b></div>
            {d.porJornada.length > 0 && (
              <>
                <h3 style={{ marginTop: 8 }}>Por jornada</h3>
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th className="r">Vacas</th><th className="r">Total</th></tr></thead>
                  <tbody>{d.porJornada.map(j => (
                    <tr key={j.jornada.id} onClick={() => ir(`/t/${tid}/j/${j.jornada.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{fechaCorta(j.jornada.fecha)}</td><td className="r">{j.vacas}</td><td className="r">{gs(j.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>
            )}
            {d.porVaca.length > 0 && (
              <>
                <h3 style={{ marginTop: 8 }}>Vacas con mayor costo</h3>
                <table className="tabla">
                  <thead><tr><th>Vaca</th><th className="r">Exámenes</th><th className="r">Total</th></tr></thead>
                  <tbody>{d.porVaca.slice(0, 10).map(v => (
                    <tr key={v.vaca_id} onClick={() => ir(`/t/${tid}/vaca/${v.vaca_id}`)} style={{ cursor: 'pointer' }}>
                      <td><b>{v.vaca?.numero ?? '?'}</b></td><td className="r">{v.examenes}</td><td className="r">{gs(v.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>
            )}
          </div>
        </Seccion>

        <div className="fila-btns">
          <button className="btn pri" disabled={exportando} onClick={() => exportar('pdf')}><Icono n="descargar" /> PDF</button>
          <button className="btn pri" disabled={exportando} onClick={() => exportar('xlsx')}><Icono n="descargar" /> Excel</button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
