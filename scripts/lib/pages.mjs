// Page templates. Each function returns the inner HTML of <main>.
// All class names are prefixed `ip-` so the same markup and CSS can be pasted into an Odoo page.
import { esc, md, waLink, picture, pictureResponsive } from './html.mjs';
import { icon } from './icons.mjs';
import { PRODUCT_IDS, FEATURED_IDS, MORE_IDS, urlFor } from './routes.mjs';
import { CARD_IMAGE, PAGE_IMAGE } from './catalog.mjs';
import * as shopPages from './shop-pages.mjs';

const alt = (ctx, id) => ctx.c.alt[id] ?? '';
/** Soft edge at the bottom of a photograph: colour ramp plus a progressive blur (see .ip-dissolve). */
const dissolve = () => '<div class="ip-dissolve ip-dissolve--bottom" aria-hidden="true"><i></i></div>';
const external = 'target="_blank" rel="noopener"';
const quoteUrl = (ctx) => `${urlFor('contact', ctx.lang)}#devis`;

// ---------------------------------------------------------------- components

function card(ctx, id, { sizes }) {
  const p = ctx.c.products[id];
  const img = CARD_IMAGE[id];
  return `<li class="ip-card">
      <a class="ip-card__link" href="${urlFor(id, ctx.lang)}">
        ${picture(ctx, img, { alt: alt(ctx, img), sizes })}
        <span class="ip-card__label"><span class="ip-card__name">${esc(p.card)}</span><span class="ip-card__go">${icon('arrow')}</span></span>
      </a>
    </li>`;
}

function tile(ctx, id) {
  const p = ctx.c.products[id];
  const img = CARD_IMAGE[id];
  return `<li class="ip-tile">
      <a class="ip-tile__link" href="${urlFor(id, ctx.lang)}">
        <span class="ip-tile__media">${picture(ctx, img, { alt: alt(ctx, img), sizes: '(min-width: 1000px) 22vw, (min-width: 640px) 45vw, 120px' })}</span>
        <span class="ip-tile__body">
          <span class="ip-tile__name">${esc(p.card)}</span>
          <span class="ip-tile__desc">${md(ctx, p.paras[0])}</span>
          <span class="ip-tile__go">${icon('arrow')}</span>
        </span>
      </a>
    </li>`;
}

/** Plain page title on a soft light band (used where there is no photograph). */
function pageHead(ctx, { title, lead, soft = false }) {
  return `<header class="ip-pagehead${soft ? ' ip-pagehead--soft' : ''}">
      <div class="ip-wrap">
        <h1 class="ip-pagehead__title">${md(ctx, title)}</h1>
        ${lead ? `<p class="ip-lead">${md(ctx, lead)}</p>` : ''}
      </div>
    </header>`;
}

/**
 * Page head with the photograph shown whole: text on the left, the picture in a rounded frame on the right
 * (stacked on phones). The picture is never cropped into a thin band, so the subject stays readable.
 */
function splitHead(ctx, { image, title, lead, focal }) {
  return `<header class="ip-splithead">
      <div class="ip-wrap ip-splithead__grid">
        <div class="ip-splithead__text">
          <h1 class="ip-pagehead__title">${md(ctx, title)}</h1>
          ${[lead ?? []].flat().map((t) => `<p class="ip-lead">${md(ctx, t)}</p>`).join('')}
        </div>
        <div class="ip-splithead__media">${picture(ctx, image, { alt: alt(ctx, image), priority: true, sizes: '(min-width: 900px) 42vw, 92vw', focal })}</div>
      </div>
    </header>`;
}

function ctaBand(ctx) {
  const { c } = ctx;
  return `<section class="ip-section ip-cta">
      <div class="ip-wrap ip-cta__inner">
        <h2 class="ip-cta__title">${esc(c.home.contact.title)}</h2>
        <div class="ip-cta__actions">
          <a class="ip-btn ip-btn--primary ip-btn--lg" href="${waLink(ctx, c.wa.generic)}" ${external}>${icon('whatsapp')}<span>${esc(c.ui.orderWhatsapp)}</span></a>
          <a class="ip-btn ip-btn--ghost ip-btn--lg" href="${urlFor('contact', ctx.lang)}"><span>${esc(c.ui.contactUs)}</span>${icon('arrow')}</a>
        </div>
      </div>
    </section>`;
}

