import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Après un déploiement, un onglet resté ouvert peut demander le fichier d'une page qui n'existe
// plus sous ce nom. On recharge alors l'application une fois, pour récupérer la nouvelle version.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'lunabudget:reloaded-at'
  const lastReload = Number(sessionStorage.getItem(KEY) || 0)
  // Garde-fou : pas de rechargements en boucle si le fichier est réellement introuvable
  if (Date.now() - lastReload < 30_000) return
  sessionStorage.setItem(KEY, String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
