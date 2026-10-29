import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vivos, type Hallazgo, type Item } from '../lib/db'
import { actualizar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { agregarCargo, buscarVaca, crearVaca, subtotal } from '../lib/acciones'
import { fechaCorta, gs, horaCorta, ordenNumero, vibrar } from '../lib/util'
import { Hoja, TopBar, Seccion, Vacio, toast } from '../components/ui'
import { ElegirItem, ListaCargos, Chips } from '../components/Selectores'
import { Icono } from '../components/Icono'

export function JornadaPage({ tid, jid }: { tid: string; jid: string }) {
  const { esAdmin } = useAuth()
  const [numero, setNumero] = useState('')
  const [crear, setCrear] = useState<string | null>(null)
  const [agregar, setAgregar] = useState(false)
  const [exportando, setExportando] = useState(false)

  const d = useLiveQuery(async () => {
    const [t, j] = await Promise.all([db.tambos.get(tid), db.jornadas.get(jid)])
    const exs = vivos(await db.examenes.where('jornada_id').equals(jid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const cargos = vivos(await db.cargos.where('jornada_id').equals(jid).toArray())
    const hs = vivos(await db.hallazgos.where('tambo_id').equals(tid).toArray()).filter(h => exs.some(e => e.id === h.examen_id))
    const vacas = vivos(await db.vacas.where('tambo_id').equals(tid).toArray())
    return { t, j, exs, cargos, hs, vacas, vacaMap: new Map(vacas.map(v => [v.id, v])) }
  }, [tid, jid])

  if (!d) return null
  if (!d.j || !d.t) return <div className="app"><TopBar titulo="Jornada" atras={`/t/${tid}`} /><main className="page"><Vacio>Jornada no encontrada.</Vacio></main></div>
  const j = d.j
  const abierta = j.estado === 'abierta' && esAdmin
  const total = subtotal(d.cargos)
  const cargosJornada = d.cargos.filter(c => !c.examen_id)
  const sugerencias = numero ? d.vacas.filter(v => v.numero.startsWith(numero) && v.numero !== numero).sort((a, b) => ordenNumero(a.numero, b.numero)).slice(0, 6) : []

  async function irAVaca(n: string) {
    const v = await buscarVaca(tid, n)
    if (v) { setNumero(''); ir(`/t/${tid}/j/${jid}/v/${v.id}`) }
    else setCrear(n)
  }
  const tecla = (k: string) => {
    vibrar(8)
    if (k === '⌫') setNumero(n => n.slice(0, -1))
    else if (k === 'ok') { if (numero) void irAVaca(numero) }
    else setNumero(n => (n.length < 10 ? n + k : n))
  }
  const tagsDe = (hs: Hallazgo[]) => {
    const m = new Map<string, number>()
    for (const h of hs) if (h.nivel > 0) m.set(h.codigo, Math.max(m.get(h.codigo) ?? 0, h.nivel))
    return [...m.entries()]
  }

  async function exportar(tipo: 'pdf' | 'xlsx') {
    setExportando(true)
    try {
      const m = await import('../lib/exportar')
      if (tipo === 'pdf') await m.cuentaJornadaPDF(jid)
      else await m.cuentaJornadaExcel(jid)
    } catch (e) { console.error(e); toast('No se pudo exportar') } finally { setExportando(false) }
  }

  return (
    <div className="app">
      <TopBar titulo={`Jornada ${fechaCorta(j.fecha)}`} sub={`${d.t.nombre} · ${d.exs.length} vacas · ${gs(total)}`} atras={`/t/${tid}`} />
      <main className="page">
        {j.estado === 'cerrada' && <div className="aviso info"><Icono n="candado" /> Jornada cerrada.{esAdmin && ' Podés reabrirla abajo.'}</div>}

        {abierta && (
          <section className="stack">
            <div className="display-num" aria-live="polite">{numero || <span className="ph">N° de vaca</span>}</div>
            {sugerencias.length > 0 && (
              <div className="chips scroll">
                {sugerencias.map(v => <button key={v.id} className="chip" onClick={() => { setNumero(''); ir(`/t/${tid}/j/${jid}/v/${v.id}`) }}>{v.numero}</button>)}
              </div>
            )}
            <div className="numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'ok'].map(k => (
                <button key={k} className={k === 'ok' ? 'ok' : ''} onClick={() => tecla(k)} aria-label={k === '⌫' ? 'Borrar' : k === 'ok' ? 'Ir a la vaca' : k}>
                  {k === 'ok' ? 'IR' : k}
                </button>
              ))}
            </div>
          </section>
        )}

        <Seccion titulo={`Vacas de esta jornada (${d.exs.length})`} flat>
          {d.exs.length === 0 && <Vacio>Todavía no hay vacas. Escribí el número y tocá IR.</Vacio>}
          <div className="lista">
            {d.exs.map(e => {
              const v = d.vacaMap.get(e.vaca_id)
              const tags = tagsDe(d.hs.filter(h => h.examen_id === e.id))
              const st = subtotal(d.cargos.filter(c => c.examen_id === e.id))
              return (
                <button key={e.id} className="row" onClick={() => ir(`/t/${tid}/j/${jid}/v/${e.vaca_id}`)}>
                  <span className="num">{v?.numero ?? '?'}</span>
                  <div className="main">
                    <div className="hstack" style={{ gap: 4 }}>
                      {e.preventivo && <span className="tag n0">Preventivo</span>}
                      {tags.map(([c, n]) => <span key={c} className={'tag n' + n}>{c}</span>)}
                      {!e.preventivo && !tags.length && <span className="tag">Sin lesión</span>}
                      {e.revision_fecha && <span className="tag"><Icono n="reloj" size={13} /> {fechaCorta(e.revision_fecha)}</span>}
                    </div>
                    <small>{horaCorta(e.fecha)}</small>
                  </div>
                  <span className="der small">{gs(st)}</span>
                </button>
              )
            })}
          </div>
        </Seccion>

        <Seccion titulo="Cargos de la jornada" accion={abierta && <button className="btn sm" onClick={() => setAgregar(true)}><Icono n="mas" /> Agregar</button>}>
          <ListaCargos cargos={cargosJornada} editable={abierta} />
          <div className="sec-head" style={{ marginTop: 12, marginBottom: 0 }}><b>Total jornada</b><b style={{ fontSize: '1.2rem' }}>{gs(total)}</b></div>
        </Seccion>

        <div className="fila-btns">
          <button className="btn" disabled={exportando} onClick={() => exportar('pdf')}><Icono n="descargar" /> Cuenta PDF</button>
          <button className="btn" disabled={exportando} onClick={() => exportar('xlsx')}><Icono n="descargar" /> Excel</button>
        </div>
        {esAdmin && (j.estado === 'abierta'
          ? <button className="btn block" onClick={async () => { if (confirm('¿Cerrar la jornada?')) { await actualizar('jornadas', jid, { estado: 'cerrada' }); toast('Jornada cerrada'); ir(`/t/${tid}`) } }}><Icono n="candado" /> Cerrar jornada</button>
          : <button className="btn block" onClick={() => actualizar('jornadas', jid, { estado: 'abierta' })}>Reabrir jornada</button>)}
      </main>

      {crear && <CrearVaca tid={tid} numero={crear} onCerrar={() => setCrear(null)} onCreada={id => { setCrear(null); setNumero(''); ir(`/t/${tid}/j/${jid}/v/${id}`) }} />}
      {agregar && (
        <ElegirItem tambo_id={tid} tipos={['cargo_fijo', 'servicio', 'producto']} titulo="Cargo de la jornada" onCerrar={() => setAgregar(false)}
          onElegir={async (i: Item) => { await agregarCargo({ tambo_id: tid, jornada_id: jid, fecha: j.fecha }, i); toast(`${i.nombre} agregado`); setAgregar(false) }} />
      )}
    </div>
  )
}

