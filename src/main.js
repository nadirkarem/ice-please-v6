import Lenis from 'lenis';
import './style.css';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.querySelector('.ip');
/* On the static site the page scrolls in the window; in Odoo it scrolls inside #wrapwrap. One handle for both. */
const scrollEl = (() => { const w = document.getElementById('wrapwrap'); return w && /(auto|scroll)/.test(getComputedStyle(w).overflowY) ? w : null; })();
const scroller = scrollEl || window;
const scrollTop = () => (scrollEl ? scrollEl.scrollTop : window.scrollY);
const onScrollOf = (fn) => scroller.addEventListener('scroll', fn, { passive: true });
const offScrollOf = (fn) => scroller.removeEventListener('scroll', fn);
/* things a page sets up on window or document are listed here and undone before the next page arrives */
let cleanups = [];
const track = (fn) => cleanups.push(fn);

initSmoothScroll();
initHeader();
initMenu();
initPage();
initRouter();

/* One call per page: runs on load, and again after every navigation made by the router. */
function initPage() {
  initReveal();
  initHeroMelt();
  initFrost();
  initSaga();
  initScenes();
  initVideo();
  initFloatingButton();
  initTabs();
  initForms();
}

/* Header: invisible by default (CSS adds the glass under the pointer), white on the home photo at the top,
   steps aside while reading down and comes back on the way up. */
function initHeader() {
  const header = document.querySelector('[data-ip-header]');
  if (!header) return;
  let last = scrollTop();
  const onScroll = () => {
    const y = scrollTop();
    header.classList.toggle('is-top', y <= 8);
    if (Math.abs(y - last) > 6) { header.classList.toggle('is-away', y > 140 && y > last); last = y; }
  };
  onScroll();
  onScrollOf(onScroll);
}

/* Mobile menu: a sheet under the bar. While it is open the page behind is inert and cannot scroll. */
function initMenu() {
  const header = document.querySelector('[data-ip-header]');
  const burger = header?.querySelector('.ip-burger');
  const sheet = header?.querySelector('[data-ip-sheet]');
  if (!burger || !sheet) return;
  const behind = () => document.querySelectorAll('main, .ip-footer, .ip-wa, .ip-buybar');
  const desktop = window.matchMedia('(min-width: 1040px)');

  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? burger.dataset.labelClose : burger.dataset.labelOpen);
    sheet.toggleAttribute('inert', !open);
    behind().forEach((el) => el.toggleAttribute('inert', open));
    (scrollEl || document.documentElement).style.overflow = open ? 'hidden' : '';
    window.__ipLenis?.[open ? 'stop' : 'start']();
  };
  window.__ipCloseMenu = () => setOpen(false);

  burger.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  sheet.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('is-open')) {
      setOpen(false);
      burger.focus();
    }
  });
  desktop.addEventListener('change', () => setOpen(false));
}

/* Scroll reveal for elements marked [data-reveal]. Anything already on screen is shown at once. */
function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
  );
  items.forEach((el) => observer.observe(el));
  track(() => observer.disconnect());
}

/* Hero melt: CSS scroll-driven animations do the work; this is the fallback for browsers without them.
   It publishes the scroll progress (0 at the top, 1 after 80% of a screen) as --p. */
function initHeroMelt() {
  const heroes = document.querySelectorAll('.ip-hero, .ip-pagehero');
  if (!heroes.length || (CSS.supports('animation-timeline: scroll()') && !scrollEl)) return;
  if (reduced()) return;
  heroes.forEach((hero) => hero.classList.add('is-scrubbed'));
  let frame = 0;
  const update = () => {
    frame = 0;
    const p = Math.min(scrollTop() / (window.innerHeight * 0.8), 1);
    heroes.forEach((hero) => hero.style.setProperty('--p', p.toFixed(3)));
  };
  update();
  const onScroll = () => { frame = frame || requestAnimationFrame(update); };
  onScrollOf(onScroll);
  track(() => offScrollOf(onScroll));
}

