// Builds odoo-pack/: the files needed to paste the design into an Odoo website.
// Usage: npm run build && npm run odoo
//   IP_ASSET_BASE=/ice-v5        where img/, fonts/, media/, ip.css and ip.js will be served (a path on the Odoo site, or a full URL)
//   IP_PREFIX=/v5                prefix for the pages (so they can sit next to the existing Odoo pages)
//   IP_CHROME=1                  keep the design's own header, footer and WhatsApp button in each page (hide Odoo's)
// Also writes pages.json (one entry per page: url, name, description, XML arch) for tools/odoo/install.js.
// See ODOO.md for the full procedure.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listPages, renderMain } from './lib/site.mjs';
import { layout } from './lib/layout.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'odoo-pack');
const base = (process.env.IP_ASSET_BASE ?? '').replace(/\/$/, '');
const prefix = (process.env.IP_PREFIX ?? '').replace(/\/$/, '');
const chrome = process.env.IP_CHROME === '1';

if (!existsSync(resolve(dist, 'assets'))) {
  console.error('dist/ not found: run `npm run build` first.');
  process.exit(1);
}

/** Point /img, /brand, /fonts and /media at the place where the files will live in Odoo. */
const rebase = (text) => text.replace(/(["'(,\s])\/(img|brand|fonts|media)\//g, `$1${base}/$2/`);

/** Page links: add the prefix and drop the trailing slash (Odoo pages have none). */
const relink = (text) => (prefix === '' ? text : text.replace(/(href=")\/(?!\/|img\/|brand\/|fonts\/|media\/)([^"]*)"/g, (m, a, rest) => `${a}${prefix}/${rest.replace(/\/$/, '')}"`.replace(/\/"$/, '"')));
/** The generated HTML is HTML5; an Odoo page is XML: self-close void tags and give boolean attributes a value. */
const VOID = new Set(['img', 'source', 'br', 'input', 'link', 'meta', 'hr']);
const xml = (html) => html.replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g, (m, tag, attrs, slash) => {
  const fixed = attrs.replace(/(\s+)([^\s=>/"']+)(\s*=\s*(?:"[^"]*"|'[^']*'))?/g, (x, sp, name, val) => (val ? x : `${sp}${name}="${name}"`));
  return `<${tag}${fixed}${slash || VOID.has(tag) ? '/' : ''}>`;
});

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. one HTML fragment per page and language: the content of <main>, wrapped in the .ip scope
let count = 0;
const pages = [];
for (const page of listPages().filter((p) => p.id !== 'notFound')) {
  const { ctx, main } = renderMain(page);
  const dir = resolve(out, page.lang);
  mkdirSync(dir, { recursive: true });
  const html = chrome
    ? layout(ctx, page, main, { fragment: true }).replace('<div class="ip"', '<div class="ip" data-ip-smooth')
    : `<div class="ip" data-ip-smooth lang="${ctx.lang}" dir="${ctx.dir}">\n${main}\n</div>\n`;
  const final = xml(relink(rebase(html)));
  writeFileSync(resolve(dir, `${page.id}.html`), final);
  const meta = ctx.c.meta[page.id] ?? {};
  const odooUrl = `${prefix}${page.url}`.replace(/\/$/, '') || '/';
  pages.push({ id: page.id, lang: page.lang, url: odooUrl, name: meta.title ?? page.id, description: meta.description ?? '', arch: final });
  count += 1;
}

// 2. stylesheet and script, as built by Vite
const assets = readdirSync(resolve(dist, 'assets'));
const css = assets.find((f) => f.endsWith('.css'));
const js = assets.find((f) => f.endsWith('.js'));
writeFileSync(resolve(out, 'ip.css'), rebase(readFileSync(resolve(dist, 'assets', css), 'utf8')));
cpSync(resolve(dist, 'assets', js), resolve(out, 'ip.js'));

// 3. media to upload to Odoo (or to host elsewhere)
for (const dir of ['img', 'brand', 'fonts', 'media']) cpSync(resolve(dist, dir), resolve(out, 'media', dir), { recursive: true });

writeFileSync(resolve(out, 'pages.json'), JSON.stringify({ base, prefix, chrome, pages }, null, 1));
console.log(`odoo-pack/: ${count} fragments, ip.css, ip.js, media/ (asset base: ${base || 'unchanged, paths start with /'})`);