export function CrearVaca({ tid, numero, onCerrar, onCreada }: { tid: string; numero: string; onCerrar: () => void; onCreada: (id: string) => void }) {
  const [n, setN] = useState(numero)
  const [lote, setLote] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const lotes = useLiveQuery(async () => vivos(await db.lotes.where('tambo_id').equals(tid).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [tid], [])
  const cats = useLiveQuery(async () => vivos(await db.categorias.toArray()).sort((a, b) => a.orden - b.orden), [], [])
  return (
    <Hoja titulo={numero ? `Vaca N° ${numero} es nueva` : 'Nueva vaca'} onCerrar={onCerrar}>
      <label className="campo">Número<input className="input" inputMode="numeric" value={n} onChange={e => setN(e.target.value)} /></label>
      <div className="stack">
        <b>Lote de ordeñe</b>
        {lotes.length ? <Chips opciones={[{ v: null, t: 'Sin lote' }, ...lotes.map(l => ({ v: l.id as string | null, t: l.nombre }))]} valor={lote} onCambio={setLote} />
          : <span className="muted small">No hay lotes. Se crean en Configuración del tambo.</span>}
      </div>
      <div className="stack">
        <b>Categoría</b>
        <Chips opciones={[{ v: null, t: 'Sin categoría' }, ...cats.map(c => ({ v: c.id as string | null, t: c.nombre }))]} valor={cat} onCambio={setCat} />
      </div>
      <button className="btn pri lg block" disabled={!n.trim()} onClick={async () => {
        const existe = await buscarVaca(tid, n)
        if (existe) { onCreada(existe.id); return }
        const v = await crearVaca(tid, n, { lote_id: lote, categoria_id: cat })
        toast(`Vaca ${v.numero} creada`)
        onCreada(v.id)
      }}>Crear y continuar</button>
    </Hoja>
  )
}
