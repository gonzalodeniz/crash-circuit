import { defineConfig } from 'vite';

// El código del juego vive en src/; la raíz solo contiene ficheros de configuración.
export default defineConfig({
  root: 'src',
  // Rutas relativas para poder alojar la carpeta dist/ en cualquier servidor de ficheros estáticos.
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5190,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5191,
    strictPort: true,
  },
});
