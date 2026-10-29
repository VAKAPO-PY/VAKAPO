import type { PataId, Pezuna, ZonaId } from './db'

export const PATAS: { id: PataId; nombre: string; corto: string; izquierda: boolean }[] = [
  { id: 'MI', nombre: 'Mano izquierda', corto: 'Mano izq.', izquierda: true },
  { id: 'MD', nombre: 'Mano derecha', corto: 'Mano der.', izquierda: false },
  { id: 'TI', nombre: 'Pata izquierda', corto: 'Pata izq.', izquierda: true },
  { id: 'TD', nombre: 'Pata derecha', corto: 'Pata der.', izquierda: false }
]
export const pataNombre = (p: PataId) => PATAS.find(x => x.id === p)?.nombre ?? p
export const pataCorto = (p: PataId) => PATAS.find(x => x.id === p)?.corto ?? p

export const ZONAS: { id: ZonaId; nombre: string; porPezuna: boolean }[] = [
  { id: 'PA', nombre: 'Dedo rudimentario', porPezuna: true },
  { id: 'PI', nombre: 'Piel entre talones', porPezuna: false },
  { id: '1', nombre: 'Línea blanca, punta', porPezuna: true },
  { id: '2', nombre: 'Línea blanca abaxial', porPezuna: true },
  { id: '3', nombre: 'Unión pared–talón', porPezuna: true },
  { id: '4', nombre: 'Unión suela–talón', porPezuna: true },
  { id: '5', nombre: 'Punta de la suela', porPezuna: true },
  { id: '6', nombre: 'Talón / bulbo', porPezuna: true },
  { id: '7', nombre: 'Línea blanca axial', porPezuna: true },
  { id: 'EI', nombre: 'Espacio interdigital', porPezuna: false }
]
export const zonaNombre = (z: ZonaId) => ZONAS.find(x => x.id === z)?.nombre ?? z
export const pezunaNombre = (p: Pezuna | null) => (p === 'L' ? 'Lateral' : p === 'M' ? 'Medial' : '')

/**
 * Posición de cada zona en el diagrama (vista caudal-plantar), para la pezuña dibujada a la IZQUIERDA.
 * La pezuña de la derecha es el espejo: x' = 480 - x.
 */
export const POS_ZONA: Record<ZonaId, [number, number]> = {
  PA: [120, 72],
  PI: [240, 128],
  EI: [240, 300],
  '1': [196, 478],
  '2': [108, 330],
  '3': [116, 232],
  '4': [194, 262],
  '5': [176, 420],
  '6': [162, 184],
  '7': [212, 372]
}

/** En patas izquierdas la lateral queda a la izquierda del dibujo; en las derechas, a la derecha. */
export function ladoDe(pata: PataId, pezuna: Pezuna): 'izq' | 'der' {
  const izquierda = pata === 'MI' || pata === 'TI'
  if (izquierda) return pezuna === 'L' ? 'izq' : 'der'
  return pezuna === 'L' ? 'der' : 'izq'
}
export function pezunaEnLado(pata: PataId, lado: 'izq' | 'der'): Pezuna {
  return ladoDe(pata, 'L') === lado ? 'L' : 'M'
}

export function posicion(zona: ZonaId, lado: 'izq' | 'der' | null): [number, number] {
  const [x, y] = POS_ZONA[zona]
  if (!lado || lado === 'izq') return [x, y]
  return [480 - x, y]
}

export const COLOR_NIVEL = ['#16a34a', '#eab308', '#f97316', '#dc2626']
export const NIVEL_NOMBRE = ['Normal', 'Leve', 'Moderado', 'Grave']
