import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/armagedo.ng/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Exclude transformers from pre-bundling to allow proper worker parsing
    exclude: ['@huggingface/transformers']
  },
  server: {
    // Required headers if using WebGPU or SharedArrayBuffer multi-threading
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})