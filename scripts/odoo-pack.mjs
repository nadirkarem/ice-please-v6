// Builds odoo-pack/: the files needed to put the design on an Odoo website, next to the existing pages.
// Usage: npm run build && npm run odoo
//   IP_ASSET_BASE=/ice-v6        where img/, fonts/, media/, ip.css and ip.js will be served (a path on the Odoo site, or a full URL)
//   IP_PREFIX=/v6                prefix for the pages (so they can sit next to the existing Odoo pages)
//   IP_CHROME=1                  keep the design's own header, footer and WhatsApp button inside each page (Odoo's are hidden)
//   IP_DIST=dist-pack            the build to read (default dist; for a host that serves the pack, a build made WITHOUT BASE_PATH)
//   IP_NO_MEDIA=1                do not copy img/, fonts/, media/ into the pack (when they are served by the host)
// Writes pages.json for tools/odoo/install.js (pages + layout patch) and shop.json for tools/odoo/shop-setup.js (catalogue, texts, images).
//
// The shop is Odoo's own (website_sale): the pack holds no cart, checkout or account page. What it does hold:
//  - the presentation pages (home, range, products, know-how, about, contact, legal) whose buttons point to the shop,
//  - a layout patch: the same header and footer (and the WhatsApp button) for Odoo's own pages, and the stylesheet that dresses them
//    (src/odoo-skin.css, inside ip.css).
// See ODOO_BOUTIQUE.md for the full procedure.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listPages, loadContent, renderMain } from './lib/site.mjs';
import { chrome, layout, makeCtx } from './lib/layout.mjs';
import { ACCOUNT_IDS, LANGS, PRODUCT_IDS, SHOP_IDS } from './lib/routes.mjs';
import { CARD_IMAGE, PAGE_IMAGE, allProducts } from './lib/catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, process.env.IP_DIST ?? 'dist');
const out = resolve(root, 'odoo-pack');
const base = (process.env.IP_ASSET_BASE ?? '').replace(/\/$/, '');
const prefix = (process.env.IP_PREFIX ?? '').replace(/\/$/, '');
const withChrome = process.env.IP_CHROME === '1';

if (!existsSync(resolve(dist, 'assets'))) {
  console.error('dist/ not found: run `npm run build` first.');
  process.exit(1);
}

/** The shop, the cart, the checkout and the account are Odoo's own pages: not part of the pack. */
const OWN = new Set(['notFound', ...SHOP_IDS, ...ACCOUNT_IDS]);
/** Addresses that stay Odoo's (never prefixed): the shop, the account and the sign-in, in every language. */
const NATIVE = /^(?:(?:en|ar)\/)?(?:shop|my|web)(?:\/|$)/;

