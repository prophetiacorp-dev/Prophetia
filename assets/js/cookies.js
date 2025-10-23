/* ===== Cookies (GDPR) ===== */
(() => {
  const KEY = 'pp_cookie_consent_v1';
  const $banner = document.getElementById('cc-banner');
  const $modal  = document.getElementById('cc-modal');
  if (!$banner || !$modal) return;

  const qs = s => document.querySelector(s);
  const qsa = s => [...document.querySelectorAll(s)];
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const set = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

  const runAllowedScripts = (consent) => {
    qsa('script[type="text/plain"][data-consent]').forEach(tag => {
      const cat = tag.getAttribute('data-consent');
      if (consent[cat]) {
        const s = document.createElement('script');
        // data-src para scripts externos
        const src = tag.getAttribute('data-src');
        if (src) { s.src = src; s.defer = true; }
        s.text = tag.text || '';
        tag.replaceWith(s);
      }
    });
  };

  const openModal = () => { $modal.removeAttribute('hidden'); $modal.setAttribute('aria-hidden','false'); document.body.classList.add('no-scroll'); };
  const closeModal= () => { $modal.setAttribute('hidden',''); $modal.setAttribute('aria-hidden','true'); document.body.classList.remove('no-scroll'); };

  // Botones banner
  $banner.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cc]');
    if (!a) return;
    if (a.dataset.cc === 'accept') {
      const consent = { necessary:true, analytics:true, marketing:true };
      set(consent); $banner.setAttribute('hidden',''); runAllowedScripts(consent);
    } else if (a.dataset.cc === 'reject') {
      const consent = { necessary:true, analytics:false, marketing:false };
      set(consent); $banner.setAttribute('hidden',''); runAllowedScripts(consent);
    } else if (a.dataset.cc === 'settings') {
      openModal();
    }
  });

  // Modal
  $modal.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cc]');
    if (!a) return;
    if (a.dataset.cc === 'close') closeModal();
    if (a.dataset.cc === 'save') {
      const consent = {
        necessary:true,
        analytics: !!qs('#cc-analytics')?.checked,
        marketing: !!qs('#cc-marketing')?.checked
      };
      set(consent); closeModal(); $banner.setAttribute('hidden',''); runAllowedScripts(consent);
    }
    if (a.dataset.cc === 'reject') {
      const consent = { necessary:true, analytics:false, marketing:false };
      set(consent); closeModal(); $banner.setAttribute('hidden',''); runAllowedScripts(consent);
    }
  });

  // Mostrar banner si no hay decisión previa
  const existing = get();
  if (!('necessary' in existing)) {
    $banner.removeAttribute('hidden');
  } else {
    // Ya consintió: ejecutar scripts permitidos
    runAllowedScripts(existing);
    // Y setear estados del modal
    qs('#cc-analytics') && (qs('#cc-analytics').checked = !!existing.analytics);
    qs('#cc-marketing') && (qs('#cc-marketing').checked = !!existing.marketing);
  }

  // Exponer helper global opcional
  window.CookieConsent = {
    get, isAllowed: (cat) => !!get()[cat],
    open: openModal
  };
})();
document.dispatchEvent(new CustomEvent('pp_cookies_decided'));
