/* ======================================================
   Prophetia Tribe — POPUP controller (modular)
   Archivo: assets/js/popup.js
   ====================================================== */
(() => {
  const KEY = 'pp_tribe_seen_v1';   // cambia la versión para forzar reaparición
  const DELAY_MS = 3000;            // 3s de retraso
  const REOPEN_DAYS = 30;           // reaparece en 30 días

  // Espera a que el DOM esté listo por si los parciales/HTML llegan tarde
  const ready = (fn) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  };

  ready(() => {
    const $modal = document.getElementById('tribeModal');
    if (!$modal) return; // si la página no tiene el bloque, no hacemos nada

    const $backdrop = $modal.querySelector('.tribe-backdrop');
    const $closes = $modal.querySelectorAll('[data-close]');
    const $firstFocus = $modal.querySelector('input, button, [href], select, textarea');

    const now = () => Date.now();
    const days = d => d * 24 * 60 * 60 * 1000;

    const getSeenUntil = () => {
      try { return parseInt(localStorage.getItem(KEY) || '0', 10); }
      catch { return 0; }
    };
    const setSeenForDays = (d) => {
      try { localStorage.setItem(KEY, String(now() + days(d))); }
      catch {}
    };

    const open = () => {
      $modal.classList.add('open');
      $modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
      $firstFocus && $firstFocus.focus({ preventScroll: true });
    };

    const close = () => {
      $modal.classList.remove('open');
      $modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      setSeenForDays(REOPEN_DAYS);
    };

    $backdrop?.addEventListener('click', close);
    $closes.forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $modal.classList.contains('open')) close();
    });

    const seenUntil = getSeenUntil();
    if (isNaN(seenUntil) || now() > seenUntil) {
      setTimeout(open, DELAY_MS);
    }

    // Submit demo (integra luego con tu backend/Klaviyo/Mailchimp)
    const $form = document.getElementById('tribeForm');
    if ($form) {
      $form.addEventListener('submit', (e) => {
        e.preventDefault();
        close();
      });
    }
  });
})();
// si no hay decisión de cookies, espera:
if (!window.CookieConsent || !('necessary' in window.CookieConsent.get())) {
  document.addEventListener('pp_cookies_decided', () => setTimeout(open, DELAY_MS), { once:true });
  return;
}
