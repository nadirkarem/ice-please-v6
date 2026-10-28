// What the shop sells: one entry per product of the range, shaped for the templates and for src/shop.js.
// Texts come from content/<lang>.json (product names) and content/shop.<lang>.json (units, options); numbers and
// the Odoo mapping come from content/shop.json. A price of null means "not confirmed": it is shown as "-- MAD".
import { PRODUCT_IDS, urlFor } from './routes.mjs';

/** Which image shows a product on a card, and which one on its own page. */
export const CARD_IMAGE = {
  'cube-xl': 'cube-xl-card',
  'ice-stick': 'ice-stick-card',
  'moon-ball': 'moon-ball',
  'custom-ice': 'custom-ice',
  'gourmet-ice': 'gourmet-ice',
  'ice-slab': 'ice-slab',
  'crushed-ice': 'crushed-ice',
  'dry-ice': 'dry-ice-glass',
  'ice-stamp': 'ice-stamp',
};
export const PAGE_IMAGE = {
  'cube-xl': 'cube-xl-photo',
  'ice-stick': 'ice-stick-photo',
  'moon-ball': 'moon-ball',
  'custom-ice': 'custom-ice',
  'gourmet-ice': 'gourmet-ice',
  'ice-slab': 'ice-slab',
  'crushed-ice': 'crushed-ice',
  'dry-ice': 'dry-ice-pile',
  'ice-stamp': 'ice-stamp',
};

/** "No price yet" placeholder: the same in every language, as asked. */
export const NO_PRICE = '-- MAD';

const LOCALES = { fr: 'fr-MA', en: 'en-GB', ar: 'ar-MA' };

/** An amount, or the placeholder. In Arabic text the amount is isolated (LRI … PDI) so that "-- MAD" does not read "MAD --". */
export function money(lang, value, currency = 'MAD') {
  const text = value == null ? NO_PRICE : new Intl.NumberFormat(LOCALES[lang] ?? 'fr-MA', { style: 'currency', currency }).format(value);
  return lang === 'ar' ? `\u2066${text}\u2069` : text;
}

const trim = (n) => String(n).replace('.', ',');
/** 4.8 × 4.8 × 6.5 cm, with the decimal mark of the language (comma in French and Arabic, as in the existing texts). */
function dimsLabel(lang, dims) {
  const mark = (n) => (lang === 'en' ? String(n) : trim(n));
  const unit = lang === 'ar' ? 'سم' : 'cm';
  return `${dims.map(mark).join(' × ')} ${unit}`;
}

function optionOf(ctx, id) {
  const spec = ctx.shop.products[id].option;
  if (!spec) return null;
  const t = ctx.c.shop;
  const label = t.option[spec.key];
  if (spec.dims) return { key: spec.key, label, values: spec.dims.map((d) => ({ id: d.join('x'), label: dimsLabel(ctx.lang, d) })) };
  if (spec.kg) {
    const mark = (n) => (ctx.lang === 'en' ? String(n) : trim(n));
    return { key: spec.key, label, values: spec.kg.map((n) => ({ id: `${n}kg`, label: t.bagLabel.replace('{n}', mark(n)) })), default: `${spec.default}kg` };
  }
  return { key: spec.key, label, values: spec.ids.map((v) => ({ id: v, label: t.formats[v] })) };
}

/** One product, ready to render or to serialise for the browser. */
export function productInfo(ctx, id) {
  const spec = ctx.shop.products[id];
  const t = ctx.c.shop;
  const p = ctx.c.products[id];
  const img = CARD_IMAGE[id];
  const m = ctx.images[img];
  const width = m.widths[0];
  const unit = spec.unit ? t.unit[spec.unit] : '';
  return {
    id,
    name: p.h1.replace(/\*\*/g, ''), // the full name: "Ice stamps" rather than the card label "Accessoires"
    card: p.card,
    h1: p.h1,
    href: urlFor(`shop-${id}`, ctx.lang), // the product page of the shop
    presentation: urlFor(id, ctx.lang), // the editorial page of the range
    img: { src: `/img/${img}-${width}.webp`, w: m.w, h: m.h, alt: ctx.c.alt[img] ?? '' },
    mode: spec.mode,
    unit,
    unitKey: spec.unit ?? null,
    min: spec.min ?? 1,
    price: spec.price ?? null,
    option: optionOf(ctx, id),
    category: ctx.shop.categories.find((cat) => cat.products.includes(id))?.id ?? null,
  };
}

export const allProducts = (ctx) => Object.fromEntries(PRODUCT_IDS.map((id) => [id, productInfo(ctx, id)]));
