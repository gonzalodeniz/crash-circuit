import { defineConfig } from 'vite';

// Política de seguridad de contenido de la página publicada: solo recursos del propio origen y
// ninguna conexión de red (refuerza RF-060, RNF-06 y RNF-07: sin backend ni telemetría).
// `img-src` admite `data:` y `blob:` por las texturas generadas en memoria.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Inserta la CSP en el <head> solo en `vite build`: el servidor de desarrollo necesita un
// WebSocket para la recarga en caliente y scripts en línea que la política bloquearía.
export function contentSecurityPolicyPlugin() {
  return {
    name: 'crash-circuit-content-security-policy',
    apply: 'build',
    // Se inserta como texto (no como etiqueta estructurada) para que las comillas simples de la
    // política queden literales y no escapadas como `&#39;`.
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      return html.replace('<head>', `<head>\n    ${meta}`);
    },
  };
}

// El código del juego vive en src/; la raíz solo contiene ficheros de configuración.
export default defineConfig({
  root: 'src',
  plugins: [contentSecurityPolicyPlugin()],
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
