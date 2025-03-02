import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from "node:path"
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite"
import Unimport from 'unimport/unplugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: resolve(dirname(fileURLToPath(import.meta.url)), './src/locales/**'),
      strictMessage: false
    }),
    Unimport.vite({
      addons: {
        vueTemplate: true
      },
      imports: [{ name: 'push', from: 'notivue' }]
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  optimizeDeps: {
    exclude: ["oh-vue-icons/icons"]
  },
  server: {
    host: '0.0.0.0',
    port: 5001,
    watch: {
      usePolling: true
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'icons': ['oh-vue-icons']
        }
      }
    },
    sourcemap: true
  }
})
