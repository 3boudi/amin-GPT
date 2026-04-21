import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/.netlify/functions/chat': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: () => '/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY || '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'}`,
          'Accept': 'text/event-stream'
        }
      }
    }
  }
})
