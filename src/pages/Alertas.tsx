import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, vivos } from '../lib/db'
import { calcularAlertas } from '../lib/alertas'
import { actualizar } from '../lib/repo'
import { ir, rutaActual } from '../lib/router'
import { pataCorto } from '../lib/anatomia'
import { fechaCorta } from '../lib/util'
import { BottomNav, Seccion, TopBar, Vacio, toast } from '../components/ui'
import { Chips } from '../components/Selectores'
import { Icono } from '../components/Icono'
import { useState } from 'react'

export function AlertasPage() {
  const inicial = new URLSearchParams(rutaActual().split('?')[1] ?? '').get('t')
  const [tid, setTid] = useState<string | null>(inicial)
  const [futuras, setFuturas] = useState(false)
  const d = useLiveQuery(async () => {
    const tambos = vivos(await db.tambos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const al = await calcularAlertas(tid ?? undefined)
    const umbral = await getMeta('umbral_recurrente', 3)
    const notasVisto = await getMeta<number>('notas_visto', 0)
    const notas = vivos(await db.notas_prop.toArray()).filter(n => Date.parse(n.fecha) > notasVisto && (!tid || n.tambo_id === tid))
    return { tambos, al, umbral, notas }
  }, [tid])
  if (!d) return null
  const vencidas = d.al.revisiones.filter(r => r.dias <= 0)
  const proximas = d.al.revisiones.filter(r => r.dias > 0 && r.dias <= 7)
  const lejanas = d.al.revisiones.filter(r => r.dias > 7)
  const tamboNombre = (id: string) => d.tambos.find(t => t.id === id)?.nombre ?? ''

  const FilaRev = ({ r }: { r: (typeof d.al.revisiones)[number] }) => (
    <div className="row">
      <span className="num">{r.vaca?.numero}</span>
      <button className="main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => ir(`/t/${r.examen.tambo_id}/vaca/${r.examen.vaca_id}`)}>
        <b>{r.dias < 0 ? `Vencida hace ${-r.dias} día${r.dias === -1 ? '' : 's'}` : r.dias === 0 ? 'Hoy' : `En ${r.dias} día${r.dias === 1 ? '' : 's'}`} · {fechaCorta(r.examen.revision_fecha)}</b>
        <small>{!tid && tamboNombre(r.examen.tambo_id) + ' · '}{r.hallazgos.length ? r.hallazgos.map(h => `${h.codigo} ${h.grado} ${pataCorto(h.pata)}`).join(', ') : 'Sin lesiones registradas'}</small>
      </button>
      <button className="btn sm" onClick={async () => { await actualizar('examenes', r.examen.id, { revision_ok: true }); toast('Revisión marcada como hecha') }}><Icono n="check" /> Hecha</button>
    </div>
  )

  return (
    <div className="app">
      <TopBar titulo="Alertas" sub="Solo administradores" />
      <main className="page">
        {d.tambos.length > 1 && <Chips scroll opciones={[{ v: null, t: 'Todos los tambos' }, ...d.tambos.map(t => ({ v: t.id as string | null, t: t.nombre }))]} valor={tid} onCambio={setTid} />}

        {d.notas.length > 0 && (
          <button className="aviso warn" style={{ border: 0, textAlign: 'left' }} onClick={() => ir(`/t/${d.notas[0].tambo_id}/notas`)}>
            <Icono n="nota" /><span>{d.notas.length} nota{d.notas.length > 1 ? 's' : ''} nueva{d.notas.length > 1 ? 's' : ''} de propietarios · ver</span>
          </button>
        )}

        <Seccion titulo={`Revisiones vencidas o de hoy (${vencidas.length})`} flat>
          {vencidas.length === 0 ? <Vacio>Nada vencido.</Vacio> : <div className="lista">{vencidas.map(r => <FilaRev key={r.examen.id} r={r} />)}</div>}
        </Seccion>
        <Seccion titulo={`Próximos 7 días (${proximas.length})`} flat>
          {proximas.length === 0 ? <Vacio>Sin revisiones esta semana.</Vacio> : <div className="lista">{proximas.map(r => <FilaRev key={r.examen.id} r={r} />)}</div>}
        </Seccion>
        {lejanas.length > 0 && (
          <>
            <button className="btn ghost" onClick={() => setFuturas(!futuras)}>{futuras ? 'Ocultar' : 'Ver'} {lejanas.length} {lejanas.length === 1 ? 'revisión programada' : 'revisiones programadas'} más adelante</button>
            {futuras && <Seccion flat><div className="lista">{lejanas.map(r => <FilaRev key={r.examen.id} r={r} />)}</div></Seccion>}
          </>
        )}

        <Seccion titulo={`Vacas recurrentes (${d.al.recurrentes.length})`} flat>
          <p className="muted small" style={{ margin: '0 14px 6px' }}>Misma lesión en {d.umbral} o más exámenes en los últimos 12 meses.</p>
          {d.al.recurrentes.length === 0 ? <Vacio>Ninguna vaca recurrente.</Vacio> : (
            <div className="lista">
              {d.al.recurrentes.map(r => (
                <button key={r.vaca_id + r.codigo} className="row" onClick={() => r.vaca && ir(`/t/${r.vaca.tambo_id}/vaca/${r.vaca_id}`)}>
                  <span className="num">{r.vaca?.numero}</span>
                  <div className="main"><b>{r.codigo} × {r.veces} veces</b><small>{!tid && r.tambo ? r.tambo.nombre + ' · ' : ''}última {fechaCorta(r.ultima)}</small></div>
                  <Icono n="sig" />
                </button>
              ))}
            </div>
          )}
        </Seccion>
      </main>
      <BottomNav />
    </div>
  )
}
