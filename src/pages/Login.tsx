import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/ui'

export function Login() {
  const { entrar, registrar } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState<{ t: 'error' | 'ok'; m: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!navigator.onLine) { setMsg({ t: 'error', m: 'Para ingresar la primera vez se necesita internet.' }); return }
    if (!email.includes('@')) { setMsg({ t: 'error', m: 'Escribí un correo válido.' }); return }
    if (clave.length < 6) { setMsg({ t: 'error', m: 'La contraseña debe tener al menos 6 caracteres.' }); return }
    if (modo === 'crear' && !nombre.trim()) { setMsg({ t: 'error', m: 'Escribí tu nombre.' }); return }
    setOcupado(true)
    try {
      if (modo === 'entrar') await entrar(email, clave)
      else {
        const r = await registrar(nombre.trim(), email, clave)
        if (r) { setMsg({ t: 'ok', m: r }); setModo('entrar') }
      }
    } catch (err) {
      setMsg({ t: 'error', m: err instanceof Error ? err.message : 'No se pudo ingresar' })
    } finally { setOcupado(false) }
  }

  return (
    <form className="login" onSubmit={enviar}>
      <div className="logo"><Logo /><div><b>VAKAPO</b><div className="muted small">Podología bovina</div></div></div>
      <h1>{modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}</h1>
      {modo === 'crear' && (
        <label className="campo">Nombre
          <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" />
        </label>
      )}
      <label className="campo">Correo
        <input className="input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className="campo">Contraseña
        <input className="input" type="password" value={clave} onChange={e => setClave(e.target.value)} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
      </label>
      {msg && <div className={'aviso ' + (msg.t === 'error' ? 'danger' : 'ok')}>{msg.m}</div>}
      <button className="btn pri lg block" disabled={ocupado} type="submit">{ocupado ? 'Un momento…' : modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}</button>
      <button type="button" className="btn ghost block" onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setMsg(null) }}>
        {modo === 'entrar' ? '¿No tenés cuenta? Crear una' : 'Ya tengo cuenta'}
      </button>
      {modo === 'crear' && <p className="small muted center">Las cuentas nuevas quedan como propietario. Un administrador asigna el acceso a cada tambo.</p>}
    </form>
  )
}
