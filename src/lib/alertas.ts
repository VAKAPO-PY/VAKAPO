import { db, getMeta, vivos, type Examen, type Hallazgo, type Tambo, type Vaca } from './db'
import { diasEntre, hoy, sumarDias } from './util'

export interface AlertaRevision { examen: Examen; vaca?: Vaca; tambo?: Tambo; dias: number; hallazgos: Hallazgo[] }
export interface AlertaRecurrente { vaca?: Vaca; tambo?: Tambo; vaca_id: string; codigo: string; veces: number; ultima: string }
export interface Alertas { revisiones: AlertaRevision[]; recurrentes: AlertaRecurrente[]; urgentes: number }

const fechaLocal = (iso: string) => hoy(new Date(iso))

/** Alertas solo para administradores: revisiones pendientes y vacas con lesiones repetidas. */
export async function calcularAlertas(tambo_id?: string): Promise<Alertas> {
  const umbral = await getMeta('umbral_recurrente', 3)
  const [exsAll, hsAll, vacas, tambos] = await Promise.all([
    tambo_id ? db.examenes.where('tambo_id').equals(tambo_id).toArray() : db.examenes.toArray(),
    tambo_id ? db.hallazgos.where('tambo_id').equals(tambo_id).toArray() : db.hallazgos.toArray(),
    tambo_id ? db.vacas.where('tambo_id').equals(tambo_id).toArray() : db.vacas.toArray(),
    db.tambos.toArray()
  ])
  const exs = vivos(exsAll), hs = vivos(hsAll)
  const vacaMap = new Map(vivos(vacas).map(v => [v.id, v]))
  const tamboMap = new Map(vivos(tambos).map(t => [t.id, t]))
  const exPorVaca = new Map<string, Examen[]>()
  for (const e of exs) {
    if (!vacaMap.has(e.vaca_id) || !tamboMap.has(e.tambo_id)) continue
    const l = exPorVaca.get(e.vaca_id) ?? []
    l.push(e)
    exPorVaca.set(e.vaca_id, l)
  }
  const hsPorExamen = new Map<string, Hallazgo[]>()
  for (const h of hs) {
    const l = hsPorExamen.get(h.examen_id) ?? []
    l.push(h)
    hsPorExamen.set(h.examen_id, l)
  }

  const hoyStr = hoy()
  const revisiones: AlertaRevision[] = []
  for (const [vaca_id, lista] of exPorVaca) {
    for (const e of lista) {
      if (!e.revision_fecha || e.revision_ok) continue
      // Se da por hecha si la vaca volvió a ser examinada en otra jornada posterior
      if (lista.some(o => o.id !== e.id && fechaLocal(o.fecha) > fechaLocal(e.fecha))) continue
      revisiones.push({
        examen: e, vaca: vacaMap.get(vaca_id), tambo: tamboMap.get(e.tambo_id),
        dias: diasEntre(hoyStr, e.revision_fecha), hallazgos: (hsPorExamen.get(e.id) ?? []).filter(h => h.nivel > 0)
      })
    }
  }
  revisiones.sort((a, b) => a.dias - b.dias)

  const desde = sumarDias(hoyStr, -365)
  const grupos = new Map<string, { vaca_id: string; codigo: string; examenes: Set<string>; ultima: string }>()
  for (const h of hs) {
    if (h.nivel <= 0 || !vacaMap.has(h.vaca_id)) continue
    const f = fechaLocal(h.fecha)
    if (f < desde) continue
    const k = h.vaca_id + '|' + h.codigo
    const g = grupos.get(k) ?? { vaca_id: h.vaca_id, codigo: h.codigo, examenes: new Set<string>(), ultima: f }
    g.examenes.add(h.examen_id)
    if (f > g.ultima) g.ultima = f
    grupos.set(k, g)
  }
  const recurrentes: AlertaRecurrente[] = []
  for (const g of grupos.values()) {
    if (g.examenes.size >= umbral) {
      const vaca = vacaMap.get(g.vaca_id)
      recurrentes.push({ vaca, tambo: vaca ? tamboMap.get(vaca.tambo_id) : undefined, vaca_id: g.vaca_id, codigo: g.codigo, veces: g.examenes.size, ultima: g.ultima })
    }
  }
  recurrentes.sort((a, b) => b.veces - a.veces)
  const urgentes = revisiones.filter(r => r.dias <= 0).length + recurrentes.length
  return { revisiones, recurrentes, urgentes }
}
