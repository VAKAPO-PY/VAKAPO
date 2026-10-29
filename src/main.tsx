import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import { restaurarRuta } from './lib/router'
import './styles.css'

// Volver al mismo punto de trabajo si la app se cerró o el equipo se apagó
restaurarRuta()

// Pedir al navegador que no borre los datos locales
void navigator.storage?.persist?.()

// App instalable y funcionando sin internet
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
