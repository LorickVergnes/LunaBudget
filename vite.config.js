import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  base: '/LunaBudget/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    rolldownOptions: {
      output: {
        // Les bibliothèques sont rangées dans leurs propres fichiers : elles changent rarement,
        // le navigateur les garde donc en cache d'un déploiement à l'autre.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
            // Code de l'application utilisé par plusieurs pages (hooks, composants, calculs) :
            // un seul fichier plutôt qu'une quinzaine de fichiers de quelques centaines d'octets.
            // Les pages elles-mêmes (src/pages) restent chacune dans leur fichier.
            { name: 'app-shared', test: /[\\/]src[\\/](lib|hooks|components|contexts|services)[\\/]/, minShareCount: 2, priority: 5 },
          ],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