/* Frost on the home photograph (computer with a mouse only; phones keep the plain photograph).
   The picture starts fogged, the pointer wipes it, scrolling clears it, and it slowly forms again
   where nobody wipes. The fog is the page's own blue, not a dark veil. */
function initFrost() {
  const hero = document.querySelector('.ip-hero');
  const html = document.documentElement;
  if (!hero || !html.classList.contains('ip-frost-ok')) return;
  const media = hero.querySelector('.ip-hero__media');
  const off = () => { hero.classList.add('is-frost-off'); hero.classList.remove('has-frost'); };
  const canvas = document.createElement('canvas');
  canvas.className = 'ip-frost';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return off();

  const VERT = `#version 300 es
  in vec2 p; out vec2 vUv; void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D tImg, tWipe; uniform vec2 uRes, uImg; uniform float uTime, uClear, uIn; uniform vec3 uFog; uniform vec2 uFocus;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; } return v; }
  float ridged(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * (1.0 - abs(noise(p) * 2.0 - 1.0)); p = p * 2.1 + 3.1; a *= 0.5; } return v; }
  vec2 cover(vec2 uv) { float sa = uRes.x / uRes.y, ia = uImg.x / uImg.y; vec2 r = vec2(min(sa / ia, 1.0), min(ia / sa, 1.0)); return (uv - uFocus) * r + uFocus; }
  void main() {
    vec2 st = cover(vUv); float asp = uRes.x / uRes.y; vec2 q = vec2(vUv.x * asp, vUv.y); float t = uTime;
    float n1 = fbm(q * 3.2 + vec2(t * 0.012, -t * 0.008));
    float n2 = fbm(q * 9.0 - n1 * 1.6 + vec2(-t * 0.01, t * 0.006));
    float field = n1 * 0.62 + n2 * 0.38;
    float wipe = texture(tWipe, vec2(vUv.x, 1.0 - vUv.y)).r;
    float f = smoothstep(0.0, 1.0, clamp(1.0 - (uClear * 1.4 + wipe * 1.9) + (field - 0.5) * 0.55, 0.0, 1.0));
    vec3 sharpC = texture(tImg, st).rgb;
    vec3 blurC = textureLod(tImg, st + (vec2(n1, n2) - 0.5) * 0.012 * f, f * 7.0).rgb;
    vec3 col = mix(sharpC, blurC, clamp(f * 1.6, 0.0, 1.0));
    col = mix(col, uFog, f * 0.88);
    float crystals = pow(ridged(q * 95.0 + n1 * 3.0), 4.0);
    col += vec3(0.85, 0.93, 1.0) * crystals * f * 0.2;
    col *= 0.9 + 0.22 * fbm(q * 1.3 + 4.0) * f;
    float edge = smoothstep(0.03, 0.22, f) * smoothstep(0.96, 0.5, f);
    col += vec3(0.75, 0.88, 1.0) * edge * 0.2 * (0.7 + 0.3 * ridged(q * 18.0));
    col += (hash(vUv * uRes + fract(t)) - 0.5) * 0.02;
    o = vec4(mix(uFog, col, uIn), 1.0);
  }`;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return off();
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);

  const W = 160, H = 90;
  const field = new Float32Array(W * H);
  const bytes = new Uint8Array(W * H);
  const wipeTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, wipeTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, H, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.uniform1i(U('tWipe'), 1);
  gl.uniform1i(U('tImg'), 0);
  gl.uniform3f(U('uFog'), 0.29, 0.43, 0.58);
  gl.uniform2f(U('uFocus'), 0.5, 0.5);

  let ready = false, alive = true, frame = 0, visible = true, clear = 0, fadeIn = 0, last = performance.now();
  let rect = media.getBoundingClientRect();
  let mx = -1, my = -1;

  const brush = (x0, y0, x1, y1, radius, strength) => {
    const rx = radius / (rect.width / W), ry = radius / (rect.height / H);
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (radius * 0.3)));
    for (let s = 1; s <= steps; s++) {
      const px = ((x0 + ((x1 - x0) * s) / steps) / rect.width) * W;
      const py = ((y0 + ((y1 - y0) * s) / steps) / rect.height) * H;
      for (let j = Math.max(0, Math.floor(py - ry)); j <= Math.min(H - 1, Math.ceil(py + ry)); j++) {
        for (let i = Math.max(0, Math.floor(px - rx)); i <= Math.min(W - 1, Math.ceil(px + rx)); i++) {
          const dx = (i - px) / rx, dy = (j - py) / ry, d = dx * dx + dy * dy;
          if (d < 1) { const k = j * W + i; field[k] = Math.min(1, field[k] + (1 - d) * (1 - d) * strength); }
        }
      }
    }
  };
  const resize = () => {
    rect = media.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U('uRes'), canvas.width, canvas.height);
  };
  const onMove = (e) => {
    rect = media.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (inside && mx >= 0) brush(mx, my, x, y, Math.min(rect.width, 1000) * 0.075, 0.5);
    mx = inside ? x : -1; my = y;
  };
  const onScroll = () => { clear = Math.min(1, Math.max(0, scrollTop() / (window.innerHeight * 0.55))); clear = clear * clear * (3 - 2 * clear); };
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    if (!ready || !visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const decay = Math.pow(0.5, dt / 7);
    for (let i = 0; i < field.length; i++) { field[i] *= decay; bytes[i] = Math.min(255, Math.round(field[i] * 255)); }
    gl.activeTexture(gl.TEXTURE1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED, gl.UNSIGNED_BYTE, bytes);
    fadeIn = Math.min(1, fadeIn + dt / 1.1);
    gl.uniform1f(U('uTime'), now / 1000);
    gl.uniform1f(U('uClear'), clear);
    gl.uniform1f(U('uIn'), fadeIn);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); });
  io.observe(hero);
  resize(); onScroll();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  onScrollOf(onScroll);
  hero.classList.add('has-frost');
  media.append(canvas);
  frame = requestAnimationFrame(tick);

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (!alive) return;
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(U('uImg'), img.naturalWidth, img.naturalHeight);
    ready = true;
    hero.classList.add('is-frost-ready');
    // a slow breath across the photograph so everyone sees what the glass does
    const t0 = performance.now();
    let px = rect.width * 0.4, py = rect.height * 0.38;
    const breath = (now) => {
      if (!alive) return;
      const k = Math.min(1, (now - t0 - 500) / 2300);
      if (k > 0) {
        const x = rect.width * (0.4 + 0.42 * k), y = rect.height * (0.38 + 0.08 * Math.sin(k * Math.PI * 2));
        brush(px, py, x, y, Math.min(rect.width, 1000) * 0.11, 0.38);
        px = x; py = y;
      }
      if (k < 1) requestAnimationFrame(breath);
    };
    requestAnimationFrame(breath);
  };
  img.onerror = () => { if (alive) off(); };
  img.src = `${import.meta.env.BASE_URL}img/hero-1448.webp`;

  track(() => {
    alive = false;
    cancelAnimationFrame(frame);
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    offScrollOf(onScroll);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  });
}

