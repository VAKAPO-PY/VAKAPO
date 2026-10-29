import { db, vivos, type Cargo, type Examen, type Hallazgo, type Jornada, type Lesion, type Lote, type Vaca } from './db'
import { hoy } from './util'

export interface FiltroReporte { tambo_id: string; desde: string; hasta: string; lote_id?: string; categoria_id?: string }

export interface FilaLesion { codigo: string; nombre: string; vacas: number; hallazgos: number; prevalencia: number; niveles: number[] }
export interface FilaMes { mes: string; examinadas: number; conLesion: number; porCodigo: Record<string, number> }
export interface FilaLote { lote: string; examinadas: number; conLesion: number; prevalencia: number; principal: string }
export interface FilaJornada { jornada: Jornada; vacas: number; total: number }
export interface FilaVacaCosto { vaca?: Vaca; vaca_id: string; total: number; examenes: number }

export interface DatosReporte {
  filtro: FiltroReporte
  examenes: Examen[]
  hallazgos: Hallazgo[]
  cargos: Cargo[]
  vacas: Map<string, Vaca>
  lesiones: Map<string, Lesion>
  examinadas: number
  conLesion: number
  jornadas: number
  costoTotal: number
  porLesion: FilaLesion[]
  porMes: FilaMes[]
  porLote: FilaLote[]
  costoPorTipo: Record<string, number>
  porJornada: FilaJornada[]
  porVaca: FilaVacaCosto[]
}

const fechaLocal = (iso: string) => hoy(new Date(iso))

