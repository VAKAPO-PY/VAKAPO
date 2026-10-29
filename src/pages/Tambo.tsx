import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos } from '../lib/db'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { abrirJornadaDeHoy } from '../lib/acciones'
import { calcularAlertas } from '../lib/alertas'
import { fechaCorta, hoy } from '../lib/util'
import { BottomNav, TopBar, Vacio } from '../components/ui'
import { Icono } from '../components/Icono'

export function TamboPage({ tid }: { tid: string }) {
  const { esAdmin } = useAuth()
  const d = useLiveQuery(async () => {
    const t = await db.tambos.get(tid)
    const vacas = vivos(await db.vacas.where('tambo_id').equals(tid).toArray())
    const js = vivos(await db.jornadas.where('tambo_id').equals(tid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const notas = vivos(await db.notas_prop.where('tambo_id').equals(tid).toArray())
    const al = esAdmin ? await calcularAlertas(tid) : null
    return { t, vacas: vacas.filter(v => v.activa !== false).length, js, notas, al }
  }, [tid, esAdmin])

  if (!d) return null
  if (!d.t || d.t.deleted) return <div className="app"><TopBar titulo="Tambo" atras="/" /><main className="page"><Vacio>Este tambo no existe o fue borrado.</Vacio></main></div>
  const hoyJ = d.js.find(j => j.fecha === hoy())
  const vencidas = d.al?.revisiones.filter(r => r.dias <= 0).length ?? 0
  const recurrentes = d.al?.recurrentes.length ?? 0

  const menu = [
    { n: 'lista', t: 'Vacas', s: `${d.vacas} vacas activas`, p: `/t/${tid}/vacas` },
    { n: 'calendario', t: 'Jornadas', s: d.js.length ? `${d.js.length} · última ${fechaCorta(d.js[0].fecha)}` : 'Sin jornadas', p: `/t/${tid}/jornadas` },
    { n: 'nota', t: esAdmin ? 'Avisos del propietario' : 'Mis notas y avisos', s: `${d.notas.length} notas`, p: `/t/${tid}/notas` },
    { n: 'grafico', t: 'Reportes', s: 'Prevalencia, mapa de calor, costos', p: `/reportes/${tid}` },
    ...(esAdmin ? [{ n: 'ajustes', t: 'Configuración del tambo', s: 'Lotes, precios, acceso de usuarios', p: `/t/${tid}/config` }] : [])
  ]

  return (
    <div className="app">
      <TopBar titulo={d.t.nombre} sub={d.t.ubicacion} atras="/" />
      <main className="page">
        {esAdmin && (
          <button className="btn pri lg block" style={{ minHeight: 84 }} onClick={async () => {
            const j = await abrirJornadaDeHoy(tid)
            ir(`/t/${tid}/j/${j.id}`)
          }}>
            <Icono n="pezuna" size={30} />
            <span>{hoyJ ? 'Continuar jornada de hoy' : 'Iniciar jornada de hoy'}<span className="sub">{fechaCorta(hoy())}</span></span>
          </button>
        )}
        {esAdmin && (vencidas > 0 || recurrentes > 0) && (
          <button className="aviso danger" style={{ border: 0, textAlign: 'left' }} onClick={() => ir(`/alertas?t=${tid}`)}>
            <Icono n="alerta" />
            <span>{[vencidas && `${vencidas} revisión${vencidas > 1 ? 'es' : ''} vencida${vencidas > 1 ? 's' : ''}`, recurrentes && `${recurrentes} vaca${recurrentes > 1 ? 's' : ''} recurrente${recurrentes > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</span>
          </button>
        )}
        <section className="card flat lista">
          {menu.map(m => (
            <button key={m.p} className="row" onClick={() => ir(m.p)}>
              <Icono n={m.n} size={28} />
              <div className="main"><b>{m.t}</b><small>{m.s}</small></div>
              <Icono n="sig" />
            </button>
          ))}
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
