import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-syntax-highlighter') || id.includes('highlight.js')) {
            return 'syntax-highlighter'
          }

          if (id.includes('refractor') || id.includes('prismjs')) {
            return 'syntax-languages'
          }

          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('mdast') || id.includes('unist')) {
            return 'markdown'
          }

          if (
            id.includes('react-force-graph-3d') ||
            id.includes('three') ||
            id.includes('3d-force-graph') ||
            id.includes('d3-force-3d')
          ) {
            return 'nova-graph3d'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (id.includes('gsap') || id.includes('lenis') || id.includes('animejs')) {
            return 'motion-runtime'
          }

          if (id.includes('axios')) {
            return 'network'
          }
        },
      },
    },
  },
})
