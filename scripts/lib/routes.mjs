// URL plan. Existing French URLs are kept as they are (no redirects needed, except the
// retired /espace-professionnels, see public/_redirects); English and Arabic live under
// /en/ and /ar/ with the same product slugs.

export const LANGS = ['fr', 'en', 'ar'];
export const DEFAULT_LANG = 'fr';

export const PRODUCT_IDS = ['cube-xl', 'ice-stick', 'moon-ball', 'custom-ice', 'gourmet-ice', 'ice-slab', 'crushed-ice', 'dry-ice', 'ice-stamp'];
export const FEATURED_IDS = PRODUCT_IDS.slice(0, 4);
export const MORE_IDS = PRODUCT_IDS.slice(4);

const same = (slug) => ({ fr: slug, en: slug, ar: slug });

/** The shop follows Odoo's own addresses (/shop, /shop/cart, /shop/checkout, /shop/payment, /shop/confirmation, /my, /web/login, /web/signup). */
export const SHOP_PRODUCT_IDS = PRODUCT_IDS.map((id) => `shop-${id}`); // /shop/cube-xl: the product page of the shop (price, options, quantity, cart)
export const SHOP_IDS = ['shop', ...SHOP_PRODUCT_IDS, 'cart', 'checkout', 'payment', 'simulate', 'confirmation'];
/** "shop-cube-xl" → "cube-xl", anything else → null. */
export const shopProductOf = (id) => (id.startsWith('shop-') && PRODUCT_IDS.includes(id.slice(5)) ? id.slice(5) : null);
export const ACCOUNT_IDS = ['login', 'signup', 'account'];
/** Pages that belong to a visit and not to the search results: never indexed, never in the sitemap. */
export const PRIVATE_IDS = ['cart', 'checkout', 'payment', 'simulate', 'confirmation', ...ACCOUNT_IDS];

/** page id → slug per language ('' = language root, missing language = page not translated) */
export const ROUTES = {
  home: { fr: '', en: '', ar: '' },
  glacons: { fr: 'glacons', en: 'ice', ar: 'ice' },
  savoir: { fr: 'savoir-faire', en: 'know-how', ar: 'know-how' },
  about: same('about-us'),
  contact: same('contactus'),
  privacy: { fr: 'politique-de-confidentialite' },
  terms: { fr: 'conditions-de-services' },
  cgv: { fr: 'conditions-generales-de-vente' },
  shop: same('shop'),
  ...Object.fromEntries(PRODUCT_IDS.map((id) => [`shop-${id}`, same(`shop/${id}`)])),
  cart: same('shop/cart'),
  checkout: same('shop/checkout'),
  payment: same('shop/payment'),
  simulate: same('shop/payment/simulate'),
  confirmation: same('shop/confirmation'),
  login: same('web/login'),
  signup: same('web/signup'),
  account: same('my'),
  ...Object.fromEntries(PRODUCT_IDS.map((id) => [id, same(id)])),
};

export const prefix = (lang) => (lang === DEFAULT_LANG ? '' : `${lang}/`);

export function pageUrl(id, lang) {
  const slug = ROUTES[id]?.[lang];
  if (slug === undefined) return null;
  return `/${prefix(lang)}${slug}${slug ? '/' : ''}`;
}

/** URL in `lang`, falling back to French for pages that only exist in French (legal texts). */
export const urlFor = (id, lang) => pageUrl(id, lang) ?? pageUrl(id, DEFAULT_LANG);

export const fileFor = (url) => (url === '/' ? 'index.html' : `${url.slice(1)}index.html`);
