/* =========================================================
   PROPHETIA — Compat Layer (IDs + helpers)
   ========================================================= */
(function () {
  if (window.__PP_COMPAT_V1__) return;  // evita doble inyección
  window.__PP_COMPAT_V1__ = true;

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  window.pp$ = $; window.pp$$ = $$;

  // Mapea elementos con preferencia por los IDs del parcial (pp…)
  const ids = {
    cartOverlay  : $('#ppCartOverlay') || $('#cartOverlay'),
    cartDrawer   : $('#ppCartDrawer')  || $('#cartDrawer'),
    cartBtn      : $('#ppCartBtn')     || $('#btnCart'),
    cartBtnClose : document.querySelector('[data-close="cart"]') || $('#btnCartClose'),
    cartList     : $('#ppCartList')    || $('#cartList'),
    cartInfo     : $('#ppCartInfoBlock') || $('#cartInfoBlock'),
    cartTotal    : $('#ppCartTotal')   || $('#cartTotal'),
    cartCountHd  : $('#cartCountHd')   || $('#cartCountHeader') || $('#cartCount'),
    cartCount    : $('#cartCount')     || $('#cartCountHd'),
  };
  window.__PP_IDS = ids;
})();

/* =========================================================
   PROPHETIA — Cart core (storage + badges)
   ========================================================= */
(function () {
  const CART_KEY = 'pp_cart_v2';

  function load() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  }
  function save(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  function money(n) {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    } catch {
      return `${n.toFixed(2)} €`;
    }
  }

  function sum(cart) {
    return cart.reduce((acc, it) => acc + (it.price * it.qty), 0);
  }
  function count(cart) {
    return cart.reduce((acc, it) => acc + it.qty, 0);
  }

  function updateBadges() {
    const cart = load();
    const n = count(cart);
    const ids = window.__PP_IDS || {};
    if (ids.cartCountHd) ids.cartCountHd.textContent = n;
    if (ids.cartCount)   ids.cartCount.textContent   = n;
    if (ids.cartTotal)   ids.cartTotal.textContent   = money(sum(cart));
  }

  // Expone una API mínima global (por si la usas en otras páginas)
  window.ppCart = { load, save, money, sum, count, updateBadges, CART_KEY };

  // Auto-sync al cargar la página
  document.addEventListener('DOMContentLoaded', updateBadges);
})();
/* =========================================================
   PROPHETIA — Catálogo (render desde assets/data/catalog.json)
   ========================================================= */
(function () {
  async function loadCatalog() {
    const res = await fetch('assets/data/catalog.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar catalog.json');
    return await res.json();
  }

  function cardHTML(p) {
    // p: { id, slug, title, collection, category, price, images[] }
    const href = `producto.html?slug=${encodeURIComponent(p.slug || p.id)}`;
    const img  = (p.images && p.images[0]) || '/assets/img/Atlas/ATLASDEFINITIVO-IMPRES.png';
    const price = (typeof p.price === 'number') ? window.ppCart.money(p.price) : (p.price || '—');
    return `
      <article class="card">
        <a class="img-wrap" href="${href}">
          <img src="${img}" alt="${p.title || 'Producto Prophetia'}">
        </a>
        <h4>${p.title || 'Producto Prophetia'}</h4>
        ${p.collection ? `<p class="collection">${p.collection}</p>` : ''}
        <span class="price">${price}</span>
        <a href="${href}" class="btn-primary">Ver</a>
      </article>
    `.trim();
  }

  async function ppInitCatalog({ target, category, query } = {}) {
    const grid = document.querySelector(target);
    if (!grid) return;

    const all = await loadCatalog();

    // Filtro por categoría si la hay (ej. "camisetas" o "hoodies")
    // Filtro por categoría si la hay (acepta category o type del JSON)
    let items = Array.isArray(all) ? all : (all.items || []);

    function normCat(p){
      const c = (p.category || '').toLowerCase();
      const t = (p.type || '').toLowerCase(); // ej: 'tshirt', 'hoodie'
      if (c) return c;
      if (t === 'tshirt' || t === 'tee' || t === 'camiseta') return 'camisetas';
      if (t === 'hoodie' || t === 'sudadera') return 'hoodies';
      return '';
    }
    if (category){
      const want = category.toLowerCase();
      items = items.filter(p => normCat(p) === want);
    }


    grid.innerHTML = items.map(cardHTML).join('') || `<p class="muted">No hay productos que coincidan.</p>`;
    // Actualiza contadores del carrito por si renderiza botones/acciones más adelante
    window.ppCart.updateBadges();
  }

  // Export global
  window.ppInitCatalog = ppInitCatalog;

})();

