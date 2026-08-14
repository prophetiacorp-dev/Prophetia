  /* ===================================================================
    PROPHETIA · script.js — build limpio y coherente
    - Helpers base (pp$, pp$$)
    - Montaje PLP safe
    - Compat IDs (cart/wishlist/header)
    - Cart storage + badges + drawer (unico handler)
    - Click universal de card → producto
    - Wishlist (global + PLP)
    - Toast helper
    - Spotify chip (drag/toggle/remember)
    - Popup Tribe (usa .is-open)
    - Fade-in util
    - Wishlist header badge + página wishlist
    - Slider hover
    - PLP (catálogo) modo Prophetia
    - Fallback: garantizar DOM de carrito (si falta)
    =================================================================== */

  /* ========== Helpers mínimos ========== */
  (() => {
    if (window.__PP_HELPERS__) return;
    window.__PP_HELPERS__ = true;

    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    window.pp$ = $; window.pp$$ = $$;
  })();

  /* ========== Account-gated actions ========== */
  (() => {
    if (window.__PP_ACCOUNT_ACTION_GUARD__) return;
    window.__PP_ACCOUNT_ACTION_GUARD__ = true;

    window.ppGetCurrentUser = window.ppGetCurrentUser || (() => (
      window.__ppAuthCurrentUser ||
      window.__ppLastUser ||
      window.__ppFirebaseAuth?.currentUser ||
      null
    ));

    window.ppHasAccountSession = window.ppHasAccountSession || (() => !!window.ppGetCurrentUser?.());

    const ACCOUNT_ACCESS_MESSAGE = 'Inicia sesión o crea una cuenta para guardar productos en tu lista de deseos.';
    const AUTH_OPEN_DELAY = 700;
    let authOpenTimer = 0;
    let waitingForNotice = false;

    const openExistingAuth = () => {
      if (document.querySelector('#ppAuthModal[open], #ppAccountPanel[open]')) return;
      if (typeof window.ppOpenAuth === 'function') {
        window.ppOpenAuth();
      } else {
        document.getElementById('ppAuthLogoBtn')?.click();
      }
    };

    const announceThenOpen = (message) => {
      if (typeof window.ppTopNotice !== 'function' || !document.getElementById('ppTopNotice')) {
        return false;
      }

      window.ppTopNotice(message);
      window.clearTimeout(authOpenTimer);
      authOpenTimer = window.setTimeout(openExistingAuth, AUTH_OPEN_DELAY);
      return true;
    };

    window.ppPromptAccountAccess = window.ppPromptAccountAccess || ((message = ACCOUNT_ACCESS_MESSAGE) => {
      if (announceThenOpen(message) || waitingForNotice) return;

      waitingForNotice = true;
      window.addEventListener('partials:ready', () => {
        waitingForNotice = false;
        announceThenOpen(message);
      }, { once: true });
    });
  })();

  /* ========== Debug switch (solo si localStorage.pp_debug=1) ========== */
  (() => {
    window.ppDebugOn = () => String(localStorage.getItem('pp_debug') || '') === '1';
    window.ppLog = (...args) => { if (window.ppDebugOn()) console.log(...args); };
    window.ppWarn = (...args) => { if (window.ppDebugOn()) console.warn(...args); };
    window.ppErr = (...args) => { if (window.ppDebugOn()) console.error(...args); };
  })();
  /* ========== Debug: 3 checks rápidos (solo si pp_debug=1) ========== */
  (() => {
    const run = () => {
      if (!window.ppDebugOn?.()) return;

      ppLog('[PP] script ok:', !!window.pp$, 'PLP mode:', !!window.__PP_PLP_MODE__);
        if (window.__PP_PLP_RENDERER__ === 'plp-json') return;


      fetch('assets/data/catalog.json', { cache: 'no-store' })
        .then(r => (ppLog('[PP] catalog fetch ok:', r.ok, 'status:', r.status), r.ok))
        .catch(err => ppErr('[PP] catalog fetch FAIL:', err));

      const grid = document.querySelector('#plp-grid');
      ppLog('[PP] grid exists:', !!grid, 'cards:', grid?.children?.length ?? 0);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  })();
  /* ========== Debug: handler global de errores (solo si pp_debug=1) ========== */
  (() => {
    if (window.__PP_ERR_HOOKS__) return;
    window.__PP_ERR_HOOKS__ = true;

    const on = () => !!window.ppDebugOn?.();

    window.addEventListener('error', (ev) => {
      if (!on()) return;
      const src = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '(sin fuente)';
      ppErr('[PP] JS error:', ev.message, src, ev.error || '');
    });

    window.addEventListener('unhandledrejection', (ev) => {
      if (!on()) return;
      ppErr('[PP] Unhandled Promise rejection:', ev.reason);
    });
  })();

  /* ========== Compat IDs (header/cart) ========== */
  (() => {
    if (window.__PP_COMPAT_V1__) return;
    window.__PP_COMPAT_V1__ = true;
    const $ = window.pp$;

    window.__PP_IDS = {
      cartOverlay  : $('#ppCartOverlay') || $('#cartOverlay'),
      cartDrawer   : $('#ppCartDrawer')  || $('#cartDrawer'),
      cartBtn      : $('#ppCartBtn')     || $('#btnCart'),
      cartBtnClose : document.querySelector('[data-close="cart"]') || $('#btnCartClose'),
      cartList     : $('#ppCartList')    || $('#cartList'),
      cartTotal    : $('#ppCartTotal')   || $('#cartTotal'),

      cartCountDrawer : $('#ppCartCount'),

      cartCountHd  : $('#cartCountHd')   || $('#cartCountHeader') || $('#cartCount'),
      cartCount    : $('#cartCount')     || $('#cartCountHd'),
    };

  })();


  /* ========== Click universal de card → producto ========== */
  document.addEventListener('click', (e) => {
   if (
  e.target.closest(
    '.save-btn, .cart-add, [data-save], [data-cart-open], ' +
    '.nav, .icon-btn.save, #loadMoreBtn, .card-wish, ' +
    '.pp-quick-add, [data-quick-add], [data-plp-reserve], ' +
    '[data-stock-notify], [data-plp-collection-pill]'
  )
) {
  return;
}
    const card = e.target.closest('.product-card, .card');
    if (!card) return;

    const id = card.dataset.id || card.getAttribute('data-id');
    if (!id) return;

    const grid = card.closest('#plp-grid, #gridCamisetas');
    const g = (grid?.dataset?.gender || '').trim(); // "mujer" en tu página

    e.preventDefault();
    window.location.assign(`producto?id=${encodeURIComponent(id)}${g ? `&g=${encodeURIComponent(g)}` : ''}`);
  });




  /* ========== Hooks mínimos ========== */
  (() => {
    window.ppCartRefresh = () => { try{ window.ppCart.updateBadges(); }catch{} };
    window.ppInitHome = window.ppInitHome || function(){};
  })();

  /* ========== Wishlist (global) ========== */
  (() => {
    const KEY = 'pp_wishlist_v1';
    const unlocked = () => !!window.ppHasAccountSession?.();
    const promptLogin = () => window.ppPromptAccountAccess?.();
    const load = () => {
      if (!unlocked()) return [];
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
    };
    const save = (arr) => {
      if (!unlocked()) return false;
      localStorage.setItem(KEY, JSON.stringify(arr));
      return true;
    };
    const find = (id, arr) => arr.find(x => String(x.id) === String(id));

    function syncSavedState() {
      const list = load();
      document.querySelectorAll('[data-save]').forEach(btn=>{
        if (btn.closest('#plp-grid, #gridCamisetas')) return;
        const id = btn.getAttribute('data-id');
        const on = !!find(id, list);
        btn.classList.toggle('is-saved', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        const label = on ? 'Quitar de favoritos' : 'Guardar en favoritos';
        btn.title = on ? 'En Mi selección' : 'Guardar en Mi selección';
        btn.setAttribute('aria-label', label);
      });
    }

    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('[data-save]');
      if(!btn) return;
      if (btn.closest('#plp-grid, #gridCamisetas')) return; // PLP se gestiona abajo
      if (!unlocked()) {
        ev.preventDefault();
        ev.stopPropagation();
        promptLogin();
        syncSavedState();
        return;
      }
     const card = btn.closest('.card, .product-card');

const item = {
  id:
    btn.getAttribute('data-id') ||
    card?.getAttribute('data-id') ||
    '',

  title:
    btn.getAttribute('data-title') ||
    card?.querySelector('.card-title a, .card-title, h3, h4')?.textContent?.trim() ||
    'Producto Prophetia',

  price:
    btn.getAttribute('data-price') ||
    card?.querySelector('.card-price, .price')?.textContent?.replace('€', '').trim() ||
    '',

  image:
    btn.getAttribute('data-image') ||
    card?.querySelector('img')?.getAttribute('src') ||
    'assets/img/placeholder.png',

  url:
    btn.getAttribute('data-url') ||
    card?.querySelector('.card-title a, .card-media, a[href]')?.getAttribute('href') ||
    `producto?id=${encodeURIComponent(card?.getAttribute('data-id') || '')}`
};
if (!item.id) {
  console.warn('[WISHLIST] Producto sin id, no se puede guardar:', item);
  return;
}
      let list = load();
      const hit = find(item.id, list);
      list = hit ? list.filter(x => String(x.id) !== String(item.id)) : [...list, item];
      if (!save(list)) return;
      syncSavedState();
      document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
    });

    window.addEventListener('partials:ready', syncSavedState);
    window.addEventListener('pp:auth-changed', syncSavedState);
    window.addEventListener('pp:auth-ready', syncSavedState);
    document.addEventListener('DOMContentLoaded', syncSavedState);
    const grid = document.getElementById('gridCamisetas');
    if (grid) new MutationObserver(syncSavedState).observe(grid, { childList:true, subtree:true });
  })();

  /* ========== Wishlist (PLP) + inyección botón ❤️ ========== */
  (() => {
    const KEY='pp_wishlist_v1';
    const unlocked = () => !!window.ppHasAccountSession?.();
    const promptLogin = () => window.ppPromptAccountAccess?.();
    const load = () => {
      if (!unlocked()) return [];
      try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; }
    };
    const save = (arr) => {
      if (!unlocked()) return false;
      localStorage.setItem(KEY, JSON.stringify(arr));
      return true;
    };
    const exists = (id, arr) => arr.some(x => String(x.id) === String(id));

    function makeBtn(data){
      const btn = document.createElement('button');
      btn.className = 'icon-btn save';
      btn.type = 'button';
      btn.setAttribute('data-save','');
      btn.setAttribute('aria-label', 'Guardar en favoritos');
      btn.setAttribute('aria-pressed', 'false');
      for (const [k,v] of Object.entries(data)) btn.setAttribute('data-'+k, v||'');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5c0-2.6 2-4.5 4.5-4.5 1.6 0 3 .9 4 2 1-1.1 2.4-2 4-2 2.5 0 4.5 1.9 4.5 4.5 0 4.4-8.5 9.5-8.5 9.5S3 14.9 3 10.5Z"/></svg>`;
      return btn;
    }

    function syncState(){
      const list = load();
      document.querySelectorAll('#plp-grid [data-save], #gridCamisetas [data-save]').forEach(btn=>{
        const on = exists(btn.getAttribute('data-id'), list);
        btn.classList.toggle('is-saved', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        const label = on ? 'Quitar de favoritos' : 'Guardar en favoritos';
        btn.title = on ? 'En Mi selección' : 'Guardar en Mi selección';
        btn.setAttribute('aria-label', label);
      });
    }

    function injectButtons(){
      document.querySelectorAll('#plp-grid, #gridCamisetas').forEach(g=>{
        g.querySelectorAll('.card').forEach(card=>{
          if (card.querySelector('[data-save]')) return;

          const id = card.getAttribute('data-id')
            || (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

          const title =
            card.querySelector('.card-title a, .card-title, .product-card__title, h4')
              ?.textContent?.trim() || 'Producto Prophetia';

          const image = card.querySelector('img')?.getAttribute('src') || 'assets/img/placeholder.png';
          const url   = card.querySelector('a')?.getAttribute('href') || 'producto';

          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
          const host  = card.querySelector('.plp-media, .card-media, .img-wrap') || card;
          host.appendChild(makeBtn({ id, title, image, url }));
        });
      });

      syncState();
    }

    // ✅ Click handler (bien cerrado) — solo actúa en PLP
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-save]');
      if (!btn) return;

      const inPLP = btn.closest('#plp-grid, #gridCamisetas');
      if (!inPLP) return;

      ev.preventDefault();
      ev.stopPropagation();

      if (!unlocked()) {
        promptLogin();
        syncState();
        return;
      }

      const item = {
        id: btn.getAttribute('data-id'),
        title: btn.getAttribute('data-title') || 'Producto Prophetia',
        price: btn.getAttribute('data-price') || '',
        image: btn.getAttribute('data-image') || 'assets/img/placeholder.png',
        url: btn.getAttribute('data-url') || 'producto'
      };

      let list = load();
      const wasSaved = exists(item.id, list);

      list = wasSaved
        ? list.filter(x => String(x.id) !== String(item.id))
        : [...list, item];

      if (!save(list)) return;
      syncState();
      document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));

      if (!wasSaved) {
        window.ppTopNotice?.('Añadido a artículos guardados');
      }
    });

    // ✅ Observer y hooks (FUERA del click)
    const obs = new MutationObserver(injectButtons);
    document.querySelectorAll('#plp-grid, #gridCamisetas')
      .forEach(g => obs.observe(g, { childList:true, subtree:true }));

    document.addEventListener('DOMContentLoaded', injectButtons);
    window.addEventListener('partials:ready', injectButtons);
    window.addEventListener('pp:auth-changed', syncState);
    window.addEventListener('pp:auth-ready', syncState);
  })();

  /* ========== Top notice (Prophetia-style) ========== */
  (() => {
    const TIME = 2600;
    let t;

    window.ppTopNotice = (msg = 'Añadido a artículos guardados') => {
      const box = document.getElementById('ppTopNotice');
      const txt = document.getElementById('ppTopNoticeMsg');
      const btn = document.getElementById('ppTopNoticeClose');
      if (!box || !txt) return false;
      if (box.parentElement !== document.body) {
        document.body.appendChild(box);
      }

      txt.textContent = msg;

      box.hidden = false;
      box.setAttribute('aria-hidden', 'false');

      if (btn && !btn.__ppBound) {
        btn.__ppBound = true;
        btn.addEventListener('click', () => {
          box.setAttribute('aria-hidden', 'true');
          box.hidden = true;
        });
      }

      clearTimeout(t);
      t = setTimeout(() => {
        box.setAttribute('aria-hidden', 'true');
        box.hidden = true;
      }, TIME);
      return true;
    };
  })();

  /* ========== Toast helper ========== */
  (() => {
    const TOAST_TIME = 2600;
    let t; window.ppToast = (msg='Añadido a artículos guardados', href='/wishlist')=>{
      const box = document.getElementById('ppToast'); if(!box) return;
      box.hidden = false;
      box.querySelector('#ppToastMsg').textContent = msg;
      box.querySelector('#ppToastAction').setAttribute('href', href);
      box.classList.add('is-open'); clearTimeout(t);
      t = setTimeout(()=>box.classList.remove('is-open'), TOAST_TIME);
    };
  })();


  /* ========== Popup Tribe (delegado a popup.js) ========== */
  (() => {
    const modal  = document.getElementById('tribeModal');
    const reopen = document.getElementById('tribeReopen');
    if (!modal) return;

    // Delegamos en la API pública creada en popup.js
    const open  = () => window.ppTribeOpen && window.ppTribeOpen();
    const close = () => window.ppTribeClose && window.ppTribeClose();

    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    modal.querySelector('.tribe-backdrop')?.addEventListener('click', close);
    reopen?.addEventListener('click', (e)=>{ e.preventDefault(); open(); });

    // Te dejo la utilidad para consola:
    window.ppTribeOpen  = window.ppTribeOpen  || open;
    window.ppTribeClose = window.ppTribeClose || close;
  })();

  /* ========== Fade-in util ========== */
  (() => {
    const io = new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); }),{threshold:.2});
    document.querySelectorAll('[data-fade]').forEach(el=>io.observe(el));
  })();

  /* ========== Wishlist badge en header ========== */
  (() => {
    const KEY='pp_wishlist_v1';
    const load=()=>{
      if (!window.ppHasAccountSession?.()) return [];
      try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}
    };
    const update=()=>{
      const savedButton = document.getElementById('ppSavedBtn');
      if (savedButton) savedButton.dataset.count = String(load().length);
    };
    window.addEventListener('storage', update);
    window.addEventListener('partials:ready', update);
    document.addEventListener('DOMContentLoaded', update);
    document.addEventListener('pp:wishlist:changed', update);
    window.addEventListener('pp:wishlist-updated', update);
    window.addEventListener('pp:auth-changed', update);
    window.addEventListener('pp:auth-ready', update);
    update();
  })();

  /* ========== Toggle mostrar/ocultar contraseña (delegaciones) ========== */
  document.addEventListener('click', (e) => {
    const isAuth = e.target.closest('#ppAuthModal .toggle-pass');
    const generic = e.target.closest('.toggle-pass');
    const btn = isAuth || (generic && !generic.closest('#ppAuthModal') ? generic : null);
    if (!btn) return;
    const wrap  = btn.closest('.sp-password');
    const input = wrap?.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;
    const toText = input.type === 'password';
    input.type = toText ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(toText));
    btn.setAttribute('aria-label', toText ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  /* ========== Slider hover (teasers) ========== */
  document.addEventListener('mouseover', e=>{
    const slider = e.target.closest('[data-slider]'); if(!slider) return;
    const track  = slider.querySelector('.slider-track'); const slides = track?.children.length || 0; let idx = 0;
    slider._hoverTimer = setInterval(()=>{ idx=(idx+1)%slides; track.style.transform = `translateX(-${idx*100}%)`; }, 1200);
  });
  document.addEventListener('mouseout', e=>{
    const slider = e.target.closest('[data-slider]'); if(!slider) return;
    clearInterval(slider._hoverTimer); const track = slider.querySelector('.slider-track'); if(track) track.style.transform='translateX(0%)';
  });

  /* ========== PLP modo Prophetia (catálogo escalable) ========== */
  /* ========== PLP modo Prophetia (catálogo escalable) ========== */
  (async function PP_PLP_PROPHETIA_MODE(){
    if (window.__PP_PLP_MODE__) return;
    window.__PP_PLP_MODE__ = true;

    const grid = document.querySelector('#plp-grid');
    if (!grid) return;

    const $  = window.pp$  || ((s,r=document)=>r.querySelector(s));
    const $$ = window.pp$$ || ((s,r=document)=>[...r.querySelectorAll(s)]);

    const PAGE_SIZE = Number(grid.dataset.pageSize) || 12;

    const norm  = (v='') => String(v ?? '').trim().toLowerCase();
    const upper = (v='') => String(v ?? '').trim().toUpperCase();

    // ✅ NUEVO: página -> sección + género (viene de data-*)
    const SECTION_RAW = norm(grid.dataset.section || '');
    const GENDER_RAW  = norm(grid.dataset.gender  || '');

    // Normaliza valores típicos ES -> EN (evita 0 resultados por mismatch)
    const GENDER_MAP = { hombre:'men', man:'men', male:'men', mujer:'women', woman:'women', female:'women', unisex:'unisex' };

    // landing pages: no filtrar por sección (incluye "all/todos")
    const SECTION_MAP = {
      hombre:'', men:'', mujer:'', women:'',
      all:'', todos:'', 'all-products':'', 'all_product':''
    };

    const SECTION = SECTION_MAP[SECTION_RAW] ?? SECTION_RAW;
    const GENDER  = GENDER_MAP[GENDER_RAW]  ?? GENDER_RAW;


    function fmtEUR(v){

      if (typeof v !== 'number') return '';
      try {
        return new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(v);
      } catch {
        return `${Math.round(v)} €`;
      }
    }

   // ✅ Resolver media por género (STRICT: mujer nunca usa hombre)
function resolveMedia(p){
  const m = p && typeof p.media === 'object' ? p.media : null;
  if (!m) return null;

  if (GENDER === 'women' || GENDER_RAW === 'mujer') {
    return m.mujer || m.women || null;
  }

  if (GENDER === 'men' || GENDER_RAW === 'hombre') {
    return m.hombre || m.men || null;
  }

  if (GENDER === 'unisex' || GENDER_RAW === 'unisex') {
    return m.unisex || m.default || null;
  }

  return m.default || m.unisex || null;
}


    function imgOf(p){
      const m = p._media;
      return (m && m.cover) || p.cover || (Array.isArray(p.images) && p.images[0]) || 'assets/img/placeholder.png';
    }

    function imagesOf(p){
      const m = p._media;
      const arr = (m && Array.isArray(m.images) && m.images.length) ? m.images : p.images;
      return (Array.isArray(arr) && arr.length) ? arr : [imgOf(p)];
    }

    function gridImagesOf(p){
      const listing = (p._media && Array.isArray(p._media.listingImages))
        ? [...new Set(p._media.listingImages.filter(Boolean))]
        : [];

      if (listing.length) return listing.slice(0, 2);

      const primary = imgOf(p);
      const gallery = [...new Set([primary, ...imagesOf(p)].filter(Boolean))];

      if (gallery.length < 2) return gallery;

      const secondaryCandidates = gallery.filter(src => src !== primary);
      const reverse = secondaryCandidates.find(src =>
        /back|tras|rear|reverse|verso|dorso/i.test(String(src).split('?')[0])
      );

      return [primary, reverse || secondaryCandidates[0]].filter(Boolean);
    }

    async function fetchCatalog(){
    // 1) Intentar Firestore si está habilitado en la página
    if (grid.dataset.source === 'firestore') {
      try {
        const { fetchProductsForPLP } = await import('./plp-firestore.js');
        const section = norm(grid.dataset.section || '');
        const gender  = norm(grid.dataset.gender  || '');
        const data = await fetchProductsForPLP({ section, gender });
        if (Array.isArray(data)) return data;
      } catch (e) {
        console.error('[PLP] Firestore fetch failed, fallback JSON:', e);
      }
    }

    // 2) Fallback a JSON (tu sistema actual)
    const url = grid.dataset.catalog || 'assets/data/catalog.json';
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('catalog.json debe ser un array []');
    return data;
  }



    const getVariants = (p) => Array.isArray(p.variants) ? p.variants : [];
    const variantColors = (p) => [...new Set(getVariants(p).map(v => norm(v.color)).filter(Boolean))];
    const variantSizes = (p) => [...new Set(getVariants(p).map(v => upper(v.size)).filter(Boolean))];
    const variantStock = (p) => getVariants(p).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    const productStock = (p) => getVariants(p).length ? variantStock(p) : (p.inStock === false ? 0 : Number(p.stock ?? 1));
    const productDate = (p) => {
      const raw = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : (p.createdAt || p.date || p.publishedAt || 0);
      const value = typeof raw === 'number' ? raw : Date.parse(raw);
      return Number.isFinite(value) ? value : 0;
    };
    const productSales = (p) => Number(p.sales ?? p.sold ?? p.orderCount ?? p.sortSales ?? 0) || 0;

    let raw;
    try {
      raw = await fetchCatalog();
    } catch (err){
      console.error('[PLP] Error catálogo:', err);
      grid.innerHTML = `<p class="muted" style="padding:16px 0;">No se pudo cargar el catálogo.</p>`;
      return;
    }

      // ✅ NUEVO: filtrar por SECTION (tolerante) y por media de género si existe
    const PRODUCTS = raw
     .filter(p => {
  if (!SECTION) return true; // landing: no filtrar
  const sec = norm(p.section || p.category || p.type || '');
  if (!sec) return false;    // ✅ si estamos en una sección, sin section = fuera
  return sec === SECTION
    || sec === SECTION_RAW
    || (SECTION === 'camisetas-punto' && sec === 'camisetas');
})

      .map(p => ({ ...p, _id: String(p.id), _media: resolveMedia(p) }))

        .filter(p => {
        if (!p.media || typeof p.media !== 'object' || !GENDER) return true;

        // Si es media por género (tiene alguna clave típica), exigimos que exista para este género
        const mm = p.media;
        const hasGenderKeys =
          ('men' in mm) || ('women' in mm) || ('hombre' in mm) || ('mujer' in mm);

          if (!hasGenderKeys) return true; // si no es media por género, lo dejamos pasar
    return !!p._media;              // si es por género, exigimos bucket válido

      })

      .map(p => ({
        ...p,
        _collection: norm(p.collection),
        _gender: norm(p.gender),
        _fit: norm(p.fit),
        _color: norm(p.color || ''),
        _colors: [...new Set([norm(p.color || ''), ...variantColors(p)].filter(Boolean))],
        _sizes: [...new Set([...(Array.isArray(p.sizes) ? p.sizes.map(upper) : []), ...variantSizes(p)].filter(Boolean))],
        _stock: productStock(p),
        inStock: getVariants(p).length ? productStock(p) > 0 : p.inStock
      }));

    const BY_ID = new Map(PRODUCTS.map(p => [p._id, p]));

    const ACTIVE = window.__PP_ACTIVE_FILTERS__ || (window.__PP_ACTIVE_FILTERS__ = {});
    const state = { page: 1, sort: 'relevance' };
    const normalizeSortMode = (mode = 'relevance') => {
      const value = String(mode || 'relevance').trim();
      if (value === 'featured') return 'relevance';
      if (value === 'price_asc') return 'price-asc';
      if (value === 'price_desc') return 'price-desc';
      return value || 'relevance';
    };


    const sortMap = {
      relevance:  (a,b) => (Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
      price_asc:  (a,b) => (a.price ?? 0) - (b.price ?? 0),
      price_desc: (a,b) => (b.price ?? 0) - (a.price ?? 0),
      'price-asc':  (a,b) => (a.price ?? 0) - (b.price ?? 0),
      'price-desc': (a,b) => (b.price ?? 0) - (a.price ?? 0),
      'name-asc': (a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' }),
      'name-desc': (a,b) => String(b.title || '').localeCompare(String(a.title || ''), 'es', { sensitivity: 'base' }),
      'best-selling': (a,b) => productSales(b) - productSales(a),
      newest:     (a,b) => productDate(b) - productDate(a),
      oldest:     (a,b) => productDate(a) - productDate(b),
      availability: (a,b) => productStock(b) - productStock(a)
    };

    function applyFilters(list, f){
      let out = list.slice();
      if (f.inStock) out = out.filter(p => p._stock > 0 && p.inStock !== false);
      if (f.isNew)   out = out.filter(p => !!p.isNew);

      if (Array.isArray(f.collections) && f.collections.length){
        const want = f.collections.map(norm);
        out = out.filter(p => want.includes(p._collection));
      }
      if (Array.isArray(f.colors) && f.colors.length){
        const want = f.colors.map(norm);
        out = out.filter(p => (p._colors || [p._color]).some(color => want.includes(color)));
      }
      if (Array.isArray(f.sizes) && f.sizes.length){
        const want = f.sizes.map(upper);
        out = out.filter(p => want.some(s => p._sizes.includes(s)));
      }
      return out;
    }

    function cardHTML(p){
  const g = (GENDER || GENDER_RAW || '').trim();
  const url = `producto?id=${encodeURIComponent(p.id)}${g ? `&g=${encodeURIComponent(g)}` : ''}`;

  const out = p.inStock === false;

  let badge = '';
  if (out) badge = `<span class="card-badge is-out">OUT OF STOCK</span>`;
  else if (p.isNew) badge = `<span class="card-badge is-new">NEW</span>`;

  const imgs = gridImagesOf(p);
  const dataImages = imgs.join('|');
  const hasReverse = imgs.length > 1;
  const containsListingMedia = norm(p._media?.listingFit) === 'contain';

  return `
    <article class="card ${hasReverse ? 'has-carousel has-product-reverse' : ''}${containsListingMedia ? ' has-contained-listing-media' : ''}"
            data-id="${p._id}"
            data-images="${dataImages}"
            data-img-index="0"
            data-sort-order="${Number(p.sortOrder ?? 0) || 0}"
            data-sales="${productSales(p)}"
            data-date="${productDate(p)}"
            data-price="${Number(p.price ?? 0) || 0}">

      <div class="plp-media">
        <a class="card-media" href="${url}" aria-label="${p.title || 'Producto Prophetia'}" data-id="${p._id}">
          <img class="card-media__image card-media__image--front" loading="lazy" src="${imgs[0]}" alt="${p.title || 'Producto Prophetia'}">
          ${hasReverse ? `<img class="card-media__image card-media__image--reverse" loading="lazy" src="${imgs[1]}" alt="" aria-hidden="true">` : ''}
          <div class="card-badges">${badge}</div>
        </a>

        ${hasReverse ? `
          <button class="nav prev" type="button" aria-label="Mostrar vista frontal"></button>
          <button class="nav next" type="button" aria-label="Mostrar vista trasera"></button>
        ` : ''}
      </div>

      <div class="card-body">
        <h3 class="card-title">
          <a href="${url}" data-id="${p._id}">${p.title || 'Producto Prophetia'}</a>
        </h3>
        <p class="card-sub">${p.short || ''}</p>
        <div class="card-meta">
          <span class="card-price">${fmtEUR(p.price)}</span>
        </div>
      </div>
    </article>`;
}
  
    

    function render(){
      const filtered = applyFilters(PRODUCTS, ACTIVE);
      const sortMode = normalizeSortMode(state.sort);
      const sorted = (sortMode in sortMap) ? filtered.slice().sort(sortMap[sortMode]) : filtered;

      const visible = sorted.slice(0, state.page * PAGE_SIZE);
  if (!visible.length) {
    grid.innerHTML = `<p class="muted" style="padding:16px 0;">No hay productos para esta sección.</p>`;
  } else {
    grid.innerHTML = visible.map(cardHTML).join('');
  }

      document.dispatchEvent(new CustomEvent('pp:plp:rendered', {
        detail: { total: sorted.length, shown: visible.length, section: SECTION, gender: GENDER }
      }));
    }

  

// API pública para filtros y módulos asociados al PLP
window.ppPLP = window.ppPLP || {};

window.ppPLP.count = (draft = {}) => {
  return applyFilters(PRODUCTS, {
    ...ACTIVE,
    ...draft
  }).length;
};

window.ppPLP.apply = (draft = {}) => {
  Object.assign(ACTIVE, draft);
  state.page = 1;
  render();
};

window.ppPLP.sort = (mode = 'relevance') => {
  state.sort = normalizeSortMode(mode);
  state.page = 1;
  render();
};

window.ppPLP.getState = () => ({ ...state, filters: { ...ACTIVE } });

window.ppPLP.getProduct = (productId) => {
  const id = String(productId || '').trim();

  if (!id) {
    return null;
  }

  return BY_ID.get(id) || null;
};

    document.addEventListener('pp:plp:filter', (ev) => window.ppPLP.apply(ev.detail || {}));

    const moreBtn = document.querySelector('#loadMoreBtn');
    moreBtn?.addEventListener('click', () => { state.page++; render(); });

  

    render();

    /* =========================================================
   PROPHETIA · PLP Carousel + Wishlist safe click
   - Botones reales: .nav.prev / .nav.next
   - Evita navegación accidental al producto
   - Compatible con cards re-renderizadas desde Firestore
   ========================================================= */
(() => {
  if (window.__PP_PLP_CAROUSEL__) return;
  window.__PP_PLP_CAROUSEL__ = true;

  const grid = document.getElementById('plp-grid');
  if (!grid) return;

  const splitImages = (card) => {
    const raw = String(card.getAttribute('data-images') || '').trim();
    if (!raw) return [];

    // Soporta formato antiguo con | y formato JSON si algún render lo genera así.
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }

    return raw.split('|').map(s => s.trim()).filter(Boolean);
  };

  const normalizeSrc = (src) => {
    const value = String(src || '').trim().replaceAll('\\', '/');
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value)) return value;
    return value.startsWith('/') ? value : `/${value}`;
  };

  const setIndex = (card, nextIndex) => {
    const images = splitImages(card).map(normalizeSrc).filter(Boolean);
    if (images.length <= 1) return;

    const img = card.querySelector('.card-media img, .plp-media img');
    if (!img) return;

    const len = images.length;
    const safeIndex = ((nextIndex % len) + len) % len;

    card.dataset.imgIndex = String(safeIndex);

    if (card.classList.contains('has-product-reverse')) {
      card.classList.toggle('is-showing-reverse', safeIndex === 1);
      return;
    }

    img.src = images[safeIndex];
  };

grid.addEventListener('click', (e) => {
  const navBtn = e.target.closest('button.nav.prev, button.nav.next');

  // Carrusel: nunca debe abrir producto.
  if (!navBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const card = navBtn.closest('.card.has-carousel, .card');
    if (!card) return;

    const currentIndex = Number(card.dataset.imgIndex || '0');
    const direction = navBtn.classList.contains('next') ? 1 : -1;

    setIndex(card, currentIndex + direction);
  }, true);

document.addEventListener('pp:plp:rendered', () => {
  grid.querySelectorAll('.card.has-carousel, .card[data-images]').forEach(card => {
    if (!card.dataset.imgIndex) card.dataset.imgIndex = '0';
  });
});
})();

})(); // ✅ CIERRA PP_PLP_PROPHETIA_MODE





  /* ===== PROPHETIA · Fix carga limpia + delays elegantes ===== */

  // 1) Cerrar SIEMPRE todos los mega-panels al entrar/recargar
  function ppCloseMegaAll(){
    document.body.classList.remove('pp-mega-open');
document.querySelectorAll('.mega').forEach(mega => {
      mega.classList.remove('is-open');
      mega.removeAttribute('data-active-panel');
    });

    document.querySelectorAll('.mega-toggle').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-expanded','false');
      b.setAttribute('aria-selected','false');
    });

    document.querySelectorAll('.mega-panel').forEach(p => {
      p.hidden = true;
      p.classList.remove('open','is-open');
      p.setAttribute('aria-hidden','true');
    });

    document.querySelectorAll('.mega .panel[role="tabpanel"]').forEach(panel => {
      panel.hidden = true;
    });
  }
  document.addEventListener('DOMContentLoaded', ppCloseMegaAll);
  window.addEventListener('pageshow', ppCloseMegaAll);
  window.addEventListener('partials:ready', ppCloseMegaAll); // por si usas Swup en otras páginas

  // 2) Defendernos de Swup inexistente en popup.js (evita error y auto-aperturas)
  window.ppSafeSwupOn = function ppSafeSwupOn(evt, fn){
    if (window.swup && window.swup.hooks && typeof window.swup.hooks.on === 'function'){
      window.swup.hooks.on(evt, fn);
    } else {
      // fallback: ejecuta en carga normal
      if (evt === 'page:view') {
        if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
        window.addEventListener('pageshow', fn);
      }
    }
  };
  /* =========================================================
    PROPHETIA · House Opener (GIF) — Sin Swup (Exit + Entry)
    - Exit: abre overlay y retrasa navegación (para que SE VEA)
    - Entry: en prophetia-house.html mantiene total MIN_MS y cierra
    - pageshow: evita “pantalla negra” por bfcache
    ========================================================= */
  (() => {
    if (window.__PP_HOUSE_OPENER__) return;
    window.__PP_HOUSE_OPENER__ = true;

    const HOUSE_RE = /(^|\/)house\.html(\?|#|$)/i;

    const KEY_T0   = 'pp_house_opener_t0';
    const MIN_MS   = 1200;   // duración total deseada
    const EXIT_MS  = 260;    // cuánto retardo antes de navegar (para que se perciba)

    const els = () => ({
      wrap: document.getElementById('ppHouseOpener'),
      gif:  document.getElementById('ppHouseOpenerGif')
    });

    function openOverlay(restartGif = true){
      const { wrap, gif } = els();
      if (!wrap) return false;

      document.documentElement.classList.add('pp-house-transition');
      wrap.classList.add('is-open');
      wrap.setAttribute('aria-hidden', 'false');

      if (restartGif && gif) {
        gif.src = `assets/video/house.gif?v=${Date.now()}`;
      }
      return true;
    }

    function closeOverlay(){
      const { wrap } = els();
      if (!wrap) return;
      wrap.classList.remove('is-open');
      wrap.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('pp-house-transition');
    }

    // EXIT: click hacia Prophetia House -> overlay + delay + navegar
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const href = a.getAttribute('href') || '';
      if (!HOUSE_RE.test(href)) return;

      e.preventDefault();

      const t0 = Date.now();
      sessionStorage.setItem(KEY_T0, String(t0));

      openOverlay(true);

      // Forzar paint real antes de navegar
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => window.location.assign(href), EXIT_MS);
        });
      });
    }); // ✅ <— ESTA LÍNEA FALTABA
    // ENTRY: si estamos en prophetia-house y venimos marcados -> mantener hasta completar MIN_MS
    function runEntry(){
      const t0s = sessionStorage.getItem(KEY_T0);
      if (!t0s) return;

      const isHouse = HOUSE_RE.test(location.pathname) || HOUSE_RE.test(location.href);
      if (!isHouse) return;

      const t0 = Number(t0s) || Date.now();
      sessionStorage.removeItem(KEY_T0);

      openOverlay(true);

      const elapsed = Date.now() - t0;
      const remain  = Math.max(0, MIN_MS - elapsed);

      setTimeout(() => closeOverlay(), remain);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runEntry, { once: true });
    } else {
      runEntry();
    }

    // Anti “pantalla negra” por bfcache: al volver atrás, cierra overlay si no hay transición activa
    window.addEventListener('pageshow', () => {
      if (!sessionStorage.getItem(KEY_T0)) closeOverlay();
    });
  })();




  /* Prophetia · activar salida del Painted Curtain cuando la página está lista */
  (function () {
    const done = () => {
      document.documentElement.classList.add('pp-loaded');
      setTimeout(() => {
        const loader = document.getElementById('ppPaintLoader');
        if (loader) loader.remove(); // opcional, limpiar del DOM
      }, 1200);
    };

    if (document.readyState === 'complete') {
      done();
    } else {
      window.addEventListener('load', done);
    }
  })();


