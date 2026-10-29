import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Hallazgo, type Lesion, type PataId, type Pezuna, type ZonaId } from '../lib/db'
import { borrar, guardar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { asegurarExamen, idExamen } from '../lib/acciones'
import { PATAS, pataNombre, pezunaNombre, zonaNombre, ZONAS } from '../lib/anatomia'
import { uid, vibrar } from '../lib/util'
import { Diagrama, claveZona } from '../components/Diagrama'
import { Hoja, Seccion, TopBar, toast } from '../components/ui'
import { BotonCamara, GaleriaFotos } from '../components/Fotos'
import { Icono } from '../components/Icono'

export function PataPage({ tid, jid, vid, pata }: { tid: string; jid: string; vid: string; pata: PataId }) {
  const { esAdmin } = useAuth()
  const [zona, setZona] = useState<{ z: ZonaId; p: Pezuna | null } | null>(null)
  const eid = idExamen(jid, vid)
  const d = useLiveQuery(async () => {
    const [v, j] = await Promise.all([db.vacas.get(vid), db.jornadas.get(jid)])
    const hs = vivos(await db.hallazgos.where('examen_id').equals(eid).toArray())
    const fotos = vivos(await db.fotos.where('examen_id').equals(eid).toArray())
    const lesiones = vivos(await db.lesiones.toArray()).filter(l => l.activa !== false).sort((a, b) => a.orden - b.orden)
    return { v, j, hs, fotos, lesiones }
  }, [vid, jid, eid])
  if (!d?.v || !d.j) return null
  const editable = esAdmin && d.j.estado === 'abierta'
  const hsPata = d.hs.filter(h => h.pata === pata)
  const marcas: Record<string, { nivel: number; n: number }> = {}
  for (const h of hsPata) {
    const k = claveZona(h.zona, h.pezuna)
    const m = marcas[k] ?? { nivel: -1, n: 0 }
    marcas[k] = { nivel: Math.max(m.nivel, h.nivel), n: m.n + 1 }
  }
  const atras = `/t/${tid}/j/${jid}/v/${vid}`
  const orden = (h: Hallazgo) => ZONAS.findIndex(z => z.id === h.zona) * 2 + (h.pezuna === 'M' ? 1 : 0)

  return (
    <div className="app">
      <TopBar titulo={`Vaca ${d.v.numero} · ${pataNombre(pata)}`} sub="Tocá una zona para registrar" atras={atras} />
      <main className="page sin-nav" style={{ gap: 10 }}>
        <div className="chips scroll">
          {PATAS.map(p => {
            const n = d.hs.filter(h => h.pata === p.id).length
            return (
              <button key={p.id} className={'chip' + (p.id === pata ? ' on' : '')} onClick={() => ir(`/t/${tid}/j/${jid}/v/${vid}/p/${p.id}`, true)}>
                {p.corto}{n ? ` (${n})` : ''}
              </button>
            )
          })}
        </div>

        <div className="diagrama">
          <Diagrama pata={pata} marcas={marcas} seleccion={zona ? claveZona(zona.z, zona.p) : null}
            onZona={(z, p) => { vibrar(10); setZona({ z, p }) }} />
        </div>

        <Seccion titulo={`Registros en ${pataNombre(pata).toLowerCase()} (${hsPata.length})`}>
          {hsPata.length === 0 && <p className="muted small" style={{ margin: 0 }}>Sin lesiones registradas en esta pata.</p>}
          <div className="stack">
            {hsPata.sort((a, b) => orden(a) - orden(b)).map(h => (
              <FilaHallazgo key={h.id} h={h} lesion={d.lesiones.find(l => l.id === h.lesion_id)} editable={editable}
                fotos={d.fotos.filter(f => f.hallazgo_id === h.id)} />
            ))}
          </div>
        </Seccion>
      </main>

      <div className="accion-fija"><div className="inner">
        <button className="btn pri lg grow" onClick={() => ir(atras)}><Icono n="check" /> Listo, volver a la vaca</button>
      </div></div>

      {zona && (
        <HojaZona zona={zona.z} pezuna={zona.p} pata={pata} lesiones={d.lesiones} editable={editable}
          existentes={hsPata.filter(h => h.zona === zona.z && h.pezuna === zona.p)} fotos={d.fotos}
          onCerrar={() => setZona(null)}
          onRegistrar={async (l, g) => {
            const ex = await asegurarExamen(d.j!, vid)
            await guardar<Hallazgo>('hallazgos', {
              id: uid(), tambo_id: tid, examen_id: ex.id, vaca_id: vid, fecha: ex.fecha, pata, pezuna: zona.p, zona: zona.z,
              lesion_id: l.id, codigo: l.codigo, grado: g.cod, nivel: g.nivel, notas: ''
            })
            vibrar(25)
            toast(`${l.codigo} ${g.cod} registrado`)
            setZona(null)
          }} />
      )}
    </div>
  )
}

function FilaHallazgo({ h, lesion, editable, fotos }: { h: Hallazgo; lesion?: Lesion; editable: boolean; fotos: import('../lib/db').Foto[] }) {
  const grado = lesion?.grados.find(g => g.cod === h.grado)
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="hstack" style={{ flexWrap: 'nowrap' }}>
        <span className={'tag n' + h.nivel} style={{ fontSize: '1rem', padding: '6px 10px' }}>{h.codigo} {h.grado}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <b style={{ display: 'block' }}>{lesion?.nombre ?? h.codigo}</b>
          <small className="muted">{grado?.nombre ?? h.grado} · Zona {h.zona}{h.pezuna ? ` · ${pezunaNombre(h.pezuna)}` : ''}</small>
        </div>
        {editable && <BotonCamara clase="btn sm" texto="" destino={{ tambo_id: h.tambo_id, vaca_id: h.vaca_id, examen_id: h.examen_id, hallazgo_id: h.id }} />}
        {editable && <button className="btn sm danger" aria-label="Borrar" onClick={() => confirm(`¿Borrar ${h.codigo} ${h.grado}?`) && borrar('hallazgos', h.id)}><Icono n="basura" /></button>}
      </div>
      {fotos.length > 0 && <div style={{ marginTop: 8 }}><GaleriaFotos fotos={fotos} puedeBorrar={editable} /></div>}
    </div>
  )
}