(function(){
  const KEY_PRIMARY   = 'pp_cart_v2';
  const KEY_FALLBACK  = 'pp_cart'; // por si tenías el formato anterior

  const els = {
    btn     : document.getElementById('ppCartBtn'),
    drawer  : document.getElementById('ppCartDrawer'),
    overlay : document.getElementById('ppCartOverlay'),
    list    : document.getElementById('ppCartList'),
    total   : document.getElementById('ppCartTotal'),
  };

  if(!els.drawer || !els.overlay || !els.list || !els.total){
    console.warn('[Cart] Faltan elementos del DOM (IDs). Revisa header.html');
    return;
  }

  // --------- Storage helpers ----------
  function readRaw(){
    // intenta primaria y si no, fallback
    const a = localStorage.getItem(KEY_PRIMARY);
    if (a) { try{ return JSON.parse(a); }catch{ /*noop*/ } }
    const b = localStorage.getItem(KEY_FALLBACK);
    if (b) { try{ return JSON.parse(b); }catch{ /*noop*/ } }
    return [];
  }
  function writeRaw(cart){
    localStorage.setItem(KEY_PRIMARY, JSON.stringify(cart||[]));
  }
  const money = (n)=> new Intl.NumberFormat('es-ES',{style:'currency', currency:'EUR'}).format(n||0);

  // --------- Render ----------
  function render(){
    const cart = readRaw();
    if(!Array.isArray(cart) || cart.length===0){
      els.list.innerHTML = '<p class="muted" style="padding:12px 0;">Tu cesta está vacía.</p>';
      els.total.textContent = money(0);
      if (els.btn) els.btn.title = 'Carrito (0)';
      return;
    }

    let html = '';
    let subtotal = 0;
    cart.forEach((it, i)=>{
      const qty   = Number(it.qty||1);
      const price = Number(it.price||0);
      subtotal += price * qty;

      const img   = it.img || it.cover || (it.images && it.images[0]) || 'assets/img/placeholder.png';
      const title = it.title || 'Producto';
      const meta  = [it.color, it.size].filter(Boolean).join(' · ');
      const metaHtml = meta ? `<div class="cart-item__meta">${meta}</div>` : '';

      html  ` 
        <article class="cart-item" data-i="${i}" style="display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #eee;">
          <div class="cart-item__thumb" style="width:72px;height:92px;border:1px solid #eee;border-radius:10px;overflow:hidden;background:#f7f7f7;">
            <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div>
            <div class="cart-item__title" style="font-weight:600;">${escapeHTML(title)}</div>
            ${metaHtml}
            <div class="cart-item__row" style="display:flex;gap:8px;align-items:center;margin-top:8px;">
              <button class="qbtn" data-op="-" aria-label="Restar" style="width:28px;height:28px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;cursor:pointer;">−</button>
              <span>${qty}</span>
              <button class="qbtn" data-op="+" aria-label="Sumar" style="width:28px;height:28px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;cursor:pointer;">+</button>
              <button class="rm"   aria-label="Eliminar" style="margin-left:8px;font-size:12px;color:#666;cursor:pointer;">Eliminar</button>
            </div>
            <div class="muted" style="margin-top:8px;font-size:12px;">Entrega estimada: <strong>2–6 días hábiles</strong></div>
          </div>
          <div class="cart-item__price" style="font-weight:700;">${money(price*qty)}</div>
        </article>`;
    });

    els.list.innerHTML = html;
    els.total.textContent = money(subtotal);
    if (els.btn) els.btn.title = `Carrito (${cart.reduce((s,x)=>s+(+x.qty||0),0)})`;
  }

  function escapeHTML(s=''){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  // --------- Mutaciones ----------
  function mutate(i, op){
    const cart = readRaw();
    const it = cart[i];
    if (!it) return;
    if (op === '+') it.qty = (Number(it.qty)||1) + 1;
    if (op === '-') it.qty = Math.max(1,(Number(it.qty)||1) - 1);
    writeRaw(cart); render();
  }
  function removeAt(i){
    let cart = readRaw();
    cart.splice(i,1);
    writeRaw(cart); render();
  }

  // Delegación clicks dentro de la lista
  els.list.addEventListener('click', (e)=>{
    const row = e.target.closest('.cart-item'); if(!row) return;
    const idx = Number(row.dataset.i);
    const q   = e.target.closest('.qbtn');
    const rm  = e.target.closest('.rm');
    if (q)  mutate(idx, q.dataset.op);
    if (rm) removeAt(idx);
  });

  // --------- Abrir / Cerrar ----------
  function open(){ els.drawer.classList.add('open'); els.overlay.classList.add('active'); document.body.classList.add('no-scroll'); }
  function close(){ els.drawer.classList.remove('open'); els.overlay.classList.remove('active'); document.body.classList.remove('no-scroll'); }

  // Botones / overlay / ESC
  els.overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });

  // Cualquier elemento con data-cart-open (o #ppCartBtn) abre
  document.addEventListener('click', (e)=>{
    if (e.target.closest('[data-cart-open], #ppCartBtn')) { e.preventDefault(); render(); open(); }
    if (e.target.closest('[data-close="cart"], .cart-close')) { e.preventDefault(); close(); }
  });

  // --------- API pública para añadir ----------
  window.ppAddToCart = function add(product){
    // Espera {id,title,price,img,color,size,qty}
    // Si ya existe mismo id+size+color, acumula.
    const p = Object.assign({qty:1}, product||{});
    const cart = readRaw();

    const same = cart.find(x => x.id===p.id && x.size===p.size && x.color===p.color);
    if (same) same.qty += Number(p.qty)||1;
    else cart.push({
      id:String(p.id||Math.random()).slice(2),
      title:p.title||'Producto',
      price:Number(p.price)||0,
      img:p.img || p.cover || (p.images && p.images[0]) || 'assets/img/placeholder.png',
      color:p.color||'',
      size:p.size||'',
      qty:Number(p.qty)||1
    });

    writeRaw(cart);
    render(); open();
  };

  // Primera pintura
  document.addEventListener('DOMContentLoaded', render);

  // Helpers consola (útiles para pruebas)
  window.ppOpenCart  = ()=>{ render(); open(); };
  window.ppCloseCart = close;
})();
/* =========================================================
   PROPHETIA — Hooks mínimos de página
   ========================================================= */
