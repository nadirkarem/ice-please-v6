import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { listPages, renderPage, buildSitemap, buildRobots } from './scripts/lib/site.mjs';

const root = import.meta.dirname;

/* Hosting under a sub-path (GitHub Pages: https://user.github.io/repo/): BASE_PATH=/repo npm run build.
   Vite rewrites the bundle and the stylesheet; this rewrites the root-relative URLs of the pages. */
const BASE = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
const rebase = (html) => {
  if (!BASE) return html;
  html = html.replace('<meta name="ip-base" content="/">', `<meta name="ip-base" content="${BASE}/">`); // read by src/shop.js to build addresses
  return html.replace(/(\s(?:href|src|srcset|poster)=")([^"]*)"/g, (match, attr, value) => {
    if (value.startsWith('/src/')) return match; // the module entry: Vite handles it
    const fixed = attr.includes('srcset')
      ? value.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`)
      : value.startsWith('/') && !value.startsWith('//') ? BASE + value : value;
    return `${attr}${fixed}"`;
  });
};

/**
 * Pages are not files: each one is rendered from content/*.json and scripts/lib/*.
 * - build: every page becomes a real HTML entry (dist/en/ice/index.html, ...).
 * - dev: the same HTML is served on the fly and reloads when a content file changes.
 */
function pagesPlugin() {
  const pages = listPages();
  const byFile = new Map(pages.map((p) => [resolve(root, p.file), p]));
  const byUrl = new Map(pages.map((p) => [p.url, p]));

  return {
    name: 'ip-pages',
    enforce: 'pre',

    config() {
      return { appType: 'mpa', build: { rollupOptions: { input: [...byFile.keys()] } } };
    },

    resolveId(id) {
      return byFile.has(id) ? id : null;
    },

    load(id) {
      const page = byFile.get(id);
      return page ? rebase(renderPage(page)) : null;
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots() });
    },

    configureServer(server) {
      server.watcher.add(resolve(root, 'content'));
      server.watcher.on('change', (file) => {
        if (file.includes('/content/')) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '/').split('?')[0];
        const url = path.endsWith('index.html') ? path.slice(0, -'index.html'.length) : path;
        const page = byUrl.get(url) ?? byUrl.get(`${url}/`);
        if (!page) return next();
        const html = await server.transformIndexHtml(path, renderPage(page));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  root,
  base: BASE ? `${BASE}/` : '/',
  plugins: [pagesPlugin()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
});
