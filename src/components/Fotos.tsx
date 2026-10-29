import { useEffect, useRef, useState } from 'react'
import type { Foto } from '../lib/db'
import { borrarFoto, tomarFoto, urlFoto, type DestinoFoto } from '../lib/fotos'
import { Icono } from './Icono'
import { toast } from './ui'
import { fechaCorta } from '../lib/util'

export function FotoMini({ f, onClick }: { f: Foto; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let ok = true; void urlFoto(f, 'thumb').then(u => ok && setUrl(u)); return () => { ok = false } }, [f.id, f.path])
  return (
    <button className="foto" onClick={onClick} aria-label="Ver foto">
      {url ? <img src={url} alt="" loading="lazy" /> : <span className="small muted">Sin señal</span>}
      {f.subida === 0 && <span className="estado">sin subir</span>}
    </button>
  )
}

export function Visor({ f, onCerrar, puedeBorrar }: { f: Foto; onCerrar: () => void; puedeBorrar?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { void urlFoto(f, 'full').then(setUrl) }, [f.id])
  return (
    <div className="visor">
      {url ? <img src={url} alt="Foto" /> : <div className="grow center" style={{ color: '#fff', paddingTop: 80 }}>Cargando…</div>}
      <div className="barra">
        <span style={{ color: '#fff', alignSelf: 'center' }} className="grow">{fechaCorta(f.fecha)}</span>
        {puedeBorrar && (
          <button className="btn danger" onClick={async () => { if (confirm('¿Borrar esta foto?')) { await borrarFoto(f); onCerrar() } }}>
            <Icono n="basura" /> Borrar
          </button>
        )}
        <button className="btn pri" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  )
}

/** Botón que abre la cámara del celular. La foto queda guardada en el equipo al instante. */
export function BotonCamara({ destino, texto = 'Foto', clase = 'btn', onListo }: { destino: DestinoFoto | (() => Promise<DestinoFoto>); texto?: string; clase?: string; onListo?: (f: Foto) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  return (
    <>
      <button className={clase} disabled={ocupado} onClick={() => input.current?.click()}>
        <Icono n="camara" /> {ocupado ? 'Guardando…' : texto}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={async e => {
          const archivos = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!archivos.length) return
          setOcupado(true)
          try {
            const d = typeof destino === 'function' ? await destino() : destino
            for (const a of archivos) { const f = await tomarFoto(d, a); onListo?.(f) }
            toast(archivos.length > 1 ? `${archivos.length} fotos guardadas` : 'Foto guardada')
          } catch (err) {
            toast('No se pudo guardar la foto')
            console.error(err)
          } finally { setOcupado(false) }
        }} />
    </>
  )
}

export function GaleriaFotos({ fotos, puedeBorrar }: { fotos: Foto[]; puedeBorrar?: boolean }) {
  const [ver, setVer] = useState<Foto | null>(null)
  if (!fotos.length) return null
  return (
    <>
      <div className="fotos">{fotos.map(f => <FotoMini key={f.id} f={f} onClick={() => setVer(f)} />)}</div>
      {ver && <Visor f={ver} onCerrar={() => setVer(null)} puedeBorrar={puedeBorrar} />}
    </>
  )
}
