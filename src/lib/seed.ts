import { db, type Categoria, type Item, type Lesion } from './db'

const g = (cod: string, nombre: string, nivel: number) => ({ cod, nombre, nivel })

/** Catálogo inicial basado en ICAR Claw Health Atlas. Todo es editable desde Ajustes. */
export const LESIONES_ICAR: Omit<Lesion, 'updated_at'>[] = [
  { id: 'les_dd', codigo: 'DD', nombre: 'Dermatitis digital', zonas: ['PI', 'EI'], orden: 1, activa: true,
    grados: [g('M0', 'M0 · Piel normal', 0), g('M1', 'M1 · Lesión pequeña inicial', 1), g('M2', 'M2 · Úlcera activa', 3),
      g('M3', 'M3 · Cicatrizando (costra)', 1), g('M4', 'M4 · Crónica', 2), g('M4.1', 'M4.1 · Crónica con foco activo', 2)] },
  { id: 'les_id', codigo: 'ID', nombre: 'Dermatitis interdigital', zonas: ['EI', 'PI'], orden: 2, activa: true,
    grados: [g('L', 'Leve · Exudado superficial', 1), g('G', 'Grave · Erosión de piel', 3)] },
  { id: 'les_hhe', codigo: 'HHE', nombre: 'Erosión de talón', zonas: ['6'], orden: 3, activa: true,
    grados: [g('1', '1 · Hoyos', 1), g('2', '2 · Surcos en V', 2), g('3', '3 · Surcos profundos', 3)] },
  { id: 'les_ip', codigo: 'IP', nombre: 'Flemón interdigital', zonas: ['EI'], orden: 4, activa: true,
    grados: [g('1', '1 · Hinchazón', 1), g('2', '2 · Fisura necrótica', 2), g('3', '3 · Complicado (tendón/articulación)', 3)] },
  { id: 'les_ih', codigo: 'IH', nombre: 'Hiperplasia interdigital', zonas: ['EI'], orden: 5, activa: true,
    grados: [g('1', 'Pequeña', 1), g('2', 'Grande, toca el suelo', 2), g('3', 'Infectada', 3)] },
  { id: 'les_su', codigo: 'SU', nombre: 'Úlcera de suela', zonas: ['4', '6'], orden: 6, activa: true,
    grados: [g('1', '1 · Corion expuesto', 1), g('2', '2 · Tejido de granulación', 2), g('3', '3 · Complicada', 3)] },
  { id: 'les_tu', codigo: 'TU', nombre: 'Úlcera de punta', zonas: ['5', '1'], orden: 7, activa: true,
    grados: [g('1', '1 · Corion expuesto', 1), g('2', '2 · Tejido de granulación', 2), g('3', '3 · Complicada', 3)] },
  { id: 'les_tn', codigo: 'TN', nombre: 'Necrosis de punta', zonas: ['5', '1'], orden: 8, activa: true,
    grados: [g('G', 'Grave', 3)] },
  { id: 'les_wl', codigo: 'WL', nombre: 'Enfermedad de línea blanca', zonas: ['1', '2', '3', '7'], orden: 9, activa: true,
    grados: [g('1', '1 · Separación superficial', 1), g('2', '2 · Fisura profunda', 2), g('3', '3 · Absceso que asciende', 3)] },
  { id: 'les_hsc', codigo: 'HSC', nombre: 'Hemorragia de suela circunscripta', zonas: ['4', '5', '1', '2', '3'], orden: 10, activa: true,
    grados: [g('L', 'Leve · Rosada', 1), g('M', 'Moderada · Roja', 2), g('G', 'Grave · Rojo oscuro', 3)] },
  { id: 'les_hsd', codigo: 'HSD', nombre: 'Hemorragia de suela difusa', zonas: ['4', '5', '1', '2', '3'], orden: 11, activa: true,
    grados: [g('L', 'Leve · Rosada', 1), g('M', 'Moderada · Roja', 2), g('G', 'Grave · Rojo oscuro', 3)] },
  { id: 'les_ds', codigo: 'DS', nombre: 'Doble suela', zonas: ['4', '5'], orden: 12, activa: true,
    grados: [g('P', 'Parcial', 1), g('C', 'Completa', 2)] },
  { id: 'les_af', codigo: 'AF', nombre: 'Fisura axial', zonas: ['7'], orden: 13, activa: true,
    grados: [g('1', '1 · Superficial', 1), g('2', '2 · Profunda', 2), g('3', '3 · Llega al corion', 3)] },
  { id: 'les_hf', codigo: 'HF', nombre: 'Fisura horizontal', zonas: ['2', '1', '7'], orden: 14, activa: true,
    grados: [g('1', '1 · Superficial', 1), g('2', '2 · Profunda', 2), g('3', '3 · Llega al corion', 3)] },
  { id: 'les_vf', codigo: 'VF', nombre: 'Fisura vertical', zonas: ['2'], orden: 15, activa: true,
    grados: [g('1', '1 · Superficial', 1), g('2', '2 · Profunda', 2), g('3', '3 · Llega al corion', 3)] },
  { id: 'les_cc', codigo: 'CC', nombre: 'Pezuña en tirabuzón / sobrecrecimiento', zonas: ['1', '5'], orden: 16, activa: true,
    grados: [g('L', 'Leve', 1), g('M', 'Marcado', 2)] },
  { id: 'les_sw', codigo: 'SW', nombre: 'Hinchazón de rodete o talón', zonas: ['6', 'PA'], orden: 17, activa: true,
    grados: [g('P', 'Presente', 2)] }
]

