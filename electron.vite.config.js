import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/main.js')
      },
      outDir: path.resolve(__dirname, 'dist-electron'),
      emptyOutDir: false,
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/preload.js')
      },
      outDir: path.resolve(__dirname, 'dist-electron'),
      emptyOutDir: false
    }
  },
  renderer: {
    root: '.',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    }
  }
})
