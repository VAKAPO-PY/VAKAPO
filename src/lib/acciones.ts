import { db, getMeta, type Cargo, type Examen, type Item, type Jornada, type Vaca } from './db'
import { guardar, actualizar, borrar } from './repo'
import { hoy, idDe, uid } from './util'
import { ITEM_RECORTE_PREVENTIVO } from './seed'

export async function precioDe(tambo_id: string, item: Item): Promise<number> {
  const t = await db.tarifas.get(idDe('tar', tambo_id, item.id))
  if (t && !t.deleted && t.precio != null) return Number(t.precio)
  return Number(item.precio) || 0
}

/** Una jornada por tambo y por día: si dos equipos la abren sin señal, terminan siendo la misma. */
export async function abrirJornadaDeHoy(tambo_id: string): Promise<Jornada> {
  const fecha = hoy()
  const id = idDe('j', tambo_id, fecha)
  const ex = await db.jornadas.get(id)
  const operador = await getMeta('operador', '')
  if (ex && !ex.deleted) {
    if (ex.estado !== 'abierta') await actualizar('jornadas', id, { estado: 'abierta' })
    return { ...ex, estado: 'abierta' }
  }
  return guardar<Jornada>('jornadas', { id, tambo_id, fecha, estado: 'abierta', operador })
}

export const idExamen = (jornada_id: string, vaca_id: string) => `${jornada_id}__${vaca_id}`

/** El examen se crea recién con la primera acción sobre la vaca (no por solo mirarla). */
export async function asegurarExamen(j: Jornada, vaca_id: string): Promise<Examen> {
  const id = idExamen(j.id, vaca_id)
  const ex = await db.examenes.get(id)
  if (ex && !ex.deleted) return ex
  const operador = await getMeta('operador', '')
  return guardar<Examen>('examenes', {
    id, tambo_id: j.tambo_id, jornada_id: j.id, vaca_id, fecha: new Date().toISOString(),
    preventivo: false, revision_fecha: null, revision_ok: false, notas: '', operador
  })
}

export async function buscarVaca(tambo_id: string, numero: string): Promise<Vaca | undefined> {
  const n = numero.trim()
  const vs = await db.vacas.where('[tambo_id+numero]').equals([tambo_id, n]).toArray()
  return vs.find(v => !v.deleted)
}

export async function crearVaca(tambo_id: string, numero: string, extra: Partial<Vaca> = {}): Promise<Vaca> {
  const n = numero.trim()
  const id = idDe('v', tambo_id, n)
  const previa = await db.vacas.get(id)
  return guardar<Vaca>('vacas', {
    ...(previa ?? {}), id, tambo_id, numero: n, lote_id: extra.lote_id ?? previa?.lote_id ?? null,
    categoria_id: extra.categoria_id ?? previa?.categoria_id ?? null, notas: previa?.notas ?? '', activa: true, deleted: false
  })
}

interface DestinoCargo { tambo_id: string; jornada_id: string; examen_id?: string | null; vaca_id?: string | null; fecha: string }

/** Suma un producto/servicio. Si ya estaba en el mismo examen, aumenta la cantidad. */
export async function agregarCargo(d: DestinoCargo, item: Item, cantidad = 1): Promise<void> {
  const todos = d.examen_id
    ? await db.cargos.where('examen_id').equals(d.examen_id).toArray()
    : await db.cargos.where('jornada_id').equals(d.jornada_id).toArray()
  const ex = todos.find(c => !c.deleted && c.item_id === item.id && (d.examen_id ? true : !c.examen_id))
  if (ex) {
    await actualizar('cargos', ex.id, { cantidad: Number(ex.cantidad) + cantidad })
    return
  }
  const precio = await precioDe(d.tambo_id, item)
  await guardar<Cargo>('cargos', {
    id: uid(), tambo_id: d.tambo_id, jornada_id: d.jornada_id, examen_id: d.examen_id ?? null, vaca_id: d.vaca_id ?? null,
    item_id: item.id, tipo: item.tipo, descripcion: item.nombre, cantidad, precio_unit: precio, fecha: d.fecha
  })
}

export async function cambiarCantidad(c: Cargo, delta: number) {
  const n = Number(c.cantidad) + delta
  if (n <= 0) await borrar('cargos', c.id)
  else await actualizar('cargos', c.id, { cantidad: n })
}

/** Plantilla rápida: recorte preventivo sin lesión, con un toque. */
export async function recortePreventivo(j: Jornada, vaca_id: string) {
  const ex = await asegurarExamen(j, vaca_id)
  await actualizar('examenes', ex.id, { preventivo: true })
  const item = await db.items.get(ITEM_RECORTE_PREVENTIVO)
  if (item && !item.deleted) {
    const cargos = await db.cargos.where('examen_id').equals(ex.id).toArray()
    if (!cargos.some(c => !c.deleted && c.item_id === item.id)) {
      await agregarCargo({ tambo_id: j.tambo_id, jornada_id: j.id, examen_id: ex.id, vaca_id, fecha: ex.fecha }, item)
    }
  }
}

export const subtotal = (cs: Cargo[]) => cs.filter(c => !c.deleted).reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unit), 0)
