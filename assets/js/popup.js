/* ======================================================================
   Prophetia Tribe — POPUP controller (estable con botón reabrir + éxito)
   ====================================================================== */
(() => {
  // ----- Config -----
  const KEY = 'pp_tribe_seen_v1';      // cambia versión para forzar reaparición
  const DELAY_MS = 3000;               // retraso 3s
  const REOPEN_DAYS = 30;              // no reabrir auto hasta X días
  const DEBUG = !!(new URLSearchParams(location.search).get('ppdebug'));
  const FORCE = !!(new URLSearchParams(location.search).get('forcepopup'));

  const log = (...a) => DEBUG && console.log('[TRIBE]', ...a);
  const now = () => Date.now();
  const days = (d) => d * 24 * 60 * 60 * 1000;

  const getSeenUntil = () => { try { return parseInt(localStorage.getItem(KEY) || '0', 10); } catch { return 0; } };
  const setSeenForDays = (d) => { try { localStorage.setItem(KEY, String(now() + days(d))); } catch {} };

  // Esperar DOM
  const ready = (fn) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  ready(() => {
    // ===== Selecciones base =====
    const $modal = document.getElementById('tribeModal');
    if (!$modal) { log('No hay #tribeModal en esta página'); return; }

    // Botón flotante (inyectar si no existe)
    let $reopen = document.getElementById('tribeReopen');
    if (!$reopen) {
      $reopen = document.createElement('button');
      $reopen.id = 'tribeReopen';
      $reopen.className = 'tribe-reopen';
      $reopen.setAttribute('aria-label', 'Abrir Prophetia Tribe');
      $reopen.setAttribute('hidden', '');
      $reopen.innerHTML = '<img class="tribe-reopen__img" src="assets/img/logo/prophetia-emblem.png" alt="">';
      document.body.appendChild($reopen);
    }

    const showReopen = () => { $reopen && $reopen.removeAttribute('hidden'); };
    const hideReopen = () => { $reopen && $reopen.setAttribute('hidden', ''); };

    const $backdrop   = $modal.querySelector('.tribe-backdrop');
    const $closes     = $modal.querySelectorAll('[data-close]');
    const $firstFocus = $modal.querySelector('input, button, [href], select, textarea');

    // ===== Abrir / Cerrar =====
    const open = () => {
      $modal.classList.add('open');
      $modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
      hideReopen();
      $firstFocus && $firstFocus.focus?.({ preventScroll: true });
      log('POPUP abierto');
    };

    const close = () => {
      $modal.classList.remove('open');
      $modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      setSeenForDays(REOPEN_DAYS);
      showReopen();
      log('POPUP cerrado');
    };

    // Cierres
    $backdrop?.addEventListener('click', close);
    $closes.forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', e => (e.key === 'Escape' && $modal.classList.contains('open')) && close());

    // Reabrir
    $reopen.addEventListener('click', (e) => { e.preventDefault(); open(); });

    // ===== Form: envío + estado de éxito =====
    const $form    = document.getElementById('tribeForm');
    const $success = document.getElementById('tribeSuccess'); // panel de éxito opcional
    const $btn     = $form ? $form.querySelector('.tribe-btn') : null;
    let sending    = false;

    async function sendToBackend(payload){
      // TODO integra tu endpoint real (Klaviyo/Mailchimp/Formspree/proxy propio)
      // const res = await fetch('/api/subscribe', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });
      // if (!res.ok) throw new Error('HTTP ' + res.status);
      // return await res.json();

      // DEMO: simula OK
      await new Promise(r => setTimeout(r, 800));
      return { ok: true };
    }

    if ($form) {
      $form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (sending) return;
        $form.querySelector('.tribe-error')?.remove();

        const data = {
          name  : ($form.name?.value || '').trim(),
          email : ($form.email?.value || '').trim(),
          optin : !!$form.optin?.checked,
          dob   : {
            mm: ($form.dobMM?.value || '').trim(),
            dd: ($form.dobDD?.value || '').trim(),
            yy: ($form.dobYY?.value || '').trim()
          },
          utm: Object.fromEntries(new URLSearchParams(location.search).entries())
        };

        if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
          const err = document.createElement('div');
          err.className = 'tribe-error';
          err.textContent = 'Introduce un correo válido.';
          $btn?.insertAdjacentElement('afterend', err);
          return;
        }

        try {
          sending = true;
          if ($btn) { $btn.disabled = true; $btn.textContent = 'Enviando…'; }

          const res = await sendToBackend(data);
          // ÉXITO → mostrar panel de éxito si existe; si no, cerrar
          if ($success) {
            $form.hidden = true;
            $success.hidden = false;
          } else {
            close();
          }
        } catch (err) {
          const msg = document.createElement('div');
          msg.className = 'tribe-error';
          msg.textContent = 'No se pudo enviar. Inténtalo de nuevo en unos segundos.';
          $btn?.insertAdjacentElement('afterend', msg);
        } finally {
          sending = false;
          if ($btn) { $btn.disabled = false; $btn.textContent = 'UNIRME'; }
        }
      });
    }

    // ===== Decidir: abrir o solo mostrar botón =====
    const decideOpenOrShow = () => {
      const seenUntil = getSeenUntil();
      if (FORCE || isNaN(seenUntil) || now() > seenUntil) {
        setTimeout(open, DELAY_MS);   // primera vez / expirado
      } else {
        showReopen();                 // ya visto → botón
      }
    };

    // Si usas CookieConsent y no hay decisión, espera; si no, ejecuta ya
    const hasCookieAPI = !!(window.CookieConsent && typeof window.CookieConsent.get === 'function');
    const cookieState  = hasCookieAPI ? window.CookieConsent.get() : null;
    if (hasCookieAPI && !('necessary' in (cookieState || {}))) {
      document.addEventListener('pp_cookies_decided', decideOpenOrShow, { once: true });
    } else {
      decideOpenOrShow();
    }
  });
})();