function contactDetails(ctx) {
  const { c, site } = ctx;
  return `<ul class="ip-details">
      <li><a href="${waLink(ctx, c.wa.generic)}" ${external}><span class="ip-details__icon">${icon('whatsapp')}</span><span><span class="ip-details__label">${esc(c.ui.whatsapp)}</span><bdi class="ip-details__value" dir="ltr">${esc(site.phoneDisplay)}</bdi></span></a></li>
      <li><a href="tel:${site.phoneHref}"><span class="ip-details__icon">${icon('phone')}</span><span><span class="ip-details__label">${esc(c.ui.phone)}</span><bdi class="ip-details__value" dir="ltr">${esc(site.phoneDisplay)}</bdi></span></a></li>
      <li><a href="mailto:${site.email}"><span class="ip-details__icon">${icon('mail')}</span><span><span class="ip-details__label">${esc(c.ui.email)}</span><bdi class="ip-details__value" dir="ltr">${esc(site.email)}</bdi></span></a></li>
      <li><a href="${site.instagramUrl}" ${external}><span class="ip-details__icon">${icon('instagram')}</span><span><span class="ip-details__label">${esc(c.ui.instagram)}</span><bdi class="ip-details__value" dir="ltr">@${site.instagram}</bdi></span></a></li>
    </ul>`;
}

/**
 * Know-how as one continuous scene. A film opens from a window to full bleed with the title (the whisky glass), then
 * docks into a pinned frame while the four claims take turns beside it; the films of the four steps cross-fade inside
 * that frame as the visitor scrolls (filtration and osmosis, UV light, serving without contact, slow melt, which is the
 * glass of the opening again). Every film is a computer-generated render made for this site. Without script or under
 * reduced motion the same markup reads as a band followed by four stills with their claims.
 */
function saga(ctx, { id, title, text, name, label }) {
  const { c } = ctx;
  const claims = c.mentions;
  const steps = c.savoir.stepLabels;
  const films = [1, 2, 3, 4].map((n) => `<video class="ip-saga__film" muted loop playsinline preload="none" poster="/media/story-${n}-poster.jpg" tabindex="-1">
              <source src="/media/story-${n}.mp4" type="video/mp4">
              <source src="/media/story-${n}.webm" type="video/webm">
            </video>`).join('');
  const items = claims.map((claim, i) => `<li class="ip-saga__claim" data-ip-chapter data-step="${esc(steps[i])}">
            <img class="ip-saga__still" src="/media/story-${i + 1}-poster.jpg" width="900" height="1080" alt="" loading="lazy">
            <h3 class="ip-chapter__claim"><span class="ip-sr">${esc(steps[i])} : </span>${esc(claim)}</h3>
          </li>`).join('');
  const toggle = (cls) => `<button class="ip-saga__toggle ${cls}" type="button" data-ip-saga-toggle aria-pressed="false" data-pause="${esc(c.ui.videoPause)}" data-play="${esc(c.ui.videoPlay)}"><span data-label>${esc(c.ui.videoPause)}</span></button>`;
  return `<section class="ip-saga" data-ip-saga aria-labelledby="${id}">
      <div class="ip-saga__pin">
        <p class="ip-saga__title ip-saga__ghost" aria-hidden="true">${esc(title)}</p>
        <div class="ip-saga__stage">
          <div class="ip-saga__open">
            <img class="ip-saga__poster" src="/media/${name}-poster.jpg" alt="" width="1280" height="720" loading="lazy" aria-hidden="true">
            <video class="ip-saga__openvideo" muted loop playsinline preload="none" poster="/media/${name}-poster.jpg" aria-label="${esc(label)}">
              <source src="/media/${name}.mp4" type="video/mp4">
              <source src="/media/${name}.webm" type="video/webm">
            </video>
          </div>
          <div class="ip-saga__veil"></div>
          <h2 class="ip-saga__title" id="${id}">${esc(title)}</h2>
          <div class="ip-wrap ip-saga__intro"><p class="ip-lead">${md(ctx, text)}</p></div>
          ${toggle('ip-saga__toggle--open')}
          <div class="ip-saga__rect">
            <div class="ip-saga__films" aria-hidden="true">${films}</div>
            <div class="ip-saga__caption" aria-hidden="true">
              <span class="ip-saga__step" data-step>${esc(steps[0])}</span>
              <span class="ip-saga__bar"><span><span data-count>1</span> ${esc(c.ui.stepOf)} ${claims.length}</span><i></i></span>
            </div>
            ${toggle('ip-saga__toggle--rect')}
          </div>
        </div>
        <div class="ip-wrap ip-saga__claimswrap"><ol class="ip-saga__claims" aria-label="${esc(c.ui.steps)}">${items}</ol></div>
      </div>
    </section>`;
}

