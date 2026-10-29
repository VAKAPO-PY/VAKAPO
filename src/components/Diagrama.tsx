import { forwardRef } from 'react'
import type { PataId, Pezuna, ZonaId } from '../lib/db'
import { COLOR_NIVEL, ZONAS, pezunaEnLado, posicion, pezunaNombre } from '../lib/anatomia'

export const claveZona = (zona: ZonaId, pezuna: Pezuna | null) => `${zona}|${pezuna ?? ''}`

interface Props {
  pata?: PataId
  /** Modo registro: nivel máximo y cantidad de hallazgos por zona */
  marcas?: Record<string, { nivel: number; n: number }>
  /** Modo mapa de calor: cantidad por zona */
  calor?: Record<string, number>
  onZona?: (zona: ZonaId, pezuna: Pezuna | null) => void
  seleccion?: string | null
}

const PEZUNA = 'M226 150 C185 132 112 140 100 205 C88 290 112 400 178 492 C194 512 222 512 228 490 C234 430 234 220 226 150 Z'
const LINEA_BLANCA = 'M108 222 C100 300 116 398 178 484 C192 500 214 500 222 484 C228 420 228 300 224 222'
const SUELA = 'M222 228 C200 240 150 240 114 230 C108 300 124 392 180 474 C194 490 214 490 220 474 C226 410 226 300 222 228 Z'
const TALON = 'M222 156 C185 140 118 150 108 205 C145 228 195 228 224 214 Z'

function colorCalor(t: number): string {
  // de verde muy claro a rojo
  const a = [236, 244, 232], b = [220, 38, 38], m = [249, 115, 22]
  const mix = (x: number[], y: number[], k: number) => x.map((v, i) => Math.round(v + (y[i] - v) * k))
  const c = t < 0.5 ? mix(a, m, t * 2) : mix(m, b, (t - 0.5) * 2)
  return `rgb(${c.join(',')})`
}

/** Vista caudal-plantar de una pata: dos pezuñas, dedos rudimentarios y zonas ICAR tocables. */
export const Diagrama = forwardRef<SVGSVGElement, Props>(function Diagrama({ pata = 'TI', marcas, calor, onZona, seleccion }, ref) {
  const maxCalor = calor ? Math.max(1, ...Object.values(calor)) : 1
  const puntos: { zona: ZonaId; pezuna: Pezuna | null; x: number; y: number }[] = []
  for (const z of ZONAS) {
    if (z.porPezuna) {
      for (const lado of ['izq', 'der'] as const) {
        const [x, y] = posicion(z.id, lado)
        puntos.push({ zona: z.id, pezuna: pezunaEnLado(pata, lado), x, y })
      }
    } else {
      const [x, y] = posicion(z.id, null)
      puntos.push({ zona: z.id, pezuna: null, x, y })
    }
  }
  const izq = pezunaEnLado(pata, 'izq')
  const der = pezunaEnLado(pata, 'der')

  return (
    <svg ref={ref} viewBox="58 30 364 530" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Diagrama de pezuña, vista caudal-plantar" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <rect x="58" y="30" width="364" height="530" fill="#ffffff" />
      <path d="M100 118 Q240 88 380 118 L380 168 Q240 148 100 168 Z" fill="#cfae93" />
      <ellipse cx="120" cy="72" rx="34" ry="21" fill="#6e604f" />
      <ellipse cx="360" cy="72" rx="34" ry="21" fill="#6e604f" />
      {[0, 1].map(i => (
        <g key={i} transform={i ? 'translate(480,0) scale(-1,1)' : undefined}>
          <path d={PEZUNA} fill="#8a7a66" />
          <path d={LINEA_BLANCA} fill="none" stroke="#efe6c8" strokeWidth="6" />
          <path d={SUELA} fill="#dccdae" />
          <path d={TALON} fill="#e9d6c2" />
        </g>
      ))}
      {puntos.map(p => {
        const k = claveZona(p.zona, p.pezuna)
        const m = marcas?.[k]
        const c = calor?.[k] ?? 0
        let fill = '#ffffff', stroke = '#334030', texto = '#1f2a1b', etiqueta: string = p.zona
        if (calor) {
          if (c > 0) { fill = colorCalor(c / maxCalor); texto = c / maxCalor > 0.45 ? '#fff' : '#1f2a1b'; etiqueta = String(c) }
          else { fill = '#ffffff'; stroke = '#a3ab9c'; texto = '#7c8775' }
        } else if (m) {
          fill = COLOR_NIVEL[Math.max(0, Math.min(3, m.nivel))]; stroke = '#1f2a1b'; texto = m.nivel === 1 ? '#3b2a00' : '#fff'
        }
        const sel = seleccion === k
        return (
          <g key={k} className={onZona ? 'zona-hit' : undefined} onClick={onZona ? () => onZona(p.zona, p.pezuna) : undefined}
            role={onZona ? 'button' : undefined} aria-label={`Zona ${p.zona} ${pezunaNombre(p.pezuna)}`}>
            {onZona && <circle cx={p.x} cy={p.y} r={27} fill="transparent" />}
            <circle className="vis" cx={p.x} cy={p.y} r={sel ? 23 : 19} fill={fill} stroke={sel ? '#166534' : stroke} strokeWidth={sel ? 5 : 2} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={p.zona.length > 1 ? 14 : 17}
              fontWeight={800} fill={texto} style={{ pointerEvents: 'none' }}>{etiqueta}</text>
            {m && m.n > 1 && !calor && (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={p.x + 16} cy={p.y - 15} r={10} fill="#1f2a1b" />
                <text x={p.x + 16} y={p.y - 14} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#fff">{m.n}</text>
              </g>
            )}
          </g>
        )
      })}
      <text x="165" y="543" textAnchor="middle" fontSize="19" fontWeight={800} fill="#334030">{pezunaNombre(izq)}</text>
      <text x="315" y="543" textAnchor="middle" fontSize="19" fontWeight={800} fill="#334030">{pezunaNombre(der)}</text>
    </svg>
  )
})
