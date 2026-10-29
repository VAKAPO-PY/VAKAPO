import Dexie, { type Table } from 'dexie'

/* ───────── Tipos ───────── */
export type Rol = 'admin' | 'propietario'
export type PataId = 'MI' | 'MD' | 'TI' | 'TD'
export type Pezuna = 'L' | 'M'
export type ZonaId = 'PA' | 'PI' | 'EI' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
export type ItemTipo = 'servicio' | 'producto' | 'cargo_fijo'
export type NotaTipo = 'aviso' | 'informe' | 'observacion'

/** Campos comunes. _dirty/_ts son solo locales (no se suben). */
export interface Base {
  id: string
  updated_at?: string
  deleted?: boolean
  _dirty?: number
  _ts?: number
}

export interface Tambo extends Base { nombre: string; ubicacion?: string; notas?: string }
export interface Lote extends Base { tambo_id: string; nombre: string }
export interface Categoria extends Base { nombre: string; orden: number }
export interface Vaca extends Base {
  tambo_id: string; numero: string; lote_id?: string | null; categoria_id?: string | null; notas?: string; activa: boolean
}
export interface Grado { cod: string; nombre: string; nivel: number }
export interface Lesion extends Base {
  codigo: string; nombre: string; zonas: ZonaId[]; grados: Grado[]; orden: number; activa: boolean
}
export interface Item extends Base {
  tipo: ItemTipo; nombre: string; unidad?: string; precio: number; activo: boolean; orden: number
}
export interface Tarifa extends Base { tambo_id: string; item_id: string; precio: number }
export interface Jornada extends Base {
  tambo_id: string; fecha: string; estado: 'abierta' | 'cerrada'; notas?: string; operador?: string
}
export interface Examen extends Base {
  tambo_id: string; jornada_id: string; vaca_id: string; fecha: string
  preventivo?: boolean; revision_fecha?: string | null; revision_ok?: boolean; notas?: string; operador?: string
}
export interface Hallazgo extends Base {
  tambo_id: string; examen_id: string; vaca_id: string; fecha: string
  pata: PataId; pezuna: Pezuna | null; zona: ZonaId
  lesion_id: string; codigo: string; grado: string; nivel: number; notas?: string
}
export interface Cargo extends Base {
  tambo_id: string; jornada_id: string; examen_id?: string | null; vaca_id?: string | null
  item_id: string; tipo: ItemTipo; descripcion: string; cantidad: number; precio_unit: number; fecha: string
}
export interface Receta extends Base {
  tambo_id: string; examen_id: string; vaca_id: string; fecha: string
  veterinario?: string; medicamento: string; dosis?: string; via?: string; duracion?: string; indicaciones?: string
}
export interface Foto extends Base {
  tambo_id: string; vaca_id: string; examen_id?: string | null; hallazgo_id?: string | null
  fecha: string; path?: string | null; subida: number
}
export interface NotaProp extends Base {
  tambo_id: string; vaca_id?: string | null; autor_id: string; autor_nombre?: string
  tipo: NotaTipo; texto: string; fecha: string
}
export interface Miembro extends Base { tambo_id: string; user_id: string }
export interface Perfil extends Base { nombre?: string; email?: string; rol: Rol }

/** Solo local: imágenes. full se borra cuando la foto ya está en la nube. */
export interface BlobRow { id: string; full?: Blob | null; thumb: Blob }
export interface Meta { key: string; value: unknown }