/* Know-how scene (.ip-saga): one pinned stage driven by the scroll position, in units of the viewport height.
   The window opens (--e), docks into its frame (--d), then four steps follow: u runs 0 to 4, the film and the claim of
   step k are on screen for u between k and k+1 and cross-fade around the whole numbers. Under reduced motion (or without
   script) nothing is set up: the section stays a band followed by four stills, and the pause button plays the opening
   film. */
function initSaga() {
  const saga = document.querySelector('[data-ip-saga]');
  if (!saga) return;
  const openVideo = saga.querySelector('.ip-saga__openvideo');
  const openLayer = saga.querySelector('.ip-saga__open');
  const films = [...saga.querySelectorAll('.ip-saga__film')];
  const claims = [...saga.querySelectorAll('.ip-saga__claim')];
  const toggles = [...saga.querySelectorAll('[data-ip-saga-toggle]')];
  const stepName = saga.querySelector('[data-step]');
  const count = saga.querySelector('[data-count]');
  let userPaused = false, active = -1;
  const label = () => toggles.forEach((b) => { b.setAttribute('aria-pressed', String(userPaused)); b.querySelector('[data-label]').textContent = userPaused ? b.dataset.play : b.dataset.pause; });

  if (reduced() || !('IntersectionObserver' in window)) {
    userPaused = true; label();
    toggles.forEach((b) => b.addEventListener('click', () => {
      if (openVideo.paused) { userPaused = false; openVideo.play().catch(() => {}); } else { userPaused = true; openVideo.pause(); }
      label();
    }));
    return;
  }

  const clamp = (v) => Math.min(Math.max(v, 0), 1);
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const phones = window.matchMedia('(max-width: 899px)');
  const plan = () => (phones.matches
    ? { open: 0.9, dockAt: 1.3, dock: 0.6, step: 1.0, k: 6.1 }
    : { open: 1.0, dockAt: 1.5, dock: 0.9, step: 1.15, k: 7.35 });
  let P = plan();
  saga.classList.add('is-live');
  saga.style.setProperty('--saga-k', String(P.k));

  let near = false, frame = 0, current = null;
  const playing = (video, on) => { if (on && !userPaused) { if (video.paused) video.play().catch(() => {}); } else if (!video.paused) video.pause(); };
  const apply = (s) => {
    const e = ease(s / P.open);
    const d = ease((s - P.dockAt) / P.dock);
    const u = (s - (P.dockAt + P.dock)) / P.step;
    saga.style.setProperty('--e', e.toFixed(4));
    saga.style.setProperty('--d', d.toFixed(4));
    saga.classList.toggle('is-open', s > (saga.classList.contains('is-open') ? P.open * 0.85 : P.open * 0.95) && d < 0.12);
    const fin0 = smooth((d - 0.55) / 0.45);
    const openOpacity = 1 - fin0;
    openLayer.style.opacity = openOpacity.toFixed(3);
    films.forEach((f, k) => {
      const inK = k === 0 ? fin0 : smooth((u - k + 0.22) / 0.44);
      const outK = k === films.length - 1 ? 1 : 1 - smooth((u - (k + 1) + 0.22) / 0.44);
      const o = inK * outK;
      f.style.opacity = o.toFixed(3);
      playing(f, o > 0.02);
    });
    playing(openVideo, openOpacity > 0.02);
    claims.forEach((c, j) => {
      const inJ = j === 0 ? smooth((u + 0.35) / 0.2) : smooth((u - j - 0.02) / 0.2);   // the old claim is gone just before the next arrives
      const outJ = j === claims.length - 1 ? 1 : 1 - smooth((u - (j + 1) + 0.18) / 0.2);
      c.style.opacity = (inJ * outJ).toFixed(3);
      c.style.transform = `translateY(${((1 - inJ) * 28 - (1 - outJ) * 28).toFixed(1)}px)`;
    });
    const idx = Math.min(claims.length - 1, Math.max(0, Math.floor(u + 0.001)));
    if (idx !== active) {
      active = idx;
      if (stepName) stepName.textContent = claims[idx].dataset.step;
      if (count) count.textContent = String(idx + 1);
    }
    saga.style.setProperty('--clear', clamp(u / claims.length).toFixed(3));
  };
  const progress = () => (-saga.getBoundingClientRect().top) / window.innerHeight;
  const tick = () => {
    frame = 0;
    const target = progress();
    current = current === null ? target : current + (target - current) * 0.2;
    if (Math.abs(target - current) < 0.0007) current = target;
    apply(current);
    if (near && current !== target) frame = requestAnimationFrame(tick);
  };
  const kick = () => { if (near && !frame) frame = requestAnimationFrame(tick); };
  const io = new IntersectionObserver(([en]) => {
    near = en.isIntersecting;
    if (near) { current = null; kick(); } else { films.forEach((f) => f.pause()); openVideo.pause(); }
  }, { rootMargin: '30% 0px 30% 0px' });
  io.observe(saga);
  const onResize = () => { P = plan(); saga.style.setProperty('--saga-k', String(P.k)); current = null; kick(); };
  onScrollOf(kick);
  window.addEventListener('resize', onResize);
  toggles.forEach((b) => b.addEventListener('click', () => { userPaused = !userPaused; label(); current = null; kick(); }));
  label();
  apply(progress());
  track(() => { io.disconnect(); offScrollOf(kick); window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); films.forEach((f) => f.pause()); openVideo.pause(); });
}

