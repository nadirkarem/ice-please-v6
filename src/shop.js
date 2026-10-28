/* Shop (static draft): a working copy of the Odoo shop flow, nothing more.
   Catalogue, cart, delivery, payment through a SIMULATED provider page (yes / no), confirmation, demo account.
   Everything lives in localStorage; nothing leaves the browser. In Odoo none of this runs: the shop there is Odoo's own
   (the pages that carry data-ip-shop do not exist in the Odoo pack, and the buy box links to Odoo's product page).

   Page data comes from the JSON block #ip-shop-data written by scripts/lib/shop-pages.mjs (catalogue in the page
   language, texts, routes). The block sits inside <main>, so the client-side router swaps it with the page.

   Flow, with the Odoo address it stands for:
     /shop  →  product page (buy box)  →  /shop/cart  →  /shop/checkout  →  /shop/payment
        →  (card) provider page, here /shop/payment/simulate  →  /shop/confirmation  (paid, pending or failed) */

const KEYS = {
  cart: 'ip.cart.v1', // [{ id, option, qty }]
  checkout: 'ip.checkout.v1', // contact, address, delivery
  order: 'ip.order.v1', // the draft order of the current cart (kept while a payment fails)
  orders: 'ip.orders.v1', // confirmed or pending orders (the account page)
  seq: 'ip.seq.v1',
  last: 'ip.last.v1', // what the confirmation page shows
  user: 'ip.user.v1',
};

/* ---- storage: localStorage when it works, memory when it does not (private windows) ------------------------- */
const mem = new Map();
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch { /* fall through to memory */ }
  return mem.has(key) ? JSON.parse(mem.get(key)) : fallback;
};
const write = (key, value) => {
  mem.set(key, JSON.stringify(value));
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* memory only */ }
};
const drop = (key) => {
  mem.delete(key);
  try { localStorage.removeItem(key); } catch { /* memory only */ }
};

