import { db, COLUMNAS, TABLAS_SYNC, getMeta, setMeta, type Rol, type TablaSync } from './db'
import { bus } from './repo'
import { supabase, MODO_NUBE } from './supabase'
import { subirFotos } from './fotos'
import { debounce } from './util'

/**
 * Sincronización "primero local":
 * - Todo se graba en el dispositivo. La nube es una copia que se actualiza cuando hay señal.
 * - SUBIR: filas marcadas _dirty=1 → upsert por id.
 * - BAJAR: filas con updated_at (hora del servidor) mayor al último cursor.
 * - Conflictos: cada registro es pequeño e independiente (un hallazgo, un producto, una foto),
 *   así dos equipos trabajando a la vez casi nunca tocan el mismo registro.
 *   Si lo hacen, gana la última versión que llegó al servidor. Nunca se pisa un cambio local sin subir.
 */

export interface EstadoSync { online: boolean; sincronizando: boolean; ultimo?: number; error?: string }
let estado: EstadoSync = { online: typeof navigator === 'undefined' ? true : navigator.onLine, sincronizando: false }
const subs = new Set<() => void>()
export const estadoSync = {
  get: () => estado,
  sub(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } }
}
function fijar(p: Partial<EstadoSync>) { estado = { ...estado, ...p }; subs.forEach(f => f()) }

let rolActual: Rol | null = null
export function fijarRolSync(r: Rol | null) { rolActual = r }

function limpiar(t: TablaSync, fila: Record<string, unknown>) {
  const out: Record<string, unknown> = { id: fila.id, deleted: !!fila.deleted }
  for (const c of COLUMNAS[t]) out[c] = fila[c] === undefined ? null : fila[c]
  return out
}

async function subirTabla(t: TablaSync) {
  const tabla = db.table(t)
  const filas = await tabla.where('_dirty').equals(1).toArray()
  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200)
    const { error } = await supabase!.from(t).upsert(lote.map(f => limpiar(t, f)), { onConflict: 'id' })
    if (error) throw new Error(`${t}: ${error.message}`)
    await db.transaction('rw', tabla, async () => {
      for (const f of lote) {
        const act = await tabla.get(f.id)
        // Solo se desmarca si nadie lo modificó mientras se subía
        if (act && act._ts === f._ts) await tabla.update(f.id, { _dirty: 0 })
      }
    })
  }
}

async function bajarTabla(t: TablaSync) {
  const tabla = db.table(t)
  const cursor = await getMeta<string>(`cursor_${t}`, '1970-01-01T00:00:00.000Z')
  // 2 minutos de margen por transacciones que se confirman fuera de orden (traer de más es inofensivo)
  const desde = new Date(Date.parse(cursor) - 120_000).toISOString()
  let max = cursor
  let pagina = 0
  for (;;) {
    const { data, error } = await supabase!
      .from(t).select('*').gt('updated_at', desde)
      .order('updated_at', { ascending: true }).order('id', { ascending: true })
      .range(pagina * 1000, pagina * 1000 + 999)
    if (error) throw new Error(`${t}: ${error.message}`)
    const filas = (data ?? []) as Record<string, unknown>[]
    if (!filas.length) break
    await db.transaction('rw', tabla, async () => {
      for (const r of filas) {
        const loc = await tabla.get(r.id as string)
        if (loc?._dirty) continue // hay un cambio local pendiente: se respeta
        await tabla.put({ ...r, _dirty: 0, _ts: loc?._ts ?? 0 })
      }
    })
    for (const r of filas) if (Date.parse(r.updated_at as string) > Date.parse(max)) max = r.updated_at as string
    if (filas.length < 1000) break
    pagina++
  }
  await setMeta(`cursor_${t}`, max)
}

let enCurso: Promise<void> | null = null
let otraVez = false

export function sincronizar(): Promise<void> {
  if (!MODO_NUBE || !supabase || !rolActual) return Promise.resolve()
  if (enCurso) { otraVez = true; return enCurso }
  enCurso = (async () => {
    if (!navigator.onLine) { fijar({ online: false }); return }
    fijar({ sincronizando: true, online: true })
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Sesión vencida. Ingresá de nuevo desde Ajustes.')
      const subir: TablaSync[] = rolActual === 'admin' ? TABLAS_SYNC : ['notas_prop']
      for (const t of subir) await subirTabla(t)
      for (const t of TABLAS_SYNC) await bajarTabla(t)
      if (rolActual === 'admin') {
        const n = await subirFotos()
        if (n > 0) otraVez = true // subir la metadata de las fotos recién subidas
      }
      await setMeta('ultimo_sync', Date.now())
      fijar({ ultimo: Date.now(), error: undefined })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      fijar({ error: /fetch|network|Failed/i.test(msg) ? 'Sin conexión con el servidor' : msg })
    } finally {
      fijar({ sincronizando: false })
      enCurso = null
      if (otraVez) { otraVez = false; setTimeout(() => { void sincronizar() }, 800) }
    }
  })()
  return enCurso
}

let iniciado = false
export function iniciarSync() {
  if (iniciado || !MODO_NUBE) return
  iniciado = true
  const pronto = debounce(() => { void sincronizar() }, 3000)
  bus.addEventListener('cambio', pronto)
  window.addEventListener('online', () => { fijar({ online: true }); void sincronizar() })
  window.addEventListener('offline', () => fijar({ online: false }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sincronizar() })
  setInterval(() => { if (navigator.onLine) void sincronizar() }, 60_000)
  void getMeta<number | undefined>('ultimo_sync', undefined).then(u => u && fijar({ ultimo: u }))
}

/** Cuenta registros que todavía no llegaron a la nube. */
export async function contarPendientes(): Promise<number> {
  let n = 0
  for (const t of TABLAS_SYNC) n += await db.table(t).where('_dirty').equals(1).count()
  n += (await db.fotos.where('subida').equals(0).toArray()).filter(f => !f.deleted).length
  return n
}

/** Al pasar de modo local a la nube: marcar todo para subir. */
export async function marcarTodoParaSubir() {
  const ts = Date.now()
  for (const t of TABLAS_SYNC) await db.table(t).toCollection().modify({ _dirty: 1, _ts: ts })
}