/* Smooth wheel scrolling (Lenis) on desktop pointers only: touch keeps the browser's own momentum, and
   reduced motion keeps plain scrolling. Off unless the .ip root asks for it (data-ip-router or data-ip-smooth). */
function initSmoothScroll() {
  if (!root || !(root.hasAttribute('data-ip-router') || root.hasAttribute('data-ip-smooth')) || reduced()) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const options = { autoRaf: true, lerp: 0.085, wheelMultiplier: 0.95, anchors: { offset: -96 } };
  if (scrollEl) { options.wrapper = scrollEl; options.content = scrollEl; options.eventsTarget = scrollEl; }
  window.__ipLenis = new Lenis(options);
}

/* Scroll-revealed films (.ip-reveal): the section is a tall track with a pinned stage. The scroll position
   becomes --ip-e (0 → 1), eased and chased frame by frame so the window opens smoothly even when the wheel
   or a finger moves in steps. Under reduced motion nothing is set up and the band stays full bleed. */
function initScenes() {
  const scenes = document.querySelectorAll('[data-ip-reveal]');
  if (!scenes.length || reduced() || !('IntersectionObserver' in window)) return;
  const clamp = (v) => Math.min(Math.max(v, 0), 1);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  scenes.forEach((section) => {
    section.classList.add('is-live');
    let current = -1, frame = 0, near = false;
    const progress = () => {
      const span = section.offsetHeight - window.innerHeight;
      return span > 0 ? clamp(-section.getBoundingClientRect().top / span) : 1;
    };
    const apply = (p) => {
      section.style.setProperty('--ip-e', ease(clamp(p / 0.6)).toFixed(4));
      section.classList.toggle('is-open', p > (section.classList.contains('is-open') ? 0.58 : 0.66));
    };
    const tick = () => {
      frame = 0;
      const target = progress();
      current = current < 0 ? target : current + (target - current) * 0.16;
      if (Math.abs(target - current) < 0.0005) current = target;
      apply(current);
      if (near && current !== target) frame = requestAnimationFrame(tick);
    };
    const kick = () => { if (near && !frame) frame = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) { current = -1; kick(); } }, { rootMargin: '25% 0px 25% 0px' });
    io.observe(section);
    onScrollOf(kick);
    window.addEventListener('resize', kick);
    apply(progress());
    track(() => { io.disconnect(); offScrollOf(kick); window.removeEventListener('resize', kick); cancelAnimationFrame(frame); });
  });
}