export async function datosReporte(f: FiltroReporte): Promise<DatosReporte> {
  const [vs, exs, hs, cs, ls, lotes, js] = await Promise.all([
    db.vacas.where('tambo_id').equals(f.tambo_id).toArray(),
    db.examenes.where('tambo_id').equals(f.tambo_id).toArray(),
    db.hallazgos.where('tambo_id').equals(f.tambo_id).toArray(),
    db.cargos.where('tambo_id').equals(f.tambo_id).toArray(),
    db.lesiones.toArray(),
    db.lotes.where('tambo_id').equals(f.tambo_id).toArray(),
    db.jornadas.where('tambo_id').equals(f.tambo_id).toArray()
  ])
  const filtrando = !!(f.lote_id || f.categoria_id)
  const vacas = new Map(vivos(vs)
    .filter(v => (!f.lote_id || v.lote_id === f.lote_id) && (!f.categoria_id || v.categoria_id === f.categoria_id))
    .map(v => [v.id, v]))
  const enRango = (iso: string) => { const d = fechaLocal(iso); return d >= f.desde && d <= f.hasta }
  const examenes = vivos(exs).filter(e => vacas.has(e.vaca_id) && enRango(e.fecha))
  const exIds = new Set(examenes.map(e => e.id))
  const hallazgos = vivos(hs).filter(h => exIds.has(h.examen_id))
  const lesionados = hallazgos.filter(h => h.nivel > 0)
  const cargos = vivos(cs).filter(c => {
    if (c.examen_id) return exIds.has(c.examen_id)
    const d = c.fecha.length > 10 ? fechaLocal(c.fecha) : c.fecha
    return !filtrando && d >= f.desde && d <= f.hasta
  })
  const lesiones = new Map(vivos(ls).map(l => [l.codigo, l]))

  const examinadasSet = new Set(examenes.map(e => e.vaca_id))
  const conLesionSet = new Set(lesionados.map(h => h.vaca_id))
  const examinadas = examinadasSet.size

  // Por lesión
  const pl = new Map<string, { vacas: Set<string>; n: number; niveles: number[] }>()
  for (const h of hallazgos) {
    const x = pl.get(h.codigo) ?? { vacas: new Set<string>(), n: 0, niveles: [0, 0, 0, 0] }
    if (h.nivel > 0) x.vacas.add(h.vaca_id)
    x.n++
    x.niveles[Math.max(0, Math.min(3, h.nivel))]++
    pl.set(h.codigo, x)
  }
  const porLesion: FilaLesion[] = [...pl.entries()].map(([codigo, x]) => ({
    codigo, nombre: lesiones.get(codigo)?.nombre ?? codigo, vacas: x.vacas.size, hallazgos: x.n,
    prevalencia: examinadas ? x.vacas.size / examinadas : 0, niveles: x.niveles
  })).sort((a, b) => b.prevalencia - a.prevalencia || b.hallazgos - a.hallazgos)

  // Por mes
  const meses = new Map<string, { ex: Set<string>; les: Set<string>; cod: Map<string, Set<string>> }>()
  for (const e of examenes) {
    const m = fechaLocal(e.fecha).slice(0, 7)
    const x = meses.get(m) ?? { ex: new Set(), les: new Set(), cod: new Map() }
    x.ex.add(e.vaca_id)
    meses.set(m, x)
  }
  for (const h of lesionados) {
    const m = fechaLocal(h.fecha).slice(0, 7)
    const x = meses.get(m)
    if (!x) continue
    x.les.add(h.vaca_id)
    const s = x.cod.get(h.codigo) ?? new Set<string>()
    s.add(h.vaca_id)
    x.cod.set(h.codigo, s)
  }
  const porMes: FilaMes[] = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, x]) => ({
    mes, examinadas: x.ex.size, conLesion: x.les.size,
    porCodigo: Object.fromEntries([...x.cod.entries()].map(([c, s]) => [c, s.size]))
  }))

  // Por lote
  const loteMap = new Map(vivos(lotes).map(l => [l.id, l] as [string, Lote]))
  const pLote = new Map<string, { ex: Set<string>; les: Set<string>; cod: Map<string, number> }>()
  for (const e of examenes) {
    const k = vacas.get(e.vaca_id)?.lote_id ?? ''
    const x = pLote.get(k) ?? { ex: new Set(), les: new Set(), cod: new Map() }
    x.ex.add(e.vaca_id)
    pLote.set(k, x)
  }
  for (const h of lesionados) {
    const k = vacas.get(h.vaca_id)?.lote_id ?? ''
    const x = pLote.get(k)
    if (!x) continue
    x.les.add(h.vaca_id)
    x.cod.set(h.codigo, (x.cod.get(h.codigo) ?? 0) + 1)
  }
  const porLote: FilaLote[] = [...pLote.entries()].map(([k, x]) => ({
    lote: k ? (loteMap.get(k)?.nombre ?? '—') : 'Sin lote', examinadas: x.ex.size, conLesion: x.les.size,
    prevalencia: x.ex.size ? x.les.size / x.ex.size : 0,
    principal: [...x.cod.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  })).sort((a, b) => b.prevalencia - a.prevalencia)

  // Costos
  const val = (c: Cargo) => Number(c.cantidad) * Number(c.precio_unit)
  const costoTotal = cargos.reduce((s, c) => s + val(c), 0)
  const costoPorTipo: Record<string, number> = {}
  for (const c of cargos) costoPorTipo[c.tipo] = (costoPorTipo[c.tipo] ?? 0) + val(c)
  const jMap = new Map(vivos(js).map(j => [j.id, j]))
  const pJ = new Map<string, { vacas: Set<string>; total: number }>()
  for (const e of examenes) {
    const x = pJ.get(e.jornada_id) ?? { vacas: new Set(), total: 0 }
    x.vacas.add(e.vaca_id)
    pJ.set(e.jornada_id, x)
  }
  for (const c of cargos) {
    const x = pJ.get(c.jornada_id) ?? { vacas: new Set(), total: 0 }
    x.total += val(c)
    pJ.set(c.jornada_id, x)
  }
  const porJornada: FilaJornada[] = [...pJ.entries()].filter(([id]) => jMap.has(id))
    .map(([id, x]) => ({ jornada: jMap.get(id)!, vacas: x.vacas.size, total: x.total }))
    .sort((a, b) => b.jornada.fecha.localeCompare(a.jornada.fecha))
  const pV = new Map<string, { total: number; ex: Set<string> }>()
  for (const c of cargos) {
    if (!c.vaca_id) continue
    const x = pV.get(c.vaca_id) ?? { total: 0, ex: new Set() }
    x.total += val(c)
    if (c.examen_id) x.ex.add(c.examen_id)
    pV.set(c.vaca_id, x)
  }
  const porVaca: FilaVacaCosto[] = [...pV.entries()].map(([vaca_id, x]) => ({ vaca_id, vaca: vacas.get(vaca_id), total: x.total, examenes: x.ex.size }))
    .sort((a, b) => b.total - a.total)

  return {
    filtro: f, examenes, hallazgos, cargos, vacas, lesiones, examinadas, conLesion: conLesionSet.size,
    jornadas: new Set(examenes.map(e => e.jornada_id)).size, costoTotal, porLesion, porMes, porLote, costoPorTipo, porJornada, porVaca
  }
}

export const pct = (x: number) => `${Math.round(x * 1000) / 10}%`
