import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Absolute hreflang URLs: Netlify exposes the site's primary URL as `URL` at build time.
const siteUrl = (): Plugin => ({
  name: 'site-url',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replaceAll('__SITE_URL__', (process.env.URL ?? process.env.SITE_URL ?? '').replace(/\/+$/, '')),
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl()],
  server: { port: 5173, strictPort: true },
});