/* Loop video: plays only while on screen, with a visible pause control; a still under reduced motion. */
function initVideo() {
  document.querySelectorAll('[data-ip-video]').forEach((wrap) => {
    const video = wrap.querySelector('video');
    const button = wrap.querySelector('[data-ip-video-toggle]');
    if (!video || !button) return;
    const label = button.querySelector('[data-label]');
    const set = (playing) => { button.setAttribute('aria-pressed', String(!playing)); label.textContent = playing ? button.dataset.pause : button.dataset.play; };
    let userPaused = reduced();
    set(false);
    button.addEventListener('click', () => {
      if (video.paused) { userPaused = false; video.play().then(() => set(true)).catch(() => {}); } else { userPaused = true; video.pause(); set(false); }
    });
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) video.pause();
      else if (!userPaused) video.play().then(() => set(true)).catch(() => set(false));
    }, { threshold: 0.25 });
    io.observe(wrap.querySelector('.ip-reveal__stage') || wrap);
    track(() => io.disconnect());
  });
}

/* Floating WhatsApp button: steps aside wherever the page already offers an order or contact action */
function initFloatingButton() {
  const button = document.querySelector('.ip-wa');
  if (!button || !('IntersectionObserver' in window)) return;
  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
    button.classList.toggle('is-away', visible.size > 0);
  });
  document.querySelectorAll('.ip-hero, .ip-contact, .ip-cta, .ip-footer, .ip-product__cta').forEach((zone) => observer.observe(zone));
  track(() => observer.disconnect());
}