function HojaZona({ zona, pezuna, pata, lesiones, existentes, fotos, editable, onCerrar, onRegistrar }: {
  zona: ZonaId; pezuna: Pezuna | null; pata: PataId; lesiones: Lesion[]; existentes: Hallazgo[]; fotos: import('../lib/db').Foto[]
  editable: boolean; onCerrar: () => void; onRegistrar: (l: Lesion, g: Lesion['grados'][number]) => void
}) {
  const [lesion, setLesion] = useState<Lesion | null>(null)
  const [todas, setTodas] = useState(false)
  const posibles = lesiones.filter(l => todas || l.zonas.includes(zona))
  const titulo = `${zona.length === 1 ? 'Zona ' + zona : zonaNombre(zona)}${pezuna ? ' · ' + pezunaNombre(pezuna) : ''}`
  return (
    <Hoja titulo={lesion ? `${lesion.codigo} · ${lesion.nombre}` : titulo} onCerrar={onCerrar}>
      {!lesion && (
        <>
          <p className="muted" style={{ margin: 0 }}>{zonaNombre(zona)} — {pataNombre(pata)}</p>
          {existentes.length > 0 && (
            <div className="stack">
              {existentes.map(h => (
                <FilaHallazgo key={h.id} h={h} lesion={lesiones.find(l => l.id === h.lesion_id)} editable={editable} fotos={fotos.filter(f => f.hallazgo_id === h.id)} />
              ))}
            </div>
          )}
          {editable && (
            <>
              <h3>{existentes.length ? 'Agregar otra lesión' : 'Elegí la lesión'}</h3>
              <div className="grid-lesiones">
                {posibles.map(l => (
                  <button key={l.id} className="les-btn" onClick={() => setLesion(l)}>
                    <b>{l.codigo}</b><span>{l.nombre}</span>
                  </button>
                ))}
              </div>
              <button className="btn ghost" onClick={() => setTodas(!todas)}>{todas ? 'Ver solo las de esta zona' : 'Ver todas las lesiones'}</button>
            </>
          )}
        </>
      )}
      {lesion && (
        <>
          <p className="muted" style={{ margin: 0 }}>{titulo} · {pataNombre(pata)} — elegí la gravedad</p>
          <div className="stack">
            {lesion.grados.map(g => (
              <button key={g.cod} className={'grado-btn n' + Math.max(0, Math.min(3, g.nivel))} onClick={() => onRegistrar(lesion, g)}>
                <span className="dot" style={{ background: ['#16a34a', '#eab308', '#f97316', '#dc2626'][Math.max(0, Math.min(3, g.nivel))] }} />
                {g.nombre}
              </button>
            ))}
          </div>
          <button className="btn block" onClick={() => setLesion(null)}><Icono n="atras" /> Otra lesión</button>
        </>
      )}
    </Hoja>
  )
}