export const CATEGORIAS_INICIALES: Omit<Categoria, 'updated_at'>[] = [
  { id: 'cat_vaquillona', nombre: 'Vaquillona', orden: 1 },
  { id: 'cat_ordene', nombre: 'Vaca en ordeñe', orden: 2 },
  { id: 'cat_seca', nombre: 'Vaca seca', orden: 3 },
  { id: 'cat_preparto', nombre: 'Preparto', orden: 4 }
]

export const ITEM_RECORTE_PREVENTIVO = 'item_recorte_prev'

export const ITEMS_INICIALES: Omit<Item, 'updated_at'>[] = [
  { id: ITEM_RECORTE_PREVENTIVO, tipo: 'servicio', nombre: 'Recorte preventivo', precio: 0, activo: true, orden: 1 },
  { id: 'item_recorte_ter', tipo: 'servicio', nombre: 'Recorte terapéutico', precio: 0, activo: true, orden: 2 },
  { id: 'item_taco_col', tipo: 'servicio', nombre: 'Colocación de taco', precio: 0, activo: true, orden: 3 },
  { id: 'item_vendaje', tipo: 'servicio', nombre: 'Vendaje', precio: 0, activo: true, orden: 4 },
  { id: 'item_curacion', tipo: 'servicio', nombre: 'Curación', precio: 0, activo: true, orden: 5 },
  { id: 'item_inyectable', tipo: 'servicio', nombre: 'Aplicación inyectable', precio: 0, activo: true, orden: 6 },
  { id: 'item_taco', tipo: 'producto', nombre: 'Taco / bloque', unidad: 'u', precio: 0, activo: true, orden: 10 },
  { id: 'item_pegamento', tipo: 'producto', nombre: 'Pegamento para taco', unidad: 'u', precio: 0, activo: true, orden: 11 },
  { id: 'item_venda', tipo: 'producto', nombre: 'Venda', unidad: 'u', precio: 0, activo: true, orden: 12 },
  { id: 'item_salicilico', tipo: 'producto', nombre: 'Ácido salicílico', unidad: 'aplic.', precio: 0, activo: true, orden: 13 },
  { id: 'item_oxitetra', tipo: 'producto', nombre: 'Oxitetraciclina', unidad: 'aplic.', precio: 0, activo: true, orden: 14 },
  { id: 'item_cobre', tipo: 'producto', nombre: 'Sulfato de cobre', unidad: 'aplic.', precio: 0, activo: true, orden: 15 },
  { id: 'item_antibiotico', tipo: 'producto', nombre: 'Antibiótico inyectable', unidad: 'dosis', precio: 0, activo: true, orden: 16 },
  { id: 'item_antiinflam', tipo: 'producto', nombre: 'Antiinflamatorio', unidad: 'dosis', precio: 0, activo: true, orden: 17 },
  { id: 'item_visita', tipo: 'cargo_fijo', nombre: 'Visita / traslado', precio: 0, activo: true, orden: 30 }
]

/** Carga solo lo que falta. Nunca sobrescribe ediciones existentes. */
export async function sembrarCatalogos(marcarParaSubir: boolean) {
  const now = Date.now()
  const flags = marcarParaSubir ? { _dirty: 1, _ts: now } : { _dirty: 0, _ts: now }
  await db.transaction('rw', db.lesiones, db.categorias, db.items, async () => {
    for (const l of LESIONES_ICAR) if (!(await db.lesiones.get(l.id))) await db.lesiones.put({ ...l, ...flags })
    for (const c of CATEGORIAS_INICIALES) if (!(await db.categorias.get(c.id))) await db.categorias.put({ ...c, ...flags })
    for (const i of ITEMS_INICIALES) if (!(await db.items.get(i.id))) await db.items.put({ ...i, ...flags })
  })
}
