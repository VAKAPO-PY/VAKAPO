import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Tambo } from '../lib/db'
import { guardar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { fechaCorta, hoy, uid } from '../lib/util'
import { BottomNav, Hoja, TopBar, Vacio, toast } from '../components/ui'
import { Icono } from '../components/Icono'
import { calcularAlertas } from '../lib/alertas'

export function Inicio() {
  const { esAdmin, usuario } = useAuth()
  const [nuevo, setNuevo] = useState(false)
  const datos = useLiveQuery(async () => {
    const ts = vivos(await db.tambos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const vacas = vivos(await db.vacas.toArray())
    const js = vivos(await db.jornadas.toArray())
    const al = esAdmin ? await calcularAlertas() : null
    return ts.map(t => {
      const jt = js.filter(j => j.tambo_id === t.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
      return {
        t,
        vacas: vacas.filter(v => v.tambo_id === t.id && v.activa !== false).length,
        ultima: jt[0]?.fecha,
        hoyAbierta: jt.some(j => j.fecha === hoy() && j.estado === 'abierta'),
        alertas: al ? al.revisiones.filter(r => r.dias <= 0 && r.examen.tambo_id === t.id).length + al.recurrentes.filter(r => r.tambo?.id === t.id).length : 0
      }
    })
  }, [esAdmin])

  return (
    <div className="app">
      <TopBar titulo="VAKAPO" sub={usuario ? `Hola, ${usuario.nombre}` : undefined} />
      <main className="page">
        <div className="sec-head" style={{ margin: 0 }}>
          <h2>Tambos</h2>
          {esAdmin && <button className="btn pri sm" onClick={() => setNuevo(true)}><Icono n="mas" /> Nuevo tambo</button>}
        </div>
        {datos && datos.length === 0 && (
          <Vacio>
            {esAdmin ? 'Todavía no hay tambos. Creá el primero con “Nuevo tambo”.' : 'Todavía no tenés acceso a ningún tambo. Pedile al administrador que te lo asigne.'}
          </Vacio>
        )}
        <div className="stack">
          {datos?.map(({ t, vacas, ultima, hoyAbierta, alertas }) => (
            <button key={t.id} className="card row" style={{ borderBottom: '1px solid var(--line)', minHeight: 84 }} onClick={() => ir(`/t/${t.id}`)}>
              <div className="main">
                <b style={{ fontSize: '1.15rem' }}>{t.nombre}</b>
                <small>{[t.ubicacion, `${vacas} vacas`, ultima ? `última jornada ${fechaCorta(ultima)}` : 'sin jornadas'].filter(Boolean).join(' · ')}</small>
                <div className="hstack" style={{ marginTop: 6 }}>
                  {hoyAbierta && <span className="tag n0">Jornada de hoy abierta</span>}
                  {alertas > 0 && <span className="tag n3">{alertas} alerta{alertas > 1 ? 's' : ''}</span>}
                </div>
              </div>
              <Icono n="sig" />
            </button>
          ))}
        </div>
      </main>
      {nuevo && <NuevoTambo onCerrar={() => setNuevo(false)} />}
      <BottomNav />
    </div>
  )
}

function NuevoTambo({ onCerrar }: { onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  return (
    <Hoja titulo="Nuevo tambo" onCerrar={onCerrar}>
      <label className="campo">Nombre del tambo<input className="input" autoFocus value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label className="campo">Ubicación (opcional)<input className="input" value={ubicacion} onChange={e => setUbicacion(e.target.value)} /></label>
      <button className="btn pri lg block" disabled={!nombre.trim()} onClick={async () => {
        const t = await guardar<Tambo>('tambos', { id: uid(), nombre: nombre.trim(), ubicacion: ubicacion.trim(), notas: '' })
        toast('Tambo creado')
        onCerrar()
        ir(`/t/${t.id}`)
      }}>Crear tambo</button>
    </Hoja>
  )
}
