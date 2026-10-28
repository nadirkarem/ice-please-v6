// Entry point used by vite.config.js and scripts/odoo-pack.mjs: lists and renders every page.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANGS, ROUTES, PRIVATE_IDS, pageUrl, fileFor } from './routes.mjs';
import { layout, makeCtx } from './layout.mjs';
import { RENDERERS } from './pages.mjs';

const contentDir = resolve(import.meta.dirname, '../../content');
const read = (name) => JSON.parse(readFileSync(resolve(contentDir, name), 'utf8'));

/** Objects are merged key by key; anything else (strings, arrays) is replaced. */
function merge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}

/** Read on every call so edits to content/*.json show up on reload in dev. The shop texts live in shop.<lang>.json. */
export function loadContent() {
  return {
    site: read('site.json'),
    shop: read('shop.json'),
    images: read('images.manifest.json'),
    legal: read('legal.fr.json'),
    langs: Object.fromEntries(LANGS.map((l) => [l, merge(read(`${l}.json`), read(`shop.${l}.json`))])),
  };
}

export function listPages() {
  const pages = [];
  for (const [id, slugs] of Object.entries(ROUTES)) {
    for (const lang of Object.keys(slugs)) {
      const url = pageUrl(id, lang);
      pages.push({ id, lang, url, file: fileFor(url) });
    }
  }
  pages.push({ id: 'notFound', lang: 'fr', url: '/404.html', file: '404.html' });
  return pages;
}

/** `extra.odoo` renders the Odoo flavour: the shop is Odoo's own, so buy buttons link to it and the header cart reads Odoo's counter. */
export function renderMain(page, content = loadContent(), extra = {}) {
  const ctx = { ...makeCtx(page.lang, content), ...extra };
  return { ctx, main: RENDERERS[page.id](ctx, page) };
}

export function renderPage(page, options = {}) {
  const content = loadContent();
  const { ctx, main } = renderMain(page, content);
  return layout(ctx, page, main, options);
}

export function buildSitemap() {
  const { site } = loadContent();
  const urls = listPages()
    .filter((p) => p.id !== 'notFound' && !PRIVATE_IDS.includes(p.id))
    .map((p) => {
      const alternates = LANGS.filter((l) => ROUTES[p.id][l] !== undefined);
      const links = alternates.length > 1
        ? alternates.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site.url}${pageUrl(p.id, l)}"/>`).join('\n')
        : '';
      return `  <url>\n    <loc>${site.url}${p.url}</loc>${links ? `\n${links}` : ''}\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Draft: nothing is crawled. Live: everything except the pages of a visit (cart, checkout, payment, account). */
export function buildRobots() {
  const { site } = loadContent();
  if (!site.indexable) return 'User-agent: *\nDisallow: /\n';
  const blocked = listPages()
    .filter((p) => PRIVATE_IDS.includes(p.id))
    .map((p) => `Disallow: ${p.url}`);
  return `User-agent: *\nAllow: /\n${blocked.join('\n')}\n\nSitemap: ${site.url}/sitemap.xml\n`;
}
