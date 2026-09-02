import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const logger = createLogger()
const logError = logger.error

logger.error = (message, options) => {
  const code = (options?.error as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ECONNRESET' && message.includes('ws proxy')) return
  logError(message, options)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080'
  const wsUrl = env.VITE_WS_URL || apiUrl.replace(/^http/, 'ws')

  return {
    plugins: [react()],
    customLogger: logger,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      proxy: {
        '/api': apiUrl,
        '/ws': { target: wsUrl, ws: true },
      },
    },
  }
})
