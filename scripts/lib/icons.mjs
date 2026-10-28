// Inline icons: 24px grid, 1.6 stroke, round caps. `whatsapp` is a solid shape.

const stroke = (body, cls = '') => `<svg class="ip-icon${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const PATHS = {
  arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  cube: '<path d="M12 3 4.5 7.3v9.4L12 21l7.5-4.3V7.3L12 3z"/><path d="M4.5 7.3 12 11.6l7.5-4.3M12 11.6V21"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
  bag: '<path d="M5.5 8.5h13l-1.1 11H6.6L5.5 8.5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.9-3.7 3.7-5.5 7-5.5s6.1 1.8 7 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4h.01"/>',
};

export function icon(name) {
  if (name === 'whatsapp') {
    return '<svg class="ip-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 1 1 12 21.8zm8.4-18.3A11.8 11.8 0 0 0 12 0 11.9 11.9 0 0 0 1.7 17.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.5A11.9 11.9 0 0 0 20.4 3.5z"/></svg>';
  }
  if (name === 'burger') {
    return '<svg class="ip-icon ip-icon--burger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path class="ip-burger__a" d="M4 9h16"/><path class="ip-burger__b" d="M4 15h16"/></svg>';
  }
  // the arrow points "forward": mirrored by CSS in right-to-left pages
  return stroke(PATHS[name], name === 'arrow' ? ' ip-icon--dir' : '');
}
