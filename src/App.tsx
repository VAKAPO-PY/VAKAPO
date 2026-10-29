import { useEffect } from 'react'
import { useAuth } from './lib/auth'
import { coincide, ir, useRuta } from './lib/router'
import { MODO_NUBE } from './lib/supabase'
import type { PataId } from './lib/db'
import { Toaster, Logo } from './components/ui'
import { Login } from './pages/Login'
import { Inicio } from './pages/Inicio'
import { TamboPage } from './pages/Tambo'
import { JornadaPage } from './pages/Jornada'
import { ExamenPage } from './pages/Examen'
import { PataPage } from './pages/Pata'
import { VacasPage, VacaPage, JornadasPage } from './pages/Vacas'
import { NotasPage } from './pages/Notas'
import { TamboConfigPage } from './pages/TamboConfig'
import { AlertasPage } from './pages/Alertas'
import { ReportesInicio, ReportesPage } from './pages/Reportes'
import { AjustesPage } from './pages/Ajustes'
import { LesionesPage, ItemsPage, CategoriasPage, UsuariosPage } from './pages/Catalogos'

function Redirigir({ a }: { a: string }) {
  useEffect(() => { ir(a, true) }, [a])
  return null
}

function Rutas() {
  const ruta = useRuta()
  const { esAdmin } = useAuth()
  let m: Record<string, string> | null
  const soloAdmin = (el: JSX.Element) => (esAdmin ? el : <Redirigir a="/" />)

  if ((m = coincide('/t/:tid/j/:jid/v/:vid/p/:pata', ruta))) return <PataPage tid={m.tid} jid={m.jid} vid={m.vid} pata={m.pata as PataId} />
  if ((m = coincide('/t/:tid/j/:jid/v/:vid', ruta))) return <ExamenPage tid={m.tid} jid={m.jid} vid={m.vid} />
  if ((m = coincide('/t/:tid/j/:jid', ruta))) return <JornadaPage tid={m.tid} jid={m.jid} />
  if ((m = coincide('/t/:tid/vaca/:vid', ruta))) return <VacaPage tid={m.tid} vid={m.vid} />
  if ((m = coincide('/t/:tid/vacas', ruta))) return <VacasPage tid={m.tid} />
  if ((m = coincide('/t/:tid/jornadas', ruta))) return <JornadasPage tid={m.tid} />
  if ((m = coincide('/t/:tid/notas', ruta))) return <NotasPage tid={m.tid} />
  if ((m = coincide('/t/:tid/config', ruta))) return soloAdmin(<TamboConfigPage tid={m.tid} />)
  if ((m = coincide('/t/:tid', ruta))) return <TamboPage tid={m.tid} />
  if (coincide('/alertas', ruta)) return soloAdmin(<AlertasPage />)
  if ((m = coincide('/reportes/:tid', ruta))) return <ReportesPage tid={m.tid} />
  if (coincide('/reportes', ruta)) return <ReportesInicio />
  if (coincide('/ajustes/lesiones', ruta)) return soloAdmin(<LesionesPage />)
  if (coincide('/ajustes/items', ruta)) return soloAdmin(<ItemsPage />)
  if (coincide('/ajustes/categorias', ruta)) return soloAdmin(<CategoriasPage />)
  if (coincide('/ajustes/usuarios', ruta)) return soloAdmin(<UsuariosPage />)
  if (coincide('/ajustes', ruta)) return <AjustesPage />
  return <Inicio />
}

export function App() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div className="login" style={{ alignItems: 'center' }}><Logo size={72} /><span className="muted">Cargando…</span></div>
  if (MODO_NUBE && !usuario) return <><Login /><Toaster /></>
  return <><Rutas /><Toaster /></>
}