(function () {
  // Llama a esto tras "añadir al carrito" o "eliminar"
  window.ppCartRefresh = function () {
    try { window.ppCart.updateBadges(); } catch {}
  };

  // Si mañana necesitas init de la home, puedes definir:
  window.ppInitHome = window.ppInitHome || function(){};
})();


/* =========================================================
   PROPHETIA — Wishlist (guardar desde catálogo)
   ========================================================= */
(function(){
  const KEY = 'pp_wishlist';

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const find = (id, arr) => arr.find(x => String(x.id) === String(id));

  // Marca visual si ya está guardado
  function syncSavedState() {
    const list = load();
    document.querySelectorAll('[data-save]').forEach(btn=>{
      const id = btn.getAttribute('data-id');
      const on = !!find(id, list);
      btn.classList.toggle('is-saved', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'En Mi selección' : 'Guardar en Mi selección';
    });
  }

  // Delegación de clicks
  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-save]');
    if(!btn) return;

    const item = {
      id    : btn.getAttribute('data-id'),
      title : btn.getAttribute('data-title') || 'Producto Prophetia',
      price : btn.getAttribute('data-price') || '',
      image : btn.getAttribute('data-image') || 'assets/img/placeholder.png',
      url   : btn.getAttribute('data-url')   || 'producto.html'
    };

    let list = load();
    const hit = find(item.id, list);

    if (hit) {
      // Si ya existe, togglear: lo quitamos
      list = list.filter(x => String(x.id) !== String(item.id));
    } else {
      list.push(item);
    }

    save(list);
    syncSavedState();
  });

  // Sincroniza cuando el catálogo se pinta o cambia
  window.addEventListener('partials:ready', syncSavedState);
  document.addEventListener('DOMContentLoaded', syncSavedState);
  const obs = new MutationObserver(syncSavedState);
  const grid = document.getElementById('gridCamisetas');
  if (grid) obs.observe(grid, { childList:true, subtree:true });
})();