/** Point /img, /brand, /fonts and /media at the place where the files will live in Odoo. */
const rebase = (text) => text.replace(/(["'(,\s])\/(img|brand|fonts|media)\//g, `$1${base}/$2/`);

/** Page links: add the prefix and drop the trailing slash (Odoo pages have none). Odoo's own addresses keep no prefix. */
const relink = (text) => text.replace(/(href=")\/(?!\/|img\/|brand\/|fonts\/|media\/)([^"]*)"/g, (m, a, rest) => {
  const clean = rest.replace(/\/(?=#|\?|$)/, '');
  if (NATIVE.test(rest)) return `${a}/${clean}"`;
  return `${a}${prefix}${clean || !prefix ? `/${clean}` : ''}"`;
});

/** The generated HTML is HTML5; an Odoo page is XML: self-close void tags and give boolean attributes a value. */
const VOID = new Set(['img', 'source', 'br', 'input', 'link', 'meta', 'hr']);
const xml = (html) => html.replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g, (m, tag, attrs, slash) => {
  const fixed = attrs.replace(/(\s+)([^\s=>/"']+)(\s*=\s*(?:"[^"]*"|'[^']*'))?/g, (x, sp, name, val) => (val ? x : `${sp}${name}="${name}"`));
  return `<${tag}${fixed}${slash || VOID.has(tag) ? '/' : ''}>`;
});
const ready = (html) => xml(relink(rebase(html)));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const content = loadContent();

// 1. one HTML fragment per page and language: the presentation pages (the content of <main>, wrapped in the .ip scope)
let count = 0;
const pages = [];
for (const page of listPages().filter((p) => !OWN.has(p.id))) {
  const { ctx, main } = renderMain(page, content, { odoo: true });
  const dir = resolve(out, page.lang);
  mkdirSync(dir, { recursive: true });
  const html = withChrome
    ? layout(ctx, page, main, { fragment: true }).replace('<div class="ip"', '<div class="ip" data-ip-smooth').replace('data-ip-header', `data-ip-header data-ip-prefix="${prefix}"`)
    : `<div class="ip" data-ip-smooth lang="${ctx.lang}" dir="${ctx.dir}">\n${main}\n</div>\n`;
  const final = ready(html);
  writeFileSync(resolve(dir, `${page.id}.html`), final);
  const meta = ctx.c.meta[page.id] ?? {};
  const odooUrl = `${prefix}${page.url}`.replace(/\/$/, '') || '/';
  pages.push({ id: page.id, lang: page.lang, url: odooUrl, name: meta.title ?? page.id, description: meta.description ?? '', arch: final });
  count += 1;
}

// 2. the layout patch: header, footer and WhatsApp button of Odoo's own pages, in the three languages (chosen from Odoo's `lang`)
const variants = LANGS.map((l) => {
  const ctx = { ...makeCtx(l, content), odoo: true };
  const parts = chrome(ctx, { id: 'native', lang: l });
  const header = parts.header.replace('data-ip-header', `data-ip-header data-ip-prefix="${prefix}"`);
  return { lang: l, header: ready(header), footer: ready(parts.footer), floating: ready(parts.floating) };
});
const pick = (part) => `<t t-if="lang.startswith('en')">${variants[1][part]}</t><t t-elif="lang.startswith('ar')">${variants[2][part]}</t><t t-else="">${variants[0][part]}</t>`;
const layoutPatch = {
  key: 'website.ice_v6_layout',
  name: 'Ice Please V6 : en-tête, pied de page et feuille de style des pages d’Odoo',
  inherit: 'website.layout',
  // `ip_chrome` is set by the pages of the pack, which bring their own header and footer: the patch leaves them alone
  arch: `<data name="Ice Please V6" inherit_id="website.layout">
  <xpath expr="//head" position="inside"><link rel="stylesheet" href="${base}/ip.css"/><script type="module" src="${base}/ip.js"></script></xpath>
  <xpath expr="//div[@id='wrapwrap']" position="attributes">
    <attribute name="t-attf-class" add="#{'ip ip-odoo' if not ip_chrome else ''}" separator=" "/>
    <attribute name="t-att-lang">lang.replace('_', '-') if not ip_chrome else None</attribute>
    <attribute name="t-att-dir">('rtl' if request.env['res.lang']._get_data(code=request.env.lang).direction == 'rtl' else 'ltr') if not ip_chrome else None</attribute>
    <attribute name="t-att-data-ip-smooth">'1' if not ip_chrome else None</attribute>
  </xpath>
  <xpath expr="//header" position="before"><t t-if="not ip_chrome">${pick('header')}</t></xpath>
  <xpath expr="//header" position="attributes"><attribute name="t-attf-class" add="#{'d-none' if not ip_chrome else ''}" separator=" "/></xpath>
  <xpath expr="//footer[@id='bottom']" position="before"><t t-if="not ip_chrome">${pick('footer')}${pick('floating')}</t></xpath>
  <xpath expr="//footer[@id='bottom']" position="attributes"><attribute name="t-attf-class" add="#{'d-none' if not ip_chrome else ''}" separator=" "/></xpath>
</data>`,
};

// 3. stylesheet and script, as built by Vite
const assets = readdirSync(resolve(dist, 'assets'));
const css = assets.find((f) => f.endsWith('.css'));
const js = assets.find((f) => f.endsWith('.js'));
writeFileSync(resolve(out, 'ip.css'), rebase(readFileSync(resolve(dist, 'assets', css), 'utf8')));
cpSync(resolve(dist, 'assets', js), resolve(out, 'ip.js'));

// 4. media to upload to Odoo (or to host elsewhere)
if (process.env.IP_NO_MEDIA !== '1') for (const dir of ['img', 'brand', 'fonts', 'media']) cpSync(resolve(dist, dir), resolve(out, 'media', dir), { recursive: true });

// 5. the shop, for tools/odoo/shop-setup.js: what to publish, in which language, with which image. Prices stay out: they are Odoo's.
const frCtx = { ...makeCtx('fr', content) };
const shop = {
  _doc: 'Catalogue de la boutique pour tools/odoo/shop-setup.js. Aucun prix : ils restent ceux d’Odoo. `odoo.match` sert à retrouver le produit existant par son nom.',
  base,
  categories: content.shop.categories.map((cat) => ({ id: cat.id, products: cat.products, names: Object.fromEntries(LANGS.map((l) => [l, content.langs[l].shop.list.categories[cat.id]])) })),
  delivery: content.shop.delivery.map((d) => ({ id: d.id, names: Object.fromEntries(LANGS.map((l) => [l, content.langs[l].shop.checkout.methods[d.id].name])) })),
  products: Object.fromEntries(
    PRODUCT_IDS.map((id) => {
      const spec = content.shop.products[id];
      const widths = content.images[PAGE_IMAGE[id]].widths;
      return [id, {
        mode: spec.mode,
        odoo: spec.odoo,
        category: content.shop.categories.find((cat) => cat.products.includes(id))?.id,
        image: `${base}/img/${PAGE_IMAGE[id]}-${widths[widths.length - 1]}.webp`,
        card: `${base}/img/${CARD_IMAGE[id]}-${content.images[CARD_IMAGE[id]].widths.at(-1)}.webp`,
        texts: Object.fromEntries(LANGS.map((l) => {
          const p = content.langs[l].products[id];
          return [l, { name: p.h1, paras: p.paras, specs: p.specs.map(([k, v]) => [content.langs[l].specLabels[k], v]) }];
        })),
        options: allProducts(frCtx)[id].option?.values.map((v) => v.label) ?? [],
      }];
    }),
  ),
};
writeFileSync(resolve(out, 'shop.json'), JSON.stringify(shop, null, 1));

writeFileSync(resolve(out, 'pages.json'), JSON.stringify({ base, prefix, chrome: withChrome, pages, layout: layoutPatch }, null, 1));
console.log(`odoo-pack/: ${count} fragments, layout patch, ip.css, ip.js, media/, shop.json (asset base: ${base || 'unchanged, paths start with /'})`);