/* ---- page transitions (static site only) ----------------------------------------------------------
   A click on an internal link covers the page with frost that grows from the pointer while the next page
   is fetched, the content is swapped without a reload, and a hole opens in the frost from the same point.
   The Odoo fragments carry no data-ip-router attribute, so Odoo keeps its own navigation. */
function initRouter() {
  if (!root || !root.hasAttribute('data-ip-router') || !window.fetch || !window.DOMParser) return;
  const curtain = document.createElement('div');
  curtain.className = 'ip-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.hidden = true;
  curtain.innerHTML = '<div class="ip-curtain__panel"></div>';
  document.body.append(curtain);
  const panel = curtain.firstElementChild;
  let point = { x: innerWidth / 2, y: innerHeight / 2 };
  let token = 0;
  addEventListener('pointerdown', (e) => { point = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });

  const sweep = (mode, ms) => {
    curtain.hidden = false;
    curtain.dataset.mode = mode;
    curtain.style.setProperty('--ip-x', `${point.x}px`);
    curtain.style.setProperty('--ip-y', `${point.y}px`);
    return panel.animate({ '--ip-r': ['0vmax', '170vmax'] }, { duration: ms, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'forwards' }).finished;
  };
  const clearCurtain = () => { panel.getAnimations().forEach((a) => a.cancel()); curtain.hidden = true; };

  async function go(url, { push, animate }) {
    const mine = ++token;
    const fetching = fetch(url.href, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) throw new Error('not a page');
      return r.text();
    });
    const covering = animate ? sweep('disc', 800) : Promise.resolve();
    let html;
    try { [html] = await Promise.all([fetching, covering]); } catch { location.href = url.href; return; }
    if (mine !== token) return;
    swap(new DOMParser().parseFromString(html, 'text/html'), url, push);
    if (animate) { await sweep('hole', 950); if (mine === token) clearCurtain(); }
  }

  function swap(doc, url, push) {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    window.__ipCloseMenu?.();
    const next = doc.querySelector('.ip');
    document.title = doc.title;
    document.documentElement.lang = doc.documentElement.lang;
    document.documentElement.dir = doc.documentElement.dir;
    for (const sel of ['meta[name="description"]', 'link[rel="canonical"]']) {
      const a = document.head.querySelector(sel), b = doc.head.querySelector(sel);
      if (a && b) a.replaceWith(b.cloneNode(true)); else if (b) document.head.append(b.cloneNode(true)); else a?.remove();
    }
    document.body.dataset.page = doc.body.dataset.page;
    document.body.dataset.kind = doc.body.dataset.kind;
    root.lang = next.lang; root.dir = next.dir;
    // the header stays; its tone, current link and language links follow the new page
    const header = root.querySelector('[data-ip-header]'), nextHeader = next.querySelector('[data-ip-header]');
    header.dataset.tone = nextHeader.dataset.tone;
    for (const sel of ['.ip-nav', '.ip-sheet__nav', '.ip-header__tools .ip-lang', '.ip-sheet__foot .ip-lang']) {
      const a = header.querySelector(sel), b = nextHeader.querySelector(sel);
      if (a && b) a.replaceWith(document.adoptNode(b));
    }
    root.querySelector('main').replaceWith(document.adoptNode(next.querySelector('main')));
    root.querySelector('footer').replaceWith(document.adoptNode(next.querySelector('footer')));
    const wa = root.querySelector('.ip-wa'), nextWa = next.querySelector('.ip-wa');
    if (wa && nextWa) wa.replaceWith(document.adoptNode(nextWa)); else if (nextWa) root.append(document.adoptNode(nextWa)); else wa?.remove();
    if (push) history.pushState({}, '', url.href);
    const smooth = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    window.__ipLenis?.scrollTo(0, { immediate: true, force: true });
    document.documentElement.style.scrollBehavior = smooth;
    header.classList.add('is-top'); header.classList.remove('is-away');
    initPage();
    const main = root.querySelector('main');
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
    if (url.hash) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.closest('[data-ip-no-router]')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // same page: the browser handles the hash
    event.preventDefault();
    go(url, { push: true, animate: !reduced() });
  });
  window.addEventListener('popstate', () => go(new URL(location.href), { push: false, animate: false }));
}

