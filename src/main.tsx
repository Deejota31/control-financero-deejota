import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { iniciarPwa } from './lib/pwa'

iniciarPwa() // instalación, conexión y Service Worker (este último solo en producción)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
