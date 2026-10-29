import { db, type Base, type TablaSync } from './db'

/** Se emite en cada cambio local; el motor de sincronización lo escucha. */
export const bus = new EventTarget()
const avisar = () => bus.dispatchEvent(new Event('cambio'))

type Fila = Base & Record<string, unknown>

/**
 * Guardado inmediato en el dispositivo (IndexedDB). Cada toque queda grabado al instante,
 * aunque se cierre la app o se apague el equipo un segundo después.
 */
export async function guardar<T extends Base>(tabla: TablaSync, fila: T): Promise<T> {
  const f = { ...fila, deleted: fila.deleted ?? false, _dirty: 1, _ts: Date.now() }
  await db.table(tabla).put(f)
  avisar()
  return f
}

export async function actualizar(tabla: TablaSync, id: string, cambios: Record<string, unknown>) {
  await db.table(tabla).update(id, { ...cambios, _dirty: 1, _ts: Date.now() })
  avisar()
}

/** Borrado lógico: se sincroniza para que desaparezca en todos los equipos. */
export async function borrar(tabla: TablaSync, id: string) {
  await actualizar(tabla, id, { deleted: true })
}

export async function guardarVarios(tabla: TablaSync, filas: Fila[]) {
  const ts = Date.now()
  await db.table(tabla).bulkPut(filas.map(f => ({ ...f, deleted: f.deleted ?? false, _dirty: 1, _ts: ts })))
  avisar()
}