/**
 * Scroll-revealed film. The video starts as a small window in the page, opens to full bleed as the
 * visitor scrolls, and the title is revealed with it (an ink copy on the page, a white copy on the video,
 * cut by the same window). Without script or under reduced motion it is a plain full-bleed band.
 */
function reveal(ctx, { id, title, text, link, name, label }) {
  const { c } = ctx;
  return `<section class="ip-reveal" data-ip-reveal data-ip-video aria-labelledby="${id}">
      <div class="ip-reveal__stage">
        <p class="ip-reveal__title ip-reveal__title--page" aria-hidden="true">${esc(title)}</p>
        <div class="ip-reveal__media">
          <img class="ip-reveal__poster" src="/media/${name}-poster.jpg" alt="" width="1280" height="720" loading="lazy" aria-hidden="true">
          <video muted loop playsinline preload="none" poster="/media/${name}-poster.jpg" aria-label="${esc(label)}">
            <source src="/media/${name}.mp4" type="video/mp4">
            <source src="/media/${name}.webm" type="video/webm">
          </video>
          <div class="ip-reveal__veil"></div>
          <h2 class="ip-reveal__title" id="${id}">${esc(title)}</h2>
        </div>
        <div class="ip-wrap ip-reveal__body">
          <p class="ip-lead">${md(ctx, text)}</p>
          ${link ? `<a class="ip-link" href="${urlFor('savoir', ctx.lang)}"><span>${esc(link)}</span>${icon('arrow')}</a>` : ''}
        </div>
        <button class="ip-reveal__toggle" type="button" data-ip-video-toggle aria-pressed="false" data-pause="${esc(c.ui.videoPause)}" data-play="${esc(c.ui.videoPlay)}"><span data-label>${esc(c.ui.videoPause)}</span></button>
      </div>
    </section>`;
}

/**
 * Forms compose a WhatsApp message (no backend in the static draft).
 * Field names match Odoo's website form (name, phone, email_from, company, subject, description)
 * so the port only has to swap the handler.
 */
