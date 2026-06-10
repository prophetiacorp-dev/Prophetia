/* === Prophetia · Cookie consent (memoria) + apertura Tribe con cooldown === */
(() => {
  const KEY = 'pp_cookie_choice_v1';
  const COOLDOWN_KEY = 'pp_tribe_last_show_ts';
  const COOLDOWN_MS  = 24*60*60*1000; // 24h
  const DELAY_MS     = 9000;          // banner a los 9s

  const $ = sel => document.querySelector(sel);
  const banner = () => $('#cc-banner');

  const showBanner = () => {
    document.documentElement.removeAttribute('data-cc-prehide');
    const b = banner(); if (!b) return;
    b.removeAttribute('hidden');
    b.classList.add('is-visible');
    b.setAttribute('aria-hidden','false');
  };
  const hideBanner = () => {
    const b = banner(); if (!b) return;
    b.classList.remove('is-visible');
    b.setAttribute('aria-hidden','true');
  };

  // Mostrar (solo si no hay elección guardada)
  window.addEventListener('load', () => {
    const hasChoice = !!localStorage.getItem(KEY);
    if (!hasChoice) setTimeout(showBanner, DELAY_MS);
    else { document.documentElement.removeAttribute('data-cc-prehide'); hideBanner(); }
  });

  // Guardar elección (Aceptar / Rechazar / Preferencias)
  const setChoice = (val) => {
    localStorage.setItem(KEY, JSON.stringify({ val, ts: Date.now() }));
    document.dispatchEvent(new CustomEvent('pp_cookies_decided', { detail:{ val }}));
  };

  document.addEventListener('click', (e) => {
    const id = (e.target && e.target.id) || '';
    if (id === 'onetrust-accept-btn-handler') { e.preventDefault(); setChoice('accept_all'); hideBanner(); }
    if (id === 'onetrust-reject-all-handler') { e.preventDefault(); setChoice('reject_all'); hideBanner(); }
    if (id === 'onetrust-pc-btn-handler')     { setChoice('prefs'); /* abrirías tu modal si aplica */ }
  });

  /* --- Opcional: programar apertura del Tribe a los 5s si no hay banner --- */
  function shouldShowTribe(){
    const last = +localStorage.getItem(COOLDOWN_KEY) || 0;
    const enough = Date.now() - last > COOLDOWN_MS;
    const cookiesOpen = banner() && banner().classList.contains('is-visible');
    return enough && !cookiesOpen;
  }
  function openTribe(){
    if (typeof window.ppTribeOpen === 'function'){
      window.ppTribeOpen();
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    }
  }
  window.addEventListener('load', () => {
    setTimeout(() => { if (shouldShowTribe()) requestAnimationFrame(openTribe); }, 5000);
  });
})();