(function addWishlistButtonsPostRender(){
  function addButtons() {
    const cards = document.querySelectorAll('#gridCamisetas .product-card');
    cards.forEach(card=>{
      if (card.querySelector('[data-save]')) return; // ya tiene botón
      const id    = card.getAttribute('data-id') || crypto.randomUUID();
      const title = card.querySelector('.product-card__title')?.textContent?.trim() || 'Producto Prophetia';
      const img   = card.querySelector('img')?.getAttribute('src') || 'assets/img/placeholder.png';
      const url   = card.querySelector('a')?.getAttribute('href') || 'producto.html';

      const btn = document.createElement('button');
      btn.className = 'icon-btn save';
      btn.setAttribute('data-save','');
      btn.setAttribute('data-id', id);
      btn.setAttribute('data-title', title);
      btn.setAttribute('data-image', img);
      btn.setAttribute('data-url', url);
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-9.33-8.05A5.5 5.5 0 1 1 12 6.2a5.5 5.5 0 1 1 9.33 6.75C19 16.65 12 21 12 21z" fill="currentColor"/></svg>';

      (card.querySelector('.product-card__actions') || card).appendChild(btn);
    });
    // dispara sincronización si el handler A está cargado
    window.dispatchEvent(new Event('partials:ready'));
  }
  document.addEventListener('DOMContentLoaded', addButtons);
  const grid = document.getElementById('gridCamisetas');
  if (grid) new MutationObserver(addButtons).observe(grid, { childList:true, subtree:true });
})();