/* =========================================================
   PROPHETIA - Shared PLP toolbar controls
   Sort, stock and view support for clothing PLPs.
   ========================================================= */
(() => {
  if (window.__PP_SHARED_PLP_TOOLBAR__) return;
  window.__PP_SHARED_PLP_TOOLBAR__ = true;

  const body = document.body;
  const sortReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sortCloseStates = new WeakMap();
  let activeSort = 'relevance';

  const normalizeSort = (mode = 'relevance') => {
    const value = String(mode || 'relevance').trim();
    if (value === 'featured') return 'relevance';
    if (value === 'price_asc') return 'price-asc';
    if (value === 'price_desc') return 'price-desc';
    return value || 'relevance';
  };

  const getGrid = () => document.querySelector('#plp-grid, #gridCamisetas');

  const getCards = (grid = getGrid()) => grid
    ? Array.from(grid.querySelectorAll(':scope > .card, :scope > .product-card, :scope > article'))
    : [];

  const getProduct = (card) => {
    const productId = String(card?.dataset?.id || '').trim();
    if (!productId || typeof window.ppPLP?.getProduct !== 'function') return null;

    try {
      return window.ppPLP.getProduct(productId) || null;
    } catch (_) {
      return null;
    }
  };

  const getTitle = (card) => (
    card.querySelector('.card-title, .product-card__title, [data-title]')?.dataset?.title ||
    card.querySelector('.card-title, .product-card__title, [data-title]')?.textContent ||
    ''
  ).trim().toLowerCase();

  const getPrice = (card) => {
    const node = card.querySelector('.price, .card-price, .product-card__price, [data-price]');
    const raw = String(card.dataset.price || node?.dataset?.price || node?.textContent || '')
      .replace(/\s/g, '')
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3})/g, '')
      .replace(',', '.');
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
  };

  const getCardNumber = (card, keys) => {
    const product = getProduct(card);
    for (const key of keys) {
      const value = Number.parseFloat(card.dataset[key] || product?.[key] || '');
      if (Number.isFinite(value)) return value;
    }
    return 0;
  };

  const getSortOrder = (card) => getCardNumber(card, ['sortOrder']);
  const getSales = (card) => getCardNumber(card, ['sales', 'sold', 'orderCount', 'sortSales']);
  const getDate = (card) => {
    const product = getProduct(card);
    const raw = card.dataset.date || card.dataset.createdAt || card.dataset.publishedAt ||
      product?.createdAt || product?.date || product?.publishedAt || 0;
    const seconds = raw?.seconds;
    const numeric = Number(raw);
    const value = seconds
      ? Number(seconds) * 1000
      : (Number.isFinite(numeric) && numeric > 0 ? numeric : Date.parse(raw));
    return Number.isFinite(value) ? value : 0;
  };

  const sortDomGrid = (mode) => {
    const grid = getGrid();
    if (!grid) return;

    const cards = getCards(grid);
    if (!cards.length) return;

    cards.forEach((card, index) => {
      if (card.dataset.originalIndex == null) card.dataset.originalIndex = String(index);
    });

    cards.sort((a, b) => {
      const original = Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
      if (mode === 'price-asc') return getPrice(a) - getPrice(b) || original;
      if (mode === 'price-desc') return getPrice(b) - getPrice(a) || original;
      if (mode === 'name-asc') return getTitle(a).localeCompare(getTitle(b), 'es', { sensitivity: 'base' }) || original;
      if (mode === 'name-desc') return getTitle(b).localeCompare(getTitle(a), 'es', { sensitivity: 'base' }) || original;
      if (mode === 'best-selling') return getSales(b) - getSales(a) || original;
      if (mode === 'newest') return getDate(b) - getDate(a) || original;
      if (mode === 'oldest') return getDate(a) - getDate(b) || original;
      if (mode === 'relevance') return getSortOrder(a) - getSortOrder(b) || original;
      return original;
    });

    const fragment = document.createDocumentFragment();
    cards.forEach((card) => fragment.appendChild(card));
    grid.appendChild(fragment);
  };

  const applySort = (mode) => {
    activeSort = normalizeSort(mode);
    sortDomGrid(activeSort);
  };

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.(
      '#sortSelect, #womenSortSelect, #menSortSelect, select[data-plp-sort]'
    );
    if (!select) return;
    applySort(select.value || 'relevance');
  });

  document.addEventListener('pp:plp:rendered', () => {
    window.requestAnimationFrame(() => sortDomGrid(activeSort));
  });

  const setSortLabel = (root, option) => {
    const label = option.textContent.trim();
    const trigger = root.querySelector('.pp-sort-trigger');
    if (!trigger || !label) return;
    trigger.textContent = label;
  };

  const setSortActive = (root, option) => {
    root.querySelectorAll('.pp-sort-option').forEach((item) => {
      const active = item === option;
      item.classList.toggle('is-active', active);
      if (item.hasAttribute('aria-selected') || item.getAttribute('role') === 'option') {
        item.setAttribute('aria-selected', active ? 'true' : 'false');
      }
    });
  };

  const positionSortMenu = (root) => {
    const trigger = root.querySelector('.pp-sort-trigger');
    const menu = root.querySelector('.pp-sort-menu');
    if (!trigger || !menu || menu.hidden) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.min(280, Math.max(180, window.innerWidth - (viewportPadding * 2)));
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );

    menu.style.setProperty('--pp-sort-popover-width', `${width}px`);
    menu.style.setProperty('--pp-sort-popover-left', `${Math.round(left)}px`);

    const menuHeight = Math.min(menu.scrollHeight || 0, window.innerHeight * .6, 420);
    const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const top = spaceBelow >= menuHeight
      ? triggerRect.bottom + 6
      : Math.max(viewportPadding, triggerRect.top - menuHeight - 6);
    menu.style.setProperty('--pp-sort-popover-top', `${Math.round(top)}px`);
  };

  const cancelPendingSortClose = (root) => {
    const state = sortCloseStates.get(root);
    if (!state) return;
    window.clearTimeout(state.timer);
    state.menu?.removeEventListener('transitionend', state.onTransitionEnd);
    sortCloseStates.delete(root);
  };

  const closeSort = (root, { restoreFocus = false } = {}) => {
    const trigger = root.querySelector('.pp-sort-trigger[aria-expanded]');
    const menu = root.querySelector('.pp-sort-menu');
    const isDetails = root.tagName.toLowerCase() === 'details';
    cancelPendingSortClose(root);
    root.classList.remove('is-open', 'is-opening');
    trigger?.setAttribute('aria-expanded', 'false');

    if (isDetails) {
      root.open = false;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
      return;
    }

    if (!menu || menu.hidden) {
      root.classList.remove('is-closing');
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
      return;
    }

    root.classList.add('is-closing');
    menu.setAttribute('inert', '');
    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      const state = sortCloseStates.get(root);
      if (state) {
        window.clearTimeout(state.timer);
        menu.removeEventListener('transitionend', state.onTransitionEnd);
        sortCloseStates.delete(root);
      }
      if (!root.classList.contains('is-closing')) return;
      root.classList.remove('is-closing');
      menu.hidden = true;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    const onTransitionEnd = (event) => {
      if (event.target === menu && ['opacity', 'transform'].includes(event.propertyName)) finalize();
    };

    if (sortReducedMotionQuery.matches) {
      finalize();
      return;
    }

    menu.addEventListener('transitionend', onTransitionEnd);
    const timer = window.setTimeout(finalize, 260);
    sortCloseStates.set(root, { menu, onTransitionEnd, timer });
  };

  const openCustomSort = (root, { focusOption = false } = {}) => {
    document.querySelectorAll('.pp-sort.is-open, .pp-sort.is-opening').forEach((item) => {
      if (item !== root) closeSort(item);
    });

    const trigger = root.querySelector('.pp-sort-trigger[aria-expanded]');
    const menu = root.querySelector('.pp-sort-menu');
    if (!trigger || !menu) return;

    cancelPendingSortClose(root);
    root.classList.remove('is-open', 'is-closing');
    root.classList.add('is-opening');
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    menu.setAttribute('inert', '');
    positionSortMenu(root);
    window.requestAnimationFrame(() => {
      if (!root.classList.contains('is-opening') || menu.hidden) return;
      root.classList.remove('is-opening');
      root.classList.add('is-open');
      menu.removeAttribute('inert');
      positionSortMenu(root);

      if (focusOption) {
        const selected = menu.querySelector('.pp-sort-option[aria-selected="true"], .pp-sort-option.is-active');
        const fallback = menu.querySelector('.pp-sort-option');
        (selected || fallback)?.focus({ preventScroll: true });
      }
    });
  };

  const toggleCustomSort = (root) => {
    if (root.classList.contains('is-open') || root.classList.contains('is-opening')) {
      closeSort(root);
      return;
    }
    openCustomSort(root);
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;

    const customTrigger = event.target.closest('.pp-sort-trigger');
    const customRoot = customTrigger?.closest('.pp-sort');
    if (customRoot && customRoot.tagName.toLowerCase() !== 'details') {
      event.preventDefault();
      toggleCustomSort(customRoot);
      return;
    }

    const option = event.target.closest('.pp-sort-option');
    const sortRoot = option?.closest('.pp-sort');
    if (option && sortRoot) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setSortActive(sortRoot, option);
      setSortLabel(sortRoot, option);
      applySort(option.dataset.sort || 'relevance');
      closeSort(sortRoot, { restoreFocus: true });
      return;
    }

    const viewButton = event.target.closest('.pp-view-toggle, .pp-filter-right .pp-btn[aria-pressed]');
    if (!viewButton || !viewButton.closest('.pp-filters')) return;

    event.preventDefault();
    viewButton.classList.add('pp-view-toggle');

    const dense = !body.classList.contains('is-plp-dense-view');
    body.classList.toggle('is-plp-dense-view', dense);
    viewButton.setAttribute('aria-pressed', dense ? 'true' : 'false');
    viewButton.textContent = dense ? 'Vista normal' : 'Vista';
  });

  document.addEventListener('pointerdown', (event) => {
    document.querySelectorAll('.pp-sort.is-open, .pp-sort.is-opening').forEach((root) => {
      if (!root.contains(event.target)) closeSort(root);
    });
  });

  document.addEventListener('focusin', (event) => {
    document.querySelectorAll('.pp-sort.is-open, .pp-sort.is-opening').forEach((root) => {
      if (!root.contains(event.target)) closeSort(root);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const trigger = event.target.closest?.('.pp-sort-trigger');
    const triggerRoot = trigger?.closest('.pp-sort');
    if (triggerRoot && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openCustomSort(triggerRoot, { focusOption: true });
      return;
    }

    const option = event.target.closest?.('.pp-sort-option');
    const optionRoot = option?.closest('.pp-sort');
    if (option && optionRoot && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const options = Array.from(optionRoot.querySelectorAll('.pp-sort-option:not([disabled])'));
      const current = options.indexOf(option);
      if (current < 0 || !options.length) return;
      event.preventDefault();
      let next = current;
      if (event.key === 'ArrowDown') next = (current + 1) % options.length;
      if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      options[next]?.focus({ preventScroll: true });
      return;
    }

    if (event.key !== 'Escape') return;
    const openRoots = Array.from(document.querySelectorAll(
      '.pp-sort.is-open, .pp-sort.is-opening, details.pp-sort[open]'
    ));
    if (!openRoots.length) return;
    event.preventDefault();
    openRoots.forEach((root) => closeSort(root, { restoreFocus: true }));
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.pp-sort.is-open').forEach(positionSortMenu);
  });

  window.addEventListener('scroll', (event) => {
    if (event.target instanceof Element && event.target.closest('.pp-sort-menu')) return;
    document.querySelectorAll('.pp-sort.is-open').forEach(positionSortMenu);
  }, { capture: true, passive: true });
})();