/* ───────── Tablas sincronizadas y sus columnas en el servidor ───────── */
export const COLUMNAS = {
  tambos: ['nombre', 'ubicacion', 'notas'],
  lotes: ['tambo_id', 'nombre'],
  categorias: ['nombre', 'orden'],
  vacas: ['tambo_id', 'numero', 'lote_id', 'categoria_id', 'notas', 'activa'],
  lesiones: ['codigo', 'nombre', 'zonas', 'grados', 'orden', 'activa'],
  items: ['tipo', 'nombre', 'unidad', 'precio', 'activo', 'orden'],
  tarifas: ['tambo_id', 'item_id', 'precio'],
  jornadas: ['tambo_id', 'fecha', 'estado', 'notas', 'operador'],
  examenes: ['tambo_id', 'jornada_id', 'vaca_id', 'fecha', 'preventivo', 'revision_fecha', 'revision_ok', 'notas', 'operador'],
  hallazgos: ['tambo_id', 'examen_id', 'vaca_id', 'fecha', 'pata', 'pezuna', 'zona', 'lesion_id', 'codigo', 'grado', 'nivel', 'notas'],
  cargos: ['tambo_id', 'jornada_id', 'examen_id', 'vaca_id', 'item_id', 'tipo', 'descripcion', 'cantidad', 'precio_unit', 'fecha'],
  recetas: ['tambo_id', 'examen_id', 'vaca_id', 'fecha', 'veterinario', 'medicamento', 'dosis', 'via', 'duracion', 'indicaciones'],
  fotos: ['tambo_id', 'vaca_id', 'examen_id', 'hallazgo_id', 'fecha', 'path', 'subida'],
  notas_prop: ['tambo_id', 'vaca_id', 'autor_id', 'autor_nombre', 'tipo', 'texto', 'fecha'],
  miembros: ['tambo_id', 'user_id'],
  perfiles: ['nombre', 'email', 'rol']
} as const

export type TablaSync = keyof typeof COLUMNAS
export const TABLAS_SYNC = Object.keys(COLUMNAS) as TablaSync[]

class VakapoDB extends Dexie {
  tambos!: Table<Tambo, string>
  lotes!: Table<Lote, string>
  categorias!: Table<Categoria, string>
  vacas!: Table<Vaca, string>
  lesiones!: Table<Lesion, string>
  items!: Table<Item, string>
  tarifas!: Table<Tarifa, string>
  jornadas!: Table<Jornada, string>
  examenes!: Table<Examen, string>
  hallazgos!: Table<Hallazgo, string>
  cargos!: Table<Cargo, string>
  recetas!: Table<Receta, string>
  fotos!: Table<Foto, string>
  notas_prop!: Table<NotaProp, string>
  miembros!: Table<Miembro, string>
  perfiles!: Table<Perfil, string>
  blobs!: Table<BlobRow, string>
  meta!: Table<Meta, string>

  constructor() {
    super('vakapo')
    this.version(1).stores({
      tambos: 'id, _dirty',
      lotes: 'id, tambo_id, _dirty',
      categorias: 'id, _dirty',
      vacas: 'id, tambo_id, [tambo_id+numero], _dirty',
      lesiones: 'id, _dirty',
      items: 'id, _dirty',
      tarifas: 'id, tambo_id, _dirty',
      jornadas: 'id, tambo_id, fecha, _dirty',
      examenes: 'id, tambo_id, jornada_id, vaca_id, fecha, _dirty',
      hallazgos: 'id, tambo_id, examen_id, vaca_id, fecha, _dirty',
      cargos: 'id, tambo_id, jornada_id, examen_id, vaca_id, _dirty',
      recetas: 'id, tambo_id, examen_id, vaca_id, _dirty',
      fotos: 'id, tambo_id, vaca_id, examen_id, hallazgo_id, subida, _dirty',
      notas_prop: 'id, tambo_id, vaca_id, _dirty',
      miembros: 'id, tambo_id, user_id, _dirty',
      perfiles: 'id, _dirty',
      blobs: 'id',
      meta: 'key'
    })
  }
}

export const db = new VakapoDB()

/** Filtra registros borrados (borrado lógico). */
export const vivos = <T extends Base>(rows: T[]) => rows.filter(r => !r.deleted)

export async function getMeta<T>(key: string, def: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T) ?? def
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