/* ===== Wishlist: botón ❤️ por card + handler ===== */
(function(){
  const KEY = 'pp_wishlist';
  const grid = document.getElementById('gridCamisetas');

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const exists = (id, arr) => arr.some(x => String(x.id) === String(id));

  function makeBtn(data){
    const btn = document.createElement('button');
    btn.className = 'icon-btn save';
    btn.setAttribute('data-save','');
    for (const [k,v] of Object.entries(data)) btn.setAttribute('data-'+k, v||'');
    btn.innerHTML = btn.innerHTML = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none"
     stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 10.5c0-2.6 2-4.5 4.5-4.5 1.6 0 3 .9 4 2 1-1.1 2.4-2 4-2 2.5 0 4.5 1.9 4.5 4.5 0 4.4-8.5 9.5-8.5 9.5S3 14.9 3 10.5Z"/>
</svg>`;

    return btn;
  }

  function injectButtons(){
    if (!grid) return;
    const cards = grid.querySelectorAll('.card');

    cards.forEach(card=>{
      if (card.querySelector('[data-save]')) return;

      // Datos básicos desde la card
      const id    = card.getAttribute('data-id') || crypto.randomUUID();
      const title = card.querySelector('.product-card__title, h4')?.textContent?.trim() || 'Producto Prophetia';
      const image = card.querySelector('img')?.getAttribute('src') || 'assets/img/placeholder.png';
      const url   = card.querySelector('a')?.getAttribute('href') || 'producto.html';

      // asegura posicionamiento
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

      const btn = makeBtn({ id, title, image, url });
      // si tienes .img-wrap, colócalo dentro para que quede sobre la imagen
      (card.querySelector('.img-wrap') || card).appendChild(btn);
    });
    syncState();
  }

  function syncState(){
    const list = load();
    document.querySelectorAll('[data-save]').forEach(btn=>{
      const on = exists(btn.getAttribute('data-id'), list);
      btn.classList.toggle('is-saved', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'En Mi selección' : 'Guardar en Mi selección';
    });
  }

  // Toggle guardar/quitar
  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-save]');
    if (!btn) return;
    const item = {
      id: btn.getAttribute('data-id'),
      title: btn.getAttribute('data-title') || 'Producto Prophetia',
      price: btn.getAttribute('data-price') || '',
      image: btn.getAttribute('data-image') || 'assets/img/placeholder.png',
      url: btn.getAttribute('data-url') || 'producto.html'
    };
    let list = load();
    if (exists(item.id, list)) list = list.filter(x => String(x.id) !== String(item.id));
    else list.push(item);
    save(list);
    syncState();
  });

  // Observa cuando ppInitCatalog termine de inyectar
  const obs = new MutationObserver(injectButtons);
  if (grid) obs.observe(grid, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', injectButtons);
  window.addEventListener('partials:ready', injectButtons);
})();
/* ===== Prophetia — Toast helper ===== */
(function(){
  const TOAST_TIME = 2600; // ms visible
  let hideTimer = null;

  window.ppToast = function(msg = 'Añadido a artículos guardados', actionHref = 'wishlist.html'){
    const box = document.getElementById('ppToast');
    if(!box) return; // si no existe, salimos sin romper nada

    box.hidden = false;
    box.querySelector('#ppToastMsg').textContent = msg;
    box.querySelector('#ppToastAction').setAttribute('href', actionHref);

    // muestra
    box.classList.add('is-open');

    // rearmar temporizador
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>{
      box.classList.remove('is-open');
    }, TOAST_TIME);
  };
})();


// =====================================================
// Prophetia — Spotify Chip (drag + toggle + remember)
// Requiere: #ppAudioChip y #ppAudioPanel del header.html
// =====================================================
window.ppInitAudio = function initAudioChip(){
  const chip  = document.getElementById('ppAudioChip');
  const panel = document.getElementById('ppAudioPanel');
  if (!chip || !panel) return;

  const KEY = 'pp_audio_pos_v1';

  // --- helpers de posición ---
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const getChipRect = () => chip.getBoundingClientRect();
  const getPanelRect = () => panel.getBoundingClientRect();
  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

  function savePos(x, y){ localStorage.setItem(KEY, JSON.stringify({x,y})); }
  function loadPos(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  }

  function place(x, y){
    // límites para que el chip no “salga” de la pantalla
    const { w, h } = viewport();
    const cw = chip.offsetWidth  || 1;
    const ch = chip.offsetHeight || 1;
    const safeX = clamp(x, 8, w - cw - 8);
    const safeY = clamp(y, 8, h - ch - 8);
    chip.style.left = safeX + 'px';
    chip.style.top  = safeY + 'px';
    chip.style.right = 'auto'; // anulamos right/top fijos del CSS
    chip.style.position = 'fixed';
    savePos(safeX, safeY);
    positionPanel();
  }

  function positionPanel(){
    // sitúa el panel justo debajo del chip y alineado al borde dcho del chip
    const cr = getChipRect();
    panel.style.position = 'fixed';
    panel.style.top  = Math.round(cr.bottom + 8) + 'px';
    // si cabe a la derecha, alineado; si no, que no se salga
    const { w } = viewport();
    const pr = getPanelRect(); // ojo: si está oculto, dale un width fijo CSS
    const desiredRight = Math.max(12, w - cr.right);
    panel.style.right = desiredRight + 'px';
  }

  // --- estado inicial (posición) ---
  const stored = loadPos();
  if (stored) {
    place(stored.x, stored.y);
  } else {
    // posición por defecto: centrado arriba (debajo del header)
    requestAnimationFrame(() => {
      const { w } = viewport();
      const cw = chip.offsetWidth || 140;
      const x = Math.round((w - cw) / 2);
      const y = 16; // pegado arriba
      place(x, y);
    });
  }

  // --- Drag (mouse + touch) ---
  let dragging = false, startX = 0, startY = 0, baseX = 0, baseY = 0;

  function onDown(e){
    const p = e.touches ? e.touches[0] : e;
    dragging = true;
    chip.classList.add('dragging');
    const r = getChipRect();
    startX = p.clientX; startY = p.clientY;
    baseX = r.left;     baseY = r.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend', onUp);
  }

  function onMove(e){
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    if (e.touches) e.preventDefault(); // evita scroll mientras arrastras
    const dx = p.clientX - startX;
    const dy = p.clientY - startY;
    place(baseX + dx, baseY + dy);
  }

  function onUp(){
    dragging = false;
    chip.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }

  chip.addEventListener('mousedown', onDown);
  chip.addEventListener('touchstart', onDown, {passive:true});

  // --- Toggle del panel ---
  let open = false;
  function togglePanel(){
    open = !open;
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', String(!open));
    if (open) positionPanel();
  }
  chip.addEventListener('click', (e) => {
    // Si el click fue “dragging”, no togglear: tolerancia pequeña
    if (dragging) return;
    togglePanel();
  });

  // Recalcula límites si cambia el viewport
  window.addEventListener('resize', () => {
    const pos = loadPos();
    if (pos) place(pos.x, pos.y);
    if (!panel.classList.contains('hidden')) positionPanel();
  });
};
/* ======================================================
   Prophetia Tribe — POPUP controller
   ====================================================== */
(function () {
  const KEY = 'pp_tribe_seen_v1';  // cambia versión para “forzar” reaparición
  const DELAY_MS = 3000;           // retraso antes de mostrar (3s)
  const REOPEN_DAYS = 30;          // reaparece tras X días (30 = una vez/mes)

  const $modal = document.getElementById('tribeModal');
  if (!$modal) return;

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
  $closes.forEach(btn => btn.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $modal.classList.contains('open')) close();
  });

  const seenUntil = getSeenUntil();
  if (isNaN(seenUntil) || now() > seenUntil) {
    setTimeout(open, DELAY_MS);
  }

  const $form = document.getElementById('tribeForm');
  if ($form) {
    $form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: aquí integrar fetch/AJAX hacia tu backend o servicio (Klaviyo/Mailchimp).
      close();
    });
  }
})();
