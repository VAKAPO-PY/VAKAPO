import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, vivos, type Item, type Receta } from '../lib/db'
import { actualizar, borrar, guardar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { agregarCargo, asegurarExamen, idExamen, recortePreventivo, subtotal } from '../lib/acciones'
import { PATAS } from '../lib/anatomia'
import { diasEntre, fechaCorta, gs, hoy, sumarDias, uid, vibrar } from '../lib/util'
import { CampoTexto, Hoja, Seccion, TopBar, Vacio, toast } from '../components/ui'
import { ElegirItem, ListaCargos, Chips } from '../components/Selectores'
import { BotonCamara, GaleriaFotos } from '../components/Fotos'
import { Icono } from '../components/Icono'

export function ExamenPage({ tid, jid, vid }: { tid: string; jid: string; vid: string }) {
  const { esAdmin, usuario } = useAuth()
  const [hoja, setHoja] = useState<null | 'items' | 'receta' | 'datos'>(null)
  const eid = idExamen(jid, vid)

  const d = useLiveQuery(async () => {
    const [t, j, v, ex] = await Promise.all([db.tambos.get(tid), db.jornadas.get(jid), db.vacas.get(vid), db.examenes.get(eid)])
    const hs = vivos(await db.hallazgos.where('examen_id').equals(eid).toArray())
    const cargos = vivos(await db.cargos.where('examen_id').equals(eid).toArray())
    const recetas = vivos(await db.recetas.where('examen_id').equals(eid).toArray())
    const fotos = vivos(await db.fotos.where('examen_id').equals(eid).toArray()).filter(f => !f.hallazgo_id)
    const lote = v?.lote_id ? await db.lotes.get(v.lote_id) : undefined
    const cat = v?.categoria_id ? await db.categorias.get(v.categoria_id) : undefined
    const previos = vivos(await db.examenes.where('vaca_id').equals(vid).toArray()).filter(e => e.id !== eid).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const hsVaca = vivos(await db.hallazgos.where('vaca_id').equals(vid).toArray())
    const umbral = await getMeta('umbral_recurrente', 3)
    const desde = sumarDias(hoy(), -365)
    const porCod = new Map<string, Set<string>>()
    for (const h of hsVaca) {
      if (h.nivel <= 0 || hoy(new Date(h.fecha)) < desde) continue
      const s = porCod.get(h.codigo) ?? new Set<string>()
      s.add(h.examen_id)
      porCod.set(h.codigo, s)
    }
    const recurrentes = [...porCod.entries()].filter(([, s]) => s.size >= umbral).map(([c, s]) => `${c} ×${s.size}`)
    const ultimo = previos[0]
    const hsUltimo = ultimo ? hsVaca.filter(h => h.examen_id === ultimo.id && h.nivel > 0) : []
    const revPend = previos.find(e => e.revision_fecha && !e.revision_ok)
    const diasRev = await getMeta('dias_revision', 30)
    return { t, j, v, ex, hs, cargos, recetas, fotos, lote, cat, ultimo, hsUltimo, recurrentes, revPend, diasRev }
  }, [tid, jid, vid, eid])

  if (!d) return null
  if (!d.v || !d.j || !d.t) return <div className="app"><TopBar titulo="Vaca" atras={`/t/${tid}/j/${jid}`} /><main className="page"><Vacio>No encontrada.</Vacio></main></div>
  const { v, j, ex } = d
  const editable = esAdmin && j.estado === 'abierta'
  const asegurar = () => asegurarExamen(j, vid)
  const destinoCargo = async () => { const e = await asegurar(); return { tambo_id: tid, jornada_id: jid, examen_id: e.id, vaca_id: vid, fecha: e.fecha } }

  const resumenPata = (p: string) => {
    const hs = d.hs.filter(h => h.pata === p)
    const max = hs.reduce((m, h) => Math.max(m, h.nivel), -1)
    const cods = [...new Map(hs.filter(h => h.nivel > 0).map(h => [h.codigo, h.nivel])).entries()]
    return { n: hs.length, max, cods }
  }

  const revDias = ex?.revision_fecha ? diasEntre(hoy(new Date(ex.fecha)), ex.revision_fecha) : null
  const opcionesRev = [null, 7, 15, 30, 45]

  return (
    <div className="app">
      <TopBar titulo={`Vaca ${v.numero}`} sub={[d.lote?.nombre, d.cat?.nombre].filter(Boolean).join(' · ') || 'Sin lote ni categoría'} atras={`/t/${tid}/j/${jid}`}
        derecha={<button className="icon-btn" aria-label="Historial" onClick={() => ir(`/t/${tid}/vaca/${vid}`)}><Icono n="reloj" /></button>} />
      <main className="page sin-nav">
        {(d.recurrentes.length > 0 || d.revPend || d.ultimo) && (
          <div className="stack">
            {d.recurrentes.length > 0 && <div className="aviso danger"><Icono n="alerta" /><span>Vaca recurrente: {d.recurrentes.join(', ')} en 12 meses</span></div>}
            {d.revPend && <div className="aviso warn"><Icono n="reloj" /><span>Tenía revisión para el {fechaCorta(d.revPend.revision_fecha)}. Este examen la completa.</span></div>}
            {d.ultimo && (
              <button className="aviso info" style={{ border: 0, textAlign: 'left' }} onClick={() => ir(`/t/${tid}/vaca/${vid}`)}>
                <Icono n="reloj" />
                <span>Último examen {fechaCorta(d.ultimo.fecha)}: {d.hsUltimo.length ? [...new Set(d.hsUltimo.map(h => h.codigo))].join(', ') : d.ultimo.preventivo ? 'preventivo' : 'sin lesión'} · ver historial</span>
              </button>
            )}
          </div>
        )}

        {editable && (
          ex?.preventivo
            ? <div className="aviso ok"><Icono n="check" /> Recorte preventivo registrado</div>
            : d.hs.length === 0 && (
              <button className="btn lg block" style={{ borderColor: 'var(--pri)', color: 'var(--pri)', borderWidth: 2 }} onClick={async () => {
                vibrar(20)
                await recortePreventivo(j, vid)
                toast(`Vaca ${v.numero}: recorte preventivo ✓`)
                ir(`/t/${tid}/j/${jid}`)
              }}>
                <Icono n="check" size={28} /><span>Recorte preventivo sin lesión<span className="sub">guarda y pasa a la siguiente vaca</span></span>
              </button>
            )
        )}

        <section className="stack">
          <h2>Patas</h2>
          <div className="patas">
            {PATAS.map(p => {
              const r = resumenPata(p.id)
              return (
                <button key={p.id} className={'pata-btn' + (r.max > 0 ? ' l' + r.max : '')} onClick={() => ir(`/t/${tid}/j/${jid}/v/${vid}/p/${p.id}`)}>
                  <b>{p.nombre}</b>
                  <div className="tags">{r.cods.map(([c, n]) => <span key={c} className={'tag n' + n}>{c}</span>)}</div>
                  <span className="estado">{r.n ? `${r.n} registro${r.n > 1 ? 's' : ''}` : 'Sin registros'} <Icono n="sig" size={18} /></span>
                </button>
              )
            })}
          </div>
        </section>

        <Seccion titulo="Tratamiento y cobro" accion={editable && <button className="btn sm pri" onClick={() => setHoja('items')}><Icono n="mas" /> Agregar</button>}>
          <ListaCargos cargos={d.cargos} editable={editable} />
          {d.cargos.length > 0 && <div className="sec-head" style={{ marginTop: 10, marginBottom: 0 }}><span className="muted">Subtotal vaca</span><b>{gs(subtotal(d.cargos))}</b></div>}
        </Seccion>

        <Seccion titulo="Revisión">
          {editable ? (
            <div className="stack">
              <Chips scroll valor={revDias === null ? null : opcionesRev.includes(revDias) ? revDias : -1}
                opciones={[{ v: null, t: 'Sin revisión' }, { v: 7, t: '7 días' }, { v: 15, t: '15 días' }, { v: 30, t: '30 días' }, { v: 45, t: '45 días' }, ...(revDias !== null && !opcionesRev.includes(revDias) ? [{ v: -1, t: `${revDias} días` }] : [])] as { v: number | null; t: string }[]}
                onCambio={async val => {
                  const e = await asegurar()
                  if (val === -1) return
                  await actualizar('examenes', e.id, { revision_fecha: val === null ? null : sumarDias(hoy(new Date(e.fecha)), val), revision_ok: false })
                }} />
              <label className="campo">Otra fecha
                <input className="input" type="date" value={ex?.revision_fecha ?? ''} onChange={async e => {
                  const x = await asegurar()
                  await actualizar('examenes', x.id, { revision_fecha: e.target.value || null, revision_ok: false })
                }} />
              </label>
              {ex?.revision_fecha && <span className="muted small">Alerta para el {fechaCorta(ex.revision_fecha)} (solo administradores).</span>}
            </div>
          ) : <span className="muted">{ex?.revision_fecha ? `Revisión: ${fechaCorta(ex.revision_fecha)}` : 'Sin revisión'}</span>}
        </Seccion>

        <Seccion titulo="Receta veterinaria" accion={editable && <button className="btn sm" onClick={() => setHoja('receta')}><Icono n="mas" /> Receta</button>}>
          {d.recetas.length === 0 && <p className="muted small" style={{ margin: 0 }}>Sin recetas.</p>}
          <div className="lista">
            {d.recetas.map(r => (
              <div key={r.id} className="row" style={{ padding: '8px 0' }}>
                <Icono n="receta" />
                <div className="main"><b>{r.medicamento}</b><small>{[r.dosis, r.via, r.duracion, r.veterinario && `Dr/a. ${r.veterinario}`].filter(Boolean).join(' · ')}</small>
                  {r.indicaciones && <small style={{ whiteSpace: 'normal' }}>{r.indicaciones}</small>}</div>
                {editable && <button className="btn sm danger" aria-label="Borrar receta" onClick={() => confirm('¿Borrar receta?') && borrar('recetas', r.id)}><Icono n="basura" /></button>}
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Fotos generales" accion={editable && <BotonCamara clase="btn sm" destino={async () => { const e = await asegurar(); return { tambo_id: tid, vaca_id: vid, examen_id: e.id } }} />}>
          {d.fotos.length ? <GaleriaFotos fotos={d.fotos} puedeBorrar={editable} /> : <p className="muted small" style={{ margin: 0 }}>Las fotos de cada lesión se toman desde la pata.</p>}
        </Seccion>

        <Seccion titulo="Observaciones">
          <CampoTexto multilinea valor={ex?.notas ?? ''} disabled={!editable} placeholder="Notas de esta vaca en esta jornada"
            onGuardar={async val => { const e = await asegurar(); await actualizar('examenes', e.id, { notas: val }) }} />
        </Seccion>

        {esAdmin && <button className="btn ghost" onClick={() => setHoja('datos')}><Icono n="editar" /> Lote, categoría y datos de la vaca</button>}
      </main>

      <div className="accion-fija"><div className="inner">
        <button className="btn pri lg grow" onClick={() => ir(`/t/${tid}/j/${jid}`)}>Siguiente vaca <Icono n="sig" /></button>
      </div></div>

      {hoja === 'items' && (
        <ElegirItem tambo_id={tid} tipos={['servicio', 'producto']} titulo="Productos y servicios" onCerrar={() => setHoja(null)}
          onElegir={async (i: Item) => { await agregarCargo(await destinoCargo(), i); vibrar(10); toast(`+1 ${i.nombre}`) }} />
      )}
      {hoja === 'receta' && <FormReceta onCerrar={() => setHoja(null)} veterinarioDef={usuario?.nombre ?? ''}
        onGuardar={async r => {
          const e = await asegurar()
          await guardar<Receta>('recetas', { ...r, id: uid(), tambo_id: tid, examen_id: e.id, vaca_id: vid, fecha: new Date().toISOString() })
          toast('Receta guardada'); setHoja(null)
        }} />}
      {hoja === 'datos' && <DatosVaca vid={vid} tid={tid} onCerrar={() => setHoja(null)} />}
    </div>
  )
}

const VIAS = ['IM', 'IV', 'SC', 'Oral', 'Tópica', 'Local']

function FormReceta({ onCerrar, onGuardar, veterinarioDef }: { onCerrar: () => void; veterinarioDef: string; onGuardar: (r: Omit<Receta, 'id' | 'tambo_id' | 'examen_id' | 'vaca_id' | 'fecha'>) => void }) {
  const [r, setR] = useState({ veterinario: veterinarioDef, medicamento: '', dosis: '', via: '', duracion: '', indicaciones: '' })
  const set = (k: keyof typeof r) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setR({ ...r, [k]: e.target.value })
  return (
    <Hoja titulo="Receta veterinaria" onCerrar={onCerrar}>
      <label className="campo">Medicamento<input className="input" autoFocus value={r.medicamento} onChange={set('medicamento')} /></label>
      <label className="campo">Dosis<input className="input" value={r.dosis} onChange={set('dosis')} placeholder="ej. 20 ml" /></label>
      <div className="stack"><b>Vía</b><Chips opciones={VIAS.map(x => ({ v: x, t: x }))} valor={r.via} onCambio={x => setR({ ...r, via: x === r.via ? '' : x })} /></div>
      <label className="campo">Duración<input className="input" value={r.duracion} onChange={set('duracion')} placeholder="ej. 3 días, cada 24 h" /></label>
      <label className="campo">Veterinario<input className="input" value={r.veterinario} onChange={set('veterinario')} /></label>
      <label className="campo">Indicaciones<textarea className="input" value={r.indicaciones} onChange={set('indicaciones')} /></label>
      <button className="btn pri lg block" disabled={!r.medicamento.trim()} onClick={() => onGuardar(r)}>Guardar receta</button>
    </Hoja>
  )
}

export function DatosVaca({ vid, tid, onCerrar }: { vid: string; tid: string; onCerrar: () => void }) {
  const d = useLiveQuery(async () => ({
    v: await db.vacas.get(vid),
    lotes: vivos(await db.lotes.where('tambo_id').equals(tid).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    cats: vivos(await db.categorias.toArray()).sort((a, b) => a.orden - b.orden)
  }), [vid, tid])
  if (!d?.v) return null
  const v = d.v
  return (
    <Hoja titulo={`Vaca ${v.numero}`} onCerrar={onCerrar}>
      <div className="stack"><b>Lote de ordeñe</b>
        <Chips opciones={[{ v: null, t: 'Sin lote' }, ...d.lotes.map(l => ({ v: l.id as string | null, t: l.nombre }))]} valor={v.lote_id ?? null} onCambio={x => actualizar('vacas', vid, { lote_id: x })} />
      </div>
      <div className="stack"><b>Categoría</b>
        <Chips opciones={[{ v: null, t: 'Sin categoría' }, ...d.cats.map(c => ({ v: c.id as string | null, t: c.nombre }))]} valor={v.categoria_id ?? null} onCambio={x => actualizar('vacas', vid, { categoria_id: x })} />
      </div>
      <CampoTexto etiqueta="Notas de la vaca" multilinea valor={v.notas ?? ''} onGuardar={x => actualizar('vacas', vid, { notas: x })} />
      <label className="switch">Vaca activa en el rodeo
        <input type="checkbox" checked={v.activa !== false} onChange={e => actualizar('vacas', vid, { activa: e.target.checked })} />
      </label>
      <button className="btn pri block" onClick={onCerrar}>Listo</button>
    </Hoja>
  )
}
