import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { configError } from './lib/supabase'
import { setupPWA } from './lib/pwa'

const root = createRoot(document.getElementById('root')!)

if (configError) {
  // A misconfigured build can't do anything useful, but it must not be a blank
  // page — on the day, "nothing happens" is the worst possible symptom.
  root.render(
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl">Not configured</h1>
      <p className="mt-3 text-ink-muted">
        This build is missing its database settings, so it can&rsquo;t start.
      </p>
      <p className="mt-6 text-sm text-ink-faint">{configError}</p>
    </div>,
  )
} else {
  setupPWA()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