const FORM_FIELDS = {
  contact: [
    { key: 'name', odoo: 'name', required: true, autocomplete: 'name' },
    { key: 'phone', odoo: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel' },
    { key: 'email', odoo: 'email_from', type: 'email', required: true, autocomplete: 'email' },
    { key: 'company', odoo: 'company', autocomplete: 'organization' },
    { key: 'subject', odoo: 'subject', required: true, wide: true },
    { key: 'message', odoo: 'description', required: true, wide: true, textarea: true },
  ],
  quote: [
    { key: 'name', odoo: 'name', required: true, autocomplete: 'name' },
    { key: 'phone', odoo: 'phone', type: 'tel', required: true, autocomplete: 'tel', inputmode: 'tel' },
    { key: 'email', odoo: 'email_from', type: 'email', autocomplete: 'email' },
    { key: 'venue', odoo: 'company', required: true, autocomplete: 'organization' },
    { key: 'city', odoo: 'city', required: true, autocomplete: 'address-level2' },
    { key: 'date', odoo: 'date', type: 'date' },
    { key: 'needs', odoo: 'description', required: true, wide: true, textarea: true },
  ],
};

function form(ctx, kind) {
  const { c, site } = ctx;
  const f = c.forms[kind];
  const fields = FORM_FIELDS[kind]
    .map((field) => {
      const id = `f-${kind}-${field.key}`;
      const label = f.fields[field.key];
      const attrs = [
        `id="${id}"`,
        `name="${field.odoo}"`,
        `data-label="${esc(label)}"`,
        field.required ? 'required' : '',
        field.autocomplete ? `autocomplete="${field.autocomplete}"` : '',
        field.inputmode ? `inputmode="${field.inputmode}"` : '',
        `aria-describedby="${id}-err"`,
      ].filter(Boolean).join(' ');
      const control = field.textarea
        ? `<textarea ${attrs} rows="4"></textarea>`
        : `<input ${attrs} type="${field.type ?? 'text'}">`;
      return `<div class="ip-field${field.wide ? ' ip-field--wide' : ''}">
          <label for="${id}">${esc(label)}${field.required ? ' <span class="ip-req" aria-hidden="true">*</span>' : ''}</label>
          ${control}
          <p class="ip-field__error" id="${id}-err" hidden></p>
        </div>`;
    })
    .join('');
  return `<form class="ip-form" data-ip-form="${kind}" data-wa="https://wa.me/${site.whatsapp}" data-greeting="${esc(f.greeting)}" data-required="${esc(c.forms.required)}" data-invalid-email="${esc(c.forms.invalidEmail)}" data-invalid-phone="${esc(c.forms.invalidPhone)}" data-status="${esc(c.forms.status)}" data-blocked="${esc(c.forms.blocked)}" novalidate>
      <div class="ip-form__grid">${fields}</div>
      <button class="ip-btn ip-btn--primary ip-btn--lg ip-form__submit" type="submit">${icon('whatsapp')}<span>${esc(c.ui.send)}</span></button>
      <p class="ip-form__status" role="status" aria-live="polite"></p>
    </form>`;
}

/** Contact form with a switch between a general question and a professional quote request. */
function contactPanel(ctx) {
  const { c } = ctx;
  const t = c.contact.tabs;
  return `<div class="ip-panel" id="devis" data-ip-tabs>
        <div class="ip-tabs" role="tablist" aria-label="${esc(c.contact.title)}">
          <button class="ip-tab" role="tab" type="button" id="tab-message" aria-controls="panel-message" aria-selected="true" data-hash="">${esc(t.message)}</button>
          <button class="ip-tab" role="tab" type="button" id="tab-quote" aria-controls="panel-quote" aria-selected="false" tabindex="-1" data-hash="devis">${esc(t.quote)}</button>
        </div>
        <div role="tabpanel" id="panel-message" aria-labelledby="tab-message">${form(ctx, 'contact')}</div>
        <div role="tabpanel" id="panel-quote" aria-labelledby="tab-quote">${form(ctx, 'quote')}</div>
      </div>`;
}

/** Five posts chosen by the client from the company's Instagram profile; every tile opens the profile. */
function instagram(ctx) {
  const { c, site } = ctx;
  const tiles = [1, 2, 3, 4, 5]
    .map((i) => `<li><a class="ip-insta__tile" href="${site.instagramUrl}" ${external}>${picture(ctx, `insta-${i}`, { alt: alt(ctx, `insta-${i}`), sizes: '(min-width: 900px) 330px, 46vw' })}</a></li>`)
    .join('');
  return `<section class="ip-section ip-insta" aria-labelledby="h-insta">
      <div class="ip-wrap ip-insta__wrap" data-reveal>
        <div class="ip-insta__head">
          <h2 id="h-insta">${esc(c.home.instagram.title)}</h2>
          <p class="ip-insta__who"><span class="ip-insta__avatar"><img src="/brand/logo.webp" width="640" height="485" alt=""></span><bdi class="ip-insta__handle" dir="ltr">@${site.instagram}</bdi></p>
          <a class="ip-btn ip-btn--dark" href="${site.instagramUrl}" ${external}>${icon('instagram')}<span>${esc(c.ui.instagramView)}</span></a>
        </div>
        <ul class="ip-insta__grid">${tiles}</ul>
      </div>
    </section>`;
}

// ---------------------------------------------------------------- pages

export function home(ctx) {
  const { c, lang } = ctx;
  const h = c.home;
  const cardSizesTall = '(min-width: 1000px) 24vw, (min-width: 640px) 36vw, 74vw';
  const cardSizesWide = '(min-width: 1000px) 24vw, 44vw';
  return `
    <section class="ip-hero">
      <div class="ip-hero__media">${pictureResponsive(ctx, 'hero', 'hero-tall', { alt: alt(ctx, 'hero'), priority: true, sizes: '100vw' })}</div>
      <div class="ip-hero__shade" aria-hidden="true"></div>
      <div class="ip-hero__veil" aria-hidden="true"></div>
      <div class="ip-wrap ip-hero__body">
        <h1 class="ip-hero__title">${md(ctx, h.heroTitle)}</h1>
        <p class="ip-hero__sub">${md(ctx, h.heroSub)}</p>
        <div class="ip-hero__cta">
          <a class="ip-btn ip-btn--primary ip-btn--lg" href="${urlFor('shop', lang)}">${icon('bag')}<span>${esc(c.ui.shopOrder)}</span></a>
          <a class="ip-btn ip-btn--glass ip-btn--lg" href="#nos-glacons"><span>${esc(c.ui.seeIce)}</span></a>
        </div>
      </div>
      ${dissolve()}
    </section>

    <section class="ip-section ip-intro">
      <div class="ip-wrap"><p class="ip-intro__text" data-reveal>${md(ctx, h.intro)}</p></div>
    </section>

    ${reveal(ctx, { id: 'h-craft', title: h.savoir.title, text: h.savoir.text, link: h.savoir.link, name: 'ice-hero', label: c.ui.videoLabel })}

    <section class="ip-section ip-ice" id="nos-glacons" aria-labelledby="h-ice">
      <div class="ip-wrap">
        <div class="ip-sectionhead" data-reveal>
          <h2 id="h-ice">${esc(h.productsTitle)}</h2>
          <a class="ip-link" href="${urlFor('glacons', lang)}"><span>${esc(c.ui.seeAll)}</span>${icon('arrow')}</a>
        </div>
      </div>
      <ul class="ip-rail" data-reveal>${FEATURED_IDS.map((id) => card(ctx, id, { sizes: cardSizesTall })).join('')}</ul>
      <div class="ip-wrap">
        <ul class="ip-grid ip-grid--more" style="--cols:${Math.min(MORE_IDS.length, 5)}" data-reveal>${MORE_IDS.map((id) => card(ctx, id, { sizes: cardSizesWide })).join('')}</ul>
      </div>
    </section>


    ${instagram(ctx)}

    <section class="ip-section ip-contact" id="contact" aria-labelledby="h-contact">
      <div class="ip-wrap ip-contact__grid">
        <div class="ip-contact__intro" data-reveal>
          <h2 id="h-contact">${esc(h.contact.title)}</h2>
          ${h.contact.paras.map((p) => `<p class="ip-lead">${md(ctx, p)}</p>`).join('')}
          ${contactDetails(ctx)}
        </div>
        <div class="ip-panel" data-reveal>${form(ctx, 'contact')}</div>
      </div>
    </section>`;
}

export function glacons(ctx) {
  const { c } = ctx;
  return `
    ${splitHead(ctx, { image: 'cube-xl-photo', title: c.glacons.title, lead: c.glacons.lead })}
    <section class="ip-section ip-section--tight">
      <div class="ip-wrap"><ul class="ip-tiles">${PRODUCT_IDS.map((id) => tile(ctx, id)).join('')}</ul></div>
    </section>
    ${shopPages.pointerBand(ctx)}`;
}

export function product(ctx, page) {
  const { c, lang } = ctx;
  const id = page.id;
  const p = c.products[id];
  const img = PAGE_IMAGE[id];
  const at = PRODUCT_IDS.indexOf(id);
  const related = [1, 2, 3, 4].map((n) => PRODUCT_IDS[(at + n) % PRODUCT_IDS.length]);
  const specs = p.specs.length
    ? `<div class="ip-specs"><h2 class="ip-specs__title">${esc(c.ui.specs)}</h2><dl>${p.specs
        .map(([key, value]) => `<div><dt>${esc(c.specLabels[key])}</dt><dd>${md(ctx, value)}</dd></div>`)
        .join('')}</dl></div>`
    : '';
  return `
    <article class="ip-product">
      <div class="ip-wrap ip-product__grid">
        <div class="ip-product__media">${picture(ctx, img, { alt: alt(ctx, img), priority: true, sizes: '(min-width: 900px) 46vw, 100vw' })}</div>
        <div class="ip-product__body">
          <nav class="ip-crumbs" aria-label="${esc(c.nav.glacons)}">
            <a href="${urlFor('home', lang)}">${esc(c.ui.home)}</a><span aria-hidden="true">/</span><a href="${urlFor('glacons', lang)}">${esc(c.ui.ice)}</a>
          </nav>
          <h1 class="ip-product__title">${md(ctx, p.h1)}</h1>
          <p class="ip-lead">${md(ctx, p.paras[0])}</p>
          ${shopPages.pointer(ctx, id)}
          ${p.paras.slice(1).map((t) => `<p>${md(ctx, t)}</p>`).join('')}
          ${specs}
        </div>
      </div>
    </article>
    <section class="ip-section ip-related" aria-labelledby="h-related">
      <div class="ip-wrap"><div class="ip-sectionhead"><h2 id="h-related">${esc(c.ui.related)}</h2></div></div>
      <ul class="ip-rail ip-rail--related">${related.map((r) => card(ctx, r, { sizes: '(min-width: 1000px) 24vw, 70vw' })).join('')}</ul>
    </section>
    ${shopPages.pointerBar(ctx, id)}`;
}

export function savoir(ctx) {
  const { c } = ctx;
  const s = c.savoir;
  return `
    ${splitHead(ctx, { image: 'ice-stick-photo', title: s.title, lead: s.paras })}
    ${saga(ctx, { id: 'h-art', title: s.artTitle, text: s.artText, name: 'ice-whisky', label: c.ui.videoLabelGlass })}
    ${ctaBand(ctx)}`;
}

/** One photograph per About section: the craft (the company's own photo), then the range. */
const ABOUT_IMAGES = ['about-art', 'hero'];

export function about(ctx) {
  const { c } = ctx;
  const a = c.about;
  return `
    ${pageHead(ctx, { title: a.title, soft: true })}
    ${a.sections
      .map((sec, i) => `<section class="ip-section ip-section--tight ip-about">
      <div class="ip-wrap ip-about__split${i % 2 ? ' ip-about__split--flip' : ''}">
        <div class="ip-about__media" data-reveal>${picture(ctx, ABOUT_IMAGES[i], { alt: alt(ctx, ABOUT_IMAGES[i]), sizes: '(min-width: 900px) 40vw, 92vw' })}</div>
        <div class="ip-about__body" data-reveal>
          <h2>${esc(sec.title)}</h2>
          <p class="ip-lead">${md(ctx, sec.paras[0])}</p>
          ${sec.paras.slice(1).map((t) => `<p>${md(ctx, t)}</p>`).join('')}
        </div>
      </div>
    </section>`)
      .join('')}
    ${ctaBand(ctx)}`;
}

export function contact(ctx) {
  const { c } = ctx;
  return `
    ${pageHead(ctx, { title: c.contact.title, soft: true })}
    <section class="ip-section ip-section--tight ip-contact">
      <div class="ip-wrap ip-contact__grid">
        <div class="ip-contact__intro" data-reveal>
          <p class="ip-lead">${md(ctx, c.contact.clients)}</p>
          ${c.contact.paras.map((p) => `<p>${md(ctx, p)}</p>`).join('')}
          ${contactDetails(ctx)}
        </div>
        <div data-reveal>${contactPanel(ctx)}</div>
      </div>
    </section>
    ${instagram(ctx)}`;
}

export function legal(ctx, page) {
  const doc = ctx.legal[page.id];
  return `
    ${pageHead(ctx, { title: doc.title })}
    <section class="ip-section ip-section--tight">
      <div class="ip-wrap ip-prose ip-prose--legal">
        ${doc.blocks.map(([tag, text]) => `<${tag}>${md(ctx, text)}</${tag}>`).join('')}
      </div>
    </section>`;
}

export function notFound(ctx) {
  const { c, lang } = ctx;
  return `
    <section class="ip-notfound">
      <div class="ip-wrap">
        <h1 class="ip-pagehead__title">${esc(c.notFound.title)}</h1>
        <a class="ip-btn ip-btn--primary ip-btn--lg" href="${urlFor('home', lang)}"><span>${esc(c.notFound.back)}</span>${icon('arrow')}</a>
      </div>
    </section>`;
}

export const RENDERERS = {
  home, glacons, savoir, about, contact,
  privacy: legal, terms: legal, cgv: legal, notFound,
  shop: shopPages.shop, ...Object.fromEntries(PRODUCT_IDS.map((id) => [`shop-${id}`, shopPages.shopProduct])), cart: shopPages.cart, checkout: shopPages.checkout, payment: shopPages.payment,
  simulate: shopPages.simulate, confirmation: shopPages.confirmation,
  login: shopPages.login, signup: shopPages.signup, account: shopPages.account,
  ...Object.fromEntries(PRODUCT_IDS.map((id) => [id, product])),
};