/* Tabs (contact page): a question or a quote request. #devis opens the quote tab. */
function initTabs() {
  document.querySelectorAll('[data-ip-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
    const rtl = getComputedStyle(root).direction === 'rtl';

    const select = (index, { focus = false, remember = true } = {}) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
      if (remember) {
        const hash = tabs[index].dataset.hash;
        history.replaceState(null, '', hash ? `#${hash}` : `${location.pathname}${location.search}`);
      }
    };
    const fromHash = () => {
      const index = tabs.findIndex((tab) => tab.dataset.hash && `#${tab.dataset.hash}` === location.hash);
      select(index === -1 ? 0 : index, { remember: false });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (event) => {
        const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
        if (step) select((i + step + tabs.length) % tabs.length, { focus: true });
        else if (event.key === 'Home') select(0, { focus: true });
        else if (event.key === 'End') select(tabs.length - 1, { focus: true });
        else return;
        event.preventDefault();
      });
    });
    window.addEventListener('hashchange', fromHash);
    track(() => window.removeEventListener('hashchange', fromHash));
    fromHash();
  });
}

/* Forms: validate in place, then hand the message to WhatsApp (no server in the static draft). */
function initForms() {
  document.querySelectorAll('[data-ip-form]').forEach((form) => {
    const status = form.querySelector('.ip-form__status');
    const fields = [...form.querySelectorAll('input, textarea')];

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      let firstInvalid = null;
      fields.forEach((field) => {
        const message = validate(field, form.dataset);
        showError(field, message);
        if (message && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        status.textContent = '';
        firstInvalid.focus();
        return;
      }
      const link = document.createElement('a');
      link.href = `${form.dataset.wa}?text=${encodeURIComponent(compose(form, fields))}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.click();
      showStatus(status, form.dataset, link.href);
    });

    // clear an error as soon as the field is fixed
    form.addEventListener('input', (event) => {
      const field = event.target;
      if (field.getAttribute('aria-invalid') === 'true') showError(field, validate(field, form.dataset));
    });
  });
}

function validate(field, messages) {
  const value = field.value.trim();
  if (field.required && !value) return messages.required;
  if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return messages.invalidEmail;
  if (value && field.type === 'tel' && !/^[+()\d][\d\s().-]{5,}$/.test(value)) return messages.invalidPhone;
  return '';
}

function showError(field, message) {
  const error = document.getElementById(`${field.id}-err`);
  if (error) {
    error.hidden = !message;
    error.textContent = message;
  }
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function compose(form, fields) {
  const lines = [form.dataset.greeting];
  fields.forEach((field) => {
    const value = field.value.trim();
    if (value) lines.push(`${field.dataset.label}: ${value}`);
  });
  return lines.join('\n');
}

function showStatus(status, messages, href) {
  status.textContent = `${messages.status} ${messages.blocked} `;
  const fallback = document.createElement('a');
  fallback.href = href;
  fallback.target = '_blank';
  fallback.rel = 'noopener';
  fallback.textContent = 'WhatsApp';
  status.append(fallback);
}