/* ---- helpers ------------------------------------------------------------------------------------------------ */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c]);
const svg = (d) => `<svg class="ip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  check: svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>'),
};
const root = () => document.querySelector('.ip');
const base = () => (document.querySelector('meta[name="ip-base"]')?.getAttribute('content') || '/').replace(/\/$/, '');
const abs = (path) => base() + path;

let data = null; // the JSON block of the current page
const LOCALES = { fr: 'fr-MA', en: 'en-GB', ar: 'ar-MA' };
const NO_PRICE = '-- MAD';

function tr(path, vars) {
  const v = path.split('.').reduce((o, k) => o?.[k], data?.t);
  if (typeof v !== 'string') return path;
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : v;
}
/* In Arabic text an amount is isolated (LRI … PDI) so that "-- MAD" does not read "MAD --". */
const money = (value) => {
  const text = value == null ? NO_PRICE : new Intl.NumberFormat(LOCALES[data.lang] || 'fr-MA', { style: 'currency', currency: data.currency }).format(value);
  return data.lang === 'ar' ? `\u2066${text}\u2069` : text;
};
const when = (iso) => new Intl.DateTimeFormat(LOCALES[data.lang] || 'fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Go to a page of the site: through the router when it is there (no reload), else the browser. */
function navigate(path) {
  const href = abs(path);
  const host = root();
  if (host?.hasAttribute('data-ip-router')) {
    const a = document.createElement('a');
    a.href = href;
    a.hidden = true;
    a.setAttribute('data-ip-instant', '');
    host.append(a);
    a.click();
    a.remove();
  } else {
    location.assign(href);
  }
}
const link = (route) => abs(data.routes[route]);

/* ---- cart --------------------------------------------------------------------------------------------------- */
const cartLines = () => read(KEYS.cart, []);
const sameLine = (a, b) => a.id === b.id && (a.option || '') === (b.option || '');
const cartCount = () => cartLines().reduce((n, l) => n + l.qty, 0);

function saveCart(lines) {
  write(KEYS.cart, lines);
  updateBadges();
}
function addToCart(id, option, qty) {
  const lines = cartLines();
  const line = lines.find((l) => sameLine(l, { id, option }));
  if (line) line.qty += qty;
  else lines.push({ id, option: option || '', qty });
  saveCart(lines);
}

function updateBadges() {
  const n = cartCount();
  document.querySelectorAll('[data-ip-cart-count]').forEach((badge) => {
    badge.textContent = String(n);
    badge.hidden = n === 0;
  });
  document.querySelectorAll('[data-ip-cart]').forEach((a) => {
    if (a.dataset.aria) a.setAttribute('aria-label', a.dataset.aria.replace('{n}', String(n)));
  });
}

/** Everything the pages show about one cart or order line. */
function view(line) {
  const p = data.products[line.id];
  if (!p) return null;
  const option = p.option && line.option ? p.option.values.find((v) => v.id === line.option) : null;
  const unitPrice = 'price' in line ? line.price : p.price;
  return { p, option, unitPrice, total: unitPrice == null ? null : unitPrice * line.qty };
}

function totals(lines, deliveryId) {
  let sub = 0;
  let known = lines.length > 0;
  for (const l of lines) {
    const v = view(l);
    if (!v || v.total == null) known = false;
    else sub += v.total;
  }
  const delivery = deliveryId ? data.delivery.find((d) => d.id === deliveryId) : null;
  const fee = delivery ? delivery.fee : undefined; // undefined: not chosen yet
  const total = known && (fee === undefined || fee !== null) ? sub + (fee || 0) : null;
  return { sub: known ? sub : null, fee, total, count: lines.reduce((n, l) => n + l.qty, 0) };
}

function paintTotals(scope, lines, deliveryId) {
  const sum = totals(lines, deliveryId);
  const set = (sel, text) => scope.querySelectorAll(sel).forEach((el) => { el.textContent = text; });
  set('[data-ip-subtotal]', money(sum.sub));
  set('[data-ip-delivery]', sum.fee === undefined ? tr('cart.deliveryLater') : money(sum.fee));
  set('[data-ip-total]', money(sum.total));
  return sum;
}

/* ---- toast -------------------------------------------------------------------------------------------------- */
let toastTimer = 0;
function toast(message, { href, label, undo } = {}) {
  const host = root();
  if (!host) return;
  let el = host.querySelector('.ip-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'ip-toast';
    el.setAttribute('role', 'status');
    host.append(el);
  }
  el.innerHTML = `<span class="ip-toast__text">${esc(message)}</span>${href ? `<a class="ip-toast__link" href="${esc(href)}">${esc(label)}</a>` : ''}${undo ? `<button class="ip-toast__link" type="button" data-undo>${esc(undo.label)}</button>` : ''}`;
  el.querySelector('[data-undo]')?.addEventListener('click', () => { undo.run(); el.classList.remove('is-in'); });
  requestAnimationFrame(() => el.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-in'), 7000);
}

/* ---- forms: the same rules and messages as the contact form ------------------------------------------------- */
function checkField(field) {
  const value = field.value.trim();
  if (field.required && !value) return tr('forms.required');
  if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return tr('forms.invalidEmail');
  if (value && field.type === 'tel' && !/^[+()\d][\d\s().-]{5,}$/.test(value)) return tr('forms.invalidPhone');
  if (value && field.type === 'password' && value.length < 6) return tr('account.invalidPassword');
  return '';
}
function showFieldError(field, message) {
  const error = document.getElementById(`${field.id}-err`);
  if (error) {
    error.hidden = !message;
    error.textContent = message;
  }
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
}
/** Validate every field of a form; focus the first wrong one. Returns true when all is well. */
function validateForm(form) {
  let first = null;
  form.querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea, select').forEach((field) => {
    if (field.closest('[hidden]')) return;
    const message = checkField(field);
    showFieldError(field, message);
    if (message && !first) first = field;
  });
  first?.focus();
  return !first;
}
function bindLiveValidation(form) {
  form.addEventListener('input', (e) => {
    const f = e.target;
    if (f.getAttribute?.('aria-invalid') === 'true') showFieldError(f, checkField(f));
  });
}

/* ---- product page: buy box ---------------------------------------------------------------------------------- */
function stepQty(input, delta, min) {
  const now = /^\d+$/.test(input.value.trim()) ? parseInt(input.value.trim(), 10) : min;
  input.value = String(Math.max(min, now + delta));
}

function initBuy(box) {
  const id = box.dataset.product;
  const info = data.products[id];
  const input = box.querySelector('.ip-qty__input');
  const select = box.querySelector('[data-ip-option]');
  const error = box.querySelector('.ip-buy__error');
  const min = info.min;
  const fail = (message, field) => {
    error.textContent = message;
    error.hidden = false;
    field?.setAttribute('aria-invalid', 'true');
    field?.focus();
  };
  const reset = () => {
    error.hidden = true;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    select?.removeAttribute('aria-invalid');
  };

  box.addEventListener('click', (e) => {
    const step = e.target.closest('[data-ip-qty]');
    if (step) {
      reset();
      stepQty(input, Number(step.dataset.ipQty), min);
      return;
    }
    if (!e.target.closest('[data-ip-add]')) return;
    reset();
    if (select && !select.value) return fail(tr('buy.optionError'), select);
    const raw = input.value.trim();
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) < 1) return fail(tr('buy.qtyError'), input);
    const qty = parseInt(raw, 10);
    if (qty < min) return fail(tr('buy.minError', { n: min, unit: info.unit }), input);
    addToCart(id, select?.value || '', qty);
    toast(tr('buy.added', { name: info.name }), { href: link('cart'), label: tr('buy.viewCart') });
  });
  input.addEventListener('input', reset);
  select?.addEventListener('change', reset);

  // the sticky bar of phones, for products that need no choice
  document.querySelectorAll('[data-ip-bar-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      addToCart(btn.dataset.ipBarAdd, '', info.min);
      toast(tr('buy.added', { name: info.name }), { href: link('cart'), label: tr('buy.viewCart') });
    });
  });
}

/* ---- listing: categories, search, quick add ----------------------------------------------------------------- */
function initList(section) {
  const cards = [...section.querySelectorAll('.ip-pcard')];
  const grid = section.querySelector('[data-ip-grid]');
  const count = section.querySelector('[data-ip-count]');
  const empty = section.querySelector('[data-ip-empty]');
  const chips = [...section.querySelectorAll('[data-ip-filter]')];
  const search = section.querySelector('[data-ip-search]');
  let category = '';
  let query = '';

  const apply = () => {
    let n = 0;
    cards.forEach((card) => {
      const ok = (!category || card.dataset.cat === category) && (!query || card.dataset.search.includes(query));
      card.hidden = !ok;
      if (ok) n += 1;
    });
    count.textContent = count.dataset.template.replace('{n}', String(n));
    empty.hidden = n !== 0;
    grid.hidden = n === 0;
  };
  chips.forEach((chip) => chip.addEventListener('click', () => {
    category = chip.dataset.ipFilter;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    apply();
  }));
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); apply(); });
  section.querySelector('[data-ip-reset]')?.addEventListener('click', () => {
    search.value = '';
    query = '';
    category = '';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.ipFilter === '')));
    apply();
    search.focus();
  });
  section.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-ip-quick]');
    if (!quick) return;
    const id = quick.dataset.ipQuick;
    addToCart(id, '', data.products[id].min);
    toast(tr('buy.added', { name: data.products[id].name }), { href: link('cart'), label: tr('buy.viewCart') });
  });
  apply();
}

/* ---- cart page ---------------------------------------------------------------------------------------------- */
const qtyHtml = (id, qty, min) => `<div class="ip-qty" role="group" aria-label="${esc(tr('buy.qty'))}">
      <button class="ip-qty__btn" type="button" data-ip-qty="-1" aria-label="${esc(tr('buy.qtyMinus'))}">${ICON.minus}</button>
      <input class="ip-qty__input" id="${id}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${qty}" data-min="${min}" aria-label="${esc(tr('buy.qty'))}">
      <button class="ip-qty__btn" type="button" data-ip-qty="1" aria-label="${esc(tr('buy.qtyPlus'))}">${ICON.plus}</button>
    </div>`;

function lineHtml(l, i) {
  const v = view(l);
  if (!v) return '';
  const { p, option } = v;
  return `<li class="ip-line" data-id="${esc(l.id)}" data-option="${esc(l.option || '')}">
      <a class="ip-line__media" href="${esc(abs(p.href))}" tabindex="-1" aria-hidden="true"><img src="${esc(abs(p.img.src))}" width="${p.img.w}" height="${p.img.h}" alt="" loading="lazy"></a>
      <div class="ip-line__main">
        <h2 class="ip-line__name"><a href="${esc(abs(p.href))}">${esc(p.name)}</a></h2>
        ${option ? `<p class="ip-line__opt">${esc(p.option.label)} : ${esc(option.label)}</p>` : ''}
        <p class="ip-line__unit">${esc(money(v.unitPrice))}${p.unit ? ` / ${esc(p.unit)}` : ''}</p>
        <button class="ip-line__remove" type="button" data-ip-remove aria-label="${esc(tr('cart.removeAria', { name: p.name }))}">${esc(tr('cart.remove'))}</button>
      </div>
      <div class="ip-line__qty">${qtyHtml(`qty-${i}`, l.qty, p.min)}<p class="ip-field__error" role="alert" hidden></p></div>
      <p class="ip-line__total"><span class="ip-sr">${esc(tr('cart.lineTotal'))} : </span>${esc(money(v.total))}</p>
    </li>`;
}

function initCart(section) {
  const list = section.querySelector('[data-ip-lines]');
  const empty = section.querySelector('[data-ip-empty]');
  const items = section.querySelector('[data-ip-items]');
  const summary = section.querySelector('[data-ip-summary]');
  const cta = section.querySelector('[data-ip-checkout]');
  const quote = section.querySelector('[data-ip-cart-quote]');

  const render = () => {
    const lines = cartLines().filter((l) => data.products[l.id]);
    list.innerHTML = lines.map(lineHtml).join('');
    const sum = paintTotals(summary, lines);
    const has = lines.length > 0;
    empty.hidden = has;
    list.hidden = !has;
    summary.hidden = !has;
    items.textContent = has ? tr('cart.items', { n: sum.count }) : '';
    cta.toggleAttribute('aria-disabled', !has);
    if (has) {
      const body = lines.map((l) => {
        const v = view(l);
        return `• ${v.p.name}${v.option ? ` (${v.option.label})` : ''} × ${l.qty}${v.p.unit ? ` ${v.p.unit}` : ''}`;
      });
      quote.href = `${data.wa}?text=${encodeURIComponent([tr('cart.quoteIntro'), ...body].join('\n'))}`;
      quote.target = '_blank';
      quote.rel = 'noopener';
    }
  };

  const lineOf = (el) => {
    const li = el.closest('.ip-line');
    return li ? { id: li.dataset.id, option: li.dataset.option, li } : null;
  };
  const update = (target, qty) => {
    const lines = cartLines();
    const line = lines.find((l) => sameLine(l, target));
    if (!line) return;
    line.qty = qty;
    saveCart(lines);
  };
  const setQty = (li, target, raw) => {
    const min = data.products[target.id].min;
    const error = li.querySelector('.ip-field__error');
    const text = String(raw).trim();
    let message = '';
    if (!/^\d+$/.test(text) || parseInt(text, 10) < 1) message = tr('buy.qtyError');
    else if (parseInt(text, 10) < min) message = tr('buy.minError', { n: min, unit: data.products[target.id].unit });
    if (message) {
      error.textContent = message;
      error.hidden = false;
      li.querySelector('.ip-qty__input').setAttribute('aria-invalid', 'true');
      return false;
    }
    update(target, parseInt(text, 10));
    render();
    return true;
  };

  list.addEventListener('click', (e) => {
    const target = lineOf(e.target);
    if (!target) return;
    const step = e.target.closest('[data-ip-qty]');
    if (step) {
      const input = target.li.querySelector('.ip-qty__input');
      const now = /^\d+$/.test(input.value.trim()) ? parseInt(input.value.trim(), 10) : data.products[target.id].min;
      if (setQty(target.li, target, String(now + Number(step.dataset.ipQty)))) {
        // the list was drawn again: put the focus back on the same button of the same line
        const again = [...list.children].find((n) => n.dataset.id === target.id && n.dataset.option === target.option);
        again?.querySelectorAll('.ip-qty__btn')[Number(step.dataset.ipQty) > 0 ? 1 : 0]?.focus();
      }
      return;
    }
    if (e.target.closest('[data-ip-remove]')) {
      const lines = cartLines();
      const index = lines.findIndex((l) => sameLine(l, target));
      const [removed] = lines.splice(index, 1);
      saveCart(lines);
      render();
      toast(tr('cart.removed', { name: data.products[target.id].name }), {
        undo: { label: tr('cart.undo'), run: () => { const again = cartLines(); again.splice(index, 0, removed); saveCart(again); render(); } },
      });
      (list.querySelector('.ip-line__remove') || section.querySelector('a.ip-btn'))?.focus();
    }
  });
  list.addEventListener('change', (e) => {
    const input = e.target.closest('.ip-qty__input');
    const target = input && lineOf(input);
    if (target) setQty(target.li, target, input.value);
  });
  cta.addEventListener('click', (e) => { if (cta.hasAttribute('aria-disabled')) e.preventDefault(); });
  render();
}

/* ---- checkout (delivery) ------------------------------------------------------------------------------------ */
function renderSumLines(scope, lines) {
  const ul = scope.querySelector('[data-ip-sum-lines]');
  if (!ul) return;
  ul.innerHTML = lines.map((l) => {
    const v = view(l);
    return v ? `<li><span class="ip-sum-line__name">${esc(v.p.name)}${v.option ? `<small>${esc(v.option.label)}</small>` : ''}</span><span class="ip-sum-line__qty">× ${l.qty}</span><span class="ip-sum-line__price">${esc(money(v.total))}</span></li>` : '';
  }).join('');
}
const deliveryOf = (id) => data.delivery.find((d) => d.id === id);

function initCheckout(section) {
  const lines = cartLines().filter((l) => data.products[l.id]);
  if (!lines.length) { navigate(data.routes.cart); return; }
  const form = section.querySelector('[data-ip-checkout-form]');
  const summary = section.querySelector('[data-ip-summary]');
  const user = read(KEYS.user, null);
  const saved = read(KEYS.checkout, null) || {};
  const set = (name, value) => { const f = form.elements[name]; if (f && value != null) f.value = value; };
  set('name', saved.name ?? user?.name);
  set('email', saved.email ?? user?.email);
  set('phone', saved.phone);
  set('company', saved.company ?? user?.company);
  set('ice', saved.ice ?? user?.ice);
  ['street', 'city', 'zip', 'date', 'note'].forEach((n) => set(n, saved[n]));
  const today = new Date();
  form.elements.date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const radio = form.querySelector(`input[name="delivery"][value="${saved.delivery}"]`);
  if (radio) radio.checked = true;
  if (user) section.querySelector('[data-ip-accounthint]')?.setAttribute('hidden', '');

  renderSumLines(summary, lines);
  const refresh = () => paintTotals(summary, lines, form.elements.delivery.value);
  form.addEventListener('change', (e) => { if (e.target.name === 'delivery') refresh(); });
  refresh();
  bindLiveValidation(form);

  const banner = form.querySelector('[data-ip-form-error]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    banner.hidden = true;
    if (!validateForm(form)) { banner.hidden = false; return; }
    const v = (n) => form.elements[n].value.trim();
    write(KEYS.checkout, { name: v('name'), phone: v('phone'), email: v('email'), company: v('company'), ice: v('ice'), street: v('street'), city: v('city'), zip: v('zip'), date: v('date'), note: v('note'), delivery: form.elements.delivery.value });
    navigate(data.routes.payment);
  });
}

/* ---- payment ------------------------------------------------------------------------------------------------ */
function nextRef() {
  const n = read(KEYS.seq, 0) + 1;
  write(KEYS.seq, n);
  return `S${String(n).padStart(5, '0')}`;
}
const snapshot = (lines) => lines.map((l) => ({ id: l.id, option: l.option || '', qty: l.qty, price: data.products[l.id]?.price ?? null }));

function addressText(c) {
  return [c.street, [c.zip, c.city].filter(Boolean).join(' '), c.note].filter(Boolean).join(', ');
}

function initPayment(section) {
  const lines = cartLines().filter((l) => data.products[l.id]);
  const checkout = read(KEYS.checkout, null);
  if (!lines.length) { navigate(data.routes.cart); return; }
  if (!checkout) { navigate(data.routes.checkout); return; }
  const form = section.querySelector('[data-ip-pay-form]');
  const summary = section.querySelector('[data-ip-summary]');
  renderSumLines(summary, lines);
  const sum = paintTotals(summary, lines, checkout.delivery);
  const contact = [checkout.name, checkout.company, checkout.email, checkout.phone].filter(Boolean).join(' · ');
  section.querySelector('[data-ip-rev-contact]').textContent = contact;
  section.querySelector('[data-ip-rev-address]').textContent = `${addressText(checkout)} · ${deliveryOf(checkout.delivery)?.name ?? ''}`;

  const submit = form.querySelector('[data-ip-pay-submit]');
  const label = submit.querySelector('span');
  const methodErr = document.getElementById('pay-method-err');
  const termsBox = form.elements.terms;
  const termsErr = document.getElementById('f-pay-terms-err');
  const flowOf = (id) => data.payment.find((p) => p.id === id)?.flow;
  const sync = () => {
    const chosen = form.elements.payment.value;
    label.textContent = !chosen || flowOf(chosen) === 'simulated' ? submit.dataset.pay : submit.dataset.confirm;
    methodErr.hidden = true;
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'payment') sync();
    if (e.target.name === 'terms') { termsErr.hidden = true; termsBox.setAttribute('aria-invalid', 'false'); }
  });
  sync();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const method = form.elements.payment.value;
    let bad = null;
    if (!method) { methodErr.textContent = tr('payment.methodError'); methodErr.hidden = false; bad = form.querySelector('input[name="payment"]'); }
    if (!termsBox.checked) { termsErr.textContent = tr('payment.termsError'); termsErr.hidden = false; termsBox.setAttribute('aria-invalid', 'true'); bad = bad || termsBox; }
    if (bad) { bad.focus(); return; }

    // the draft order of this cart: created once, reused when a payment fails and is tried again
    let order = read(KEYS.order, null);
    if (!order) order = { ref: nextRef(), tx: 0 };
    Object.assign(order, { lines: snapshot(lines), totals: { sub: sum.sub, fee: sum.fee ?? null, total: sum.total, count: sum.count }, customer: checkout, method });
    if (flowOf(method) === 'simulated') {
      order.tx += 1;
      order.txRef = `${order.ref}-${order.tx}`;
      order.state = 'draft';
      write(KEYS.order, order);
      navigate(data.routes.simulate);
      return;
    }
    // cash on delivery and transfer: the order is recorded and waits for its payment, as Odoo's "pending" state
    finish(order, 'pending');
    navigate(data.routes.confirmation);
  });
}

/** The order is final (paid or waiting for its payment): it joins the account, the cart is emptied. */
function finish(order, state) {
  order.state = state;
  order.date = new Date().toISOString();
  const orders = read(KEYS.orders, []).filter((o) => o.ref !== order.ref);
  orders.unshift(order);
  write(KEYS.orders, orders);
  write(KEYS.last, { ref: order.ref, result: state === 'paid' ? 'done' : 'pending' });
  drop(KEYS.order);
  saveCart([]);
}

/* ---- the simulated provider page ---------------------------------------------------------------------------- */
function initSimulate(section) {
  const order = read(KEYS.order, null);
  if (!order || !order.txRef) { navigate(data.routes.payment); return; }
  section.querySelector('[data-ip-sim-order]').textContent = tr('simulate.order', { ref: order.txRef });
  section.querySelector('[data-ip-sim-amount]').textContent = tr('simulate.amount', { amount: money(order.totals.total) });
  const status = section.querySelector('[data-ip-sim-status]');
  const buttons = [...section.querySelectorAll('[data-ip-sim]')];
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    buttons.forEach((b) => { b.disabled = true; });
    status.hidden = false;
    const accepted = btn.dataset.ipSim === 'yes';
    setTimeout(() => {
      if (accepted) {
        finish(order, 'paid');
      } else {
        // a refused payment leaves the cart and the draft order alone, as Odoo does
        write(KEYS.last, { ref: order.ref, result: 'cancel' });
      }
      navigate(data.routes.confirmation);
    }, 900);
  }));
}

/* ---- confirmation ------------------------------------------------------------------------------------------- */
function orderLines(ul, order) {
  ul.innerHTML = order.lines.map((l) => {
    const v = view(l);
    return v ? `<li><span class="ip-sum-line__name">${esc(v.p.name)}${v.option ? `<small>${esc(v.option.label)}</small>` : ''}</span><span class="ip-sum-line__qty">× ${l.qty}${v.p.unit ? ` ${esc(v.p.unit)}` : ''}</span><span class="ip-sum-line__price">${esc(money(v.total))}</span></li>` : '';
  }).join('');
}

function initConfirmation(section) {
  const last = read(KEYS.last, null);
  const order = last && (last.result === 'cancel' ? read(KEYS.order, null) : read(KEYS.orders, []).find((o) => o.ref === last.ref));
  const none = section.querySelector('[data-ip-state="none"]');
  const full = section.querySelector('[data-ip-state="order"]');
  if (!order) { full.remove(); none.hidden = false; return; }
  none.remove(); // one heading on the page: the one of the alert below
  full.hidden = false;
  const alert = section.querySelector('[data-ip-alert]');
  const icon = alert.querySelector('.ip-alert__icon');
  const title = section.querySelector('[data-ip-title]');
  const text = section.querySelector('[data-ip-text]');
  const failed = last.result === 'cancel';
  const pending = last.result === 'pending';
  alert.classList.remove('ip-alert--success', 'ip-alert--info', 'ip-alert--danger');
  alert.classList.add(failed ? 'ip-alert--danger' : pending ? 'ip-alert--info' : 'ip-alert--success');
  alert.setAttribute('role', failed ? 'alert' : 'status');
  icon.innerHTML = failed ? ICON.alert : pending ? ICON.info : ICON.check;
  if (failed) {
    title.textContent = tr('confirmation.failTitle');
    text.textContent = tr('confirmation.failText');
  } else if (pending) {
    title.textContent = tr('confirmation.doneTitle');
    text.textContent = order.method === 'transfer' ? tr('confirmation.transferText') : tr('confirmation.codText');
    if (order.method === 'transfer') {
      section.querySelector('[data-ip-transfer-ref]').hidden = false;
      section.querySelector('[data-ip-ref]').textContent = order.ref;
    }
  } else {
    title.textContent = tr('confirmation.doneTitle');
    text.textContent = tr('confirmation.doneText');
  }
  const label = section.querySelector('[data-ip-order-label]');
  label.textContent = label.dataset.template.replace('{ref}', order.ref);
  section.querySelector('[data-ip-fail-actions]').hidden = !failed;
  section.querySelector('[data-ip-next]').hidden = failed;

  const details = section.querySelector('[data-ip-details]');
  details.hidden = false;
  orderLines(section.querySelector('[data-ip-conf-lines]'), order);
  const c = order.customer;
  const method = data.payment.find((p) => p.id === order.method)?.name ?? '';
  const meta = [
    [tr('confirmation.status'), failed ? tr('confirmation.failTitle') : tr(`confirmation.statuses.${order.state === 'paid' ? 'paid' : 'pending'}`)],
    ...(order.date ? [[tr('confirmation.date'), when(order.date)]] : []),
    [tr('confirmation.method'), method],
    [tr('confirmation.delivery'), `${deliveryOf(c.delivery)?.name ?? ''} · ${c.name} · ${addressText(c)}`],
  ];
  section.querySelector('[data-ip-conf-meta]').innerHTML = meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  paintTotals(section, order.lines, c.delivery);
  // the totals come from the order, not from the (now empty) cart
  const sum = order.totals;
  section.querySelectorAll('[data-ip-subtotal]').forEach((el) => { el.textContent = money(sum.sub); });
  section.querySelectorAll('[data-ip-delivery]').forEach((el) => { el.textContent = money(sum.fee); });
  section.querySelectorAll('[data-ip-total]').forEach((el) => { el.textContent = money(sum.total); });
}

/* ---- account (demo): any e-mail and a password of six characters ------------------------------------------- */
function initAuth(section) {
  const form = section.querySelector('[data-ip-auth-form]');
  const signup = form.dataset.ipAuthForm === 'signup';
  const pro = form.querySelector('[data-ip-pro]');
  const proFields = form.querySelector('[data-ip-pro-fields]');
  pro?.addEventListener('change', () => { proFields.hidden = !pro.checked; });
  bindLiveValidation(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const v = (n) => form.elements[n]?.value.trim() ?? '';
    const known = read(KEYS.user, null);
    const email = v('email');
    const user = signup
      ? { name: v('name'), email, company: pro?.checked ? v('company') : '', ice: pro?.checked ? v('ice') : '', pro: Boolean(pro?.checked) }
      : known && known.email === email ? known : { name: email.split('@')[0], email, company: '', ice: '', pro: false };
    write(KEYS.user, user);
    navigate(data.routes.account);
  });
}

function initAccount(section) {
  const user = read(KEYS.user, null);
  const guest = section.querySelector('[data-ip-guest]');
  const box = section.querySelector('[data-ip-account]');
  if (!user) { guest.hidden = false; return; }
  box.hidden = false;
  const hello = section.querySelector('[data-ip-hello]');
  hello.textContent = hello.dataset.template.replace('{name}', user.name);
  section.querySelector('[data-ip-pro-badge]').hidden = !user.pro;
  section.querySelector('[data-ip-logout]').addEventListener('click', () => { drop(KEYS.user); navigate(data.routes.account); });
  const orders = read(KEYS.orders, []);
  section.querySelector('[data-ip-orders-empty]').hidden = orders.length > 0;
  section.querySelector('[data-ip-orders-wrap]').hidden = orders.length === 0;
  section.querySelector('[data-ip-orders]').innerHTML = orders.map((o) => {
    const lines = o.lines.map((l) => {
      const v = view(l);
      return v ? `<li>${esc(v.p.name)}${v.option ? ` (${esc(v.option.label)})` : ''} × ${l.qty}${v.p.unit ? ` ${esc(v.p.unit)}` : ''}</li>` : '';
    }).join('');
    return `<tr><th scope="row"><details class="ip-table__details"><summary>${esc(o.ref)}</summary><ul>${lines}</ul></details></th><td>${esc(when(o.date))}</td><td><span class="ip-status ip-status--${o.state}">${esc(tr(`confirmation.statuses.${o.state}`))}</span></td><td class="ip-table__num">${esc(money(o.totals.total))}</td></tr>`;
  }).join('');
}

/* ---- entry point: once per page (and again after every navigation made by the router) ------------------------ */
let listening = false;
export function initShop({ track }) {
  updateBadges();
  if (!listening) {
    listening = true;
    window.addEventListener('storage', (e) => { if (!e.key || e.key === KEYS.cart) updateBadges(); });
  }
  const block = document.getElementById('ip-shop-data');
  data = block ? JSON.parse(block.textContent) : null;
  if (!data) return;
  document.querySelectorAll('[data-ip-buy]').forEach(initBuy);
  document.querySelectorAll('[data-ip-shop]').forEach((section) => {
    const kind = section.dataset.ipShop;
    if (kind === 'list') initList(section);
    else if (kind === 'cart') initCart(section);
    else if (kind === 'checkout') initCheckout(section);
    else if (kind === 'payment') initPayment(section);
    else if (kind === 'simulate') initSimulate(section);
    else if (kind === 'confirmation') initConfirmation(section);
    else if (kind === 'login' || kind === 'signup') initAuth(section);
    else if (kind === 'account') initAccount(section);
  });
  track?.(() => { clearTimeout(toastTimer); });
}
