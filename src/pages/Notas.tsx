import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setMeta, vivos, type NotaProp, type NotaTipo } from '../lib/db'
import { borrar, guardar } from '../lib/repo'
import { useAuth } from '../lib/auth'
import { ir } from '../lib/router'
import { buscarVaca } from '../lib/acciones'
import { fechaCorta, horaCorta, uid } from '../lib/util'
import { BottomNav, Hoja, TopBar, Vacio, toast } from '../components/ui'
import { Chips } from '../components/Selectores'
import { Icono } from '../components/Icono'

const TIPOS: { v: NotaTipo; t: string }[] = [{ v: 'aviso', t: 'Aviso' }, { v: 'informe', t: 'Informe' }, { v: 'observacion', t: 'Observación' }]

export function NotasPage({ tid }: { tid: string }) {
  const { usuario, esAdmin } = useAuth()
  const [nueva, setNueva] = useState(false)
  useEffect(() => { if (esAdmin) void setMeta('notas_visto', Date.now()) }, [esAdmin])
  const d = useLiveQuery(async () => {
    const t = await db.tambos.get(tid)
    const notas = vivos(await db.notas_prop.where('tambo_id').equals(tid).toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const vacas = new Map(vivos(await db.vacas.where('tambo_id').equals(tid).toArray()).map(v => [v.id, v]))
    return { t, notas, vacas }
  }, [tid])
  if (!d) return null
  return (
    <div className="app">
      <TopBar titulo={esAdmin ? 'Avisos del propietario' : 'Notas y avisos'} sub={d.t?.nombre} atras={`/t/${tid}`} />
      <main className="page">
        {!esAdmin && <button className="btn pri lg block" onClick={() => setNueva(true)}><Icono n="mas" /> Nueva nota para el podólogo</button>}
        {esAdmin && <p className="muted small" style={{ margin: 0 }}>Notas que deja el propietario o encargado del tambo. No modifican los registros del podólogo.</p>}
        {d.notas.length === 0 && <Vacio>No hay notas todavía.</Vacio>}
        {d.notas.map(n => {
          const v = n.vaca_id ? d.vacas.get(n.vaca_id) : undefined
          const propia = n.autor_id === usuario?.id
          return (
            <section key={n.id} className="card stack" style={{ gap: 6 }}>
              <div className="hstack">
                <span className={'tag ' + (n.tipo === 'aviso' ? 'n2' : n.tipo === 'informe' ? 'n0' : '')}>{TIPOS.find(t => t.v === n.tipo)?.t}</span>
                {v && <button className="tag" style={{ border: 0 }} onClick={() => ir(`/t/${tid}/vaca/${v.id}`)}>Vaca {v.numero}</button>}
                <span className="muted small grow">{fechaCorta(n.fecha)} {horaCorta(n.fecha)} · {n.autor_nombre}</span>
                {propia && <button className="btn sm danger" aria-label="Borrar nota" onClick={() => confirm('¿Borrar nota?') && borrar('notas_prop', n.id)}><Icono n="basura" /></button>}
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n.texto}</p>
            </section>
          )
        })}
      </main>
      {nueva && usuario && <NuevaNota tid={tid} autor={{ id: usuario.id, nombre: usuario.nombre }} onCerrar={() => setNueva(false)} />}
      <BottomNav />
    </div>
  )
}

function NuevaNota({ tid, autor, onCerrar }: { tid: string; autor: { id: string; nombre: string }; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<NotaTipo>('aviso')
  const [numero, setNumero] = useState('')
  const [texto, setTexto] = useState('')
  return (
    <Hoja titulo="Nueva nota" onCerrar={onCerrar}>
      <Chips opciones={TIPOS} valor={tipo} onCambio={setTipo} />
      <label className="campo">N° de vaca (opcional)<input className="input" inputMode="numeric" value={numero} onChange={e => setNumero(e.target.value)} /></label>
      <label className="campo">Texto<textarea className="input" autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder="ej. La vaca 120 está rengueando desde ayer" /></label>
      <button className="btn pri lg block" disabled={!texto.trim()} onClick={async () => {
        const v = numero.trim() ? await buscarVaca(tid, numero) : undefined
        const t = numero.trim() && !v ? `Vaca N° ${numero.trim()}: ${texto.trim()}` : texto.trim()
        await guardar<NotaProp>('notas_prop', { id: uid(), tambo_id: tid, vaca_id: v?.id ?? null, autor_id: autor.id, autor_nombre: autor.nombre, tipo, texto: t, fecha: new Date().toISOString() })
        toast('Nota guardada')
        onCerrar()
      }}>Guardar nota</button>
    </Hoja>
  )
}
