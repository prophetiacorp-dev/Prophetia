/* ====== PROPHETIA — Montador seguro de Catálogo (PLP) ====== */
function ppMountCatalogSafe({ target, category }) {
  const mount = document.querySelector(target);
  if (!mount || !window.ppInitCatalog) return;  // no hay hueco o función base
  window.ppInitCatalog({ target, category });
}

// Hook opcional tras carga parcial (Swup u otro)
window.addEventListener('partials:ready', () => {
  const grid = document.querySelector('#plp-grid');
  if (grid) {
    ppMountCatalogSafe({ target: '#plp-grid', category: grid.dataset.category || 'camisetas-hombre' });
  }
});


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
/* ============================================================
   PROPHETIA · Click universal de productos (camisetas, hoodies, etc.)
   ============================================================ */
document.addEventListener('click', (e) => {
if (e.target.closest('.save-btn, .cart-add, [data-save], [data-cart-open], .nav, #loadMoreBtn, .card-wish')) return;

const card = e.target.closest('.product-card, .card');

    if (!card) return;
  const id = card.dataset.id || card.getAttribute('data-id');   
    if (!id) return;
   e.preventDefault();
   window.location.assign(`producto.html?id=${encodeURIComponent(id)}`);
 });

function matchesCategory(p, cat){
  if (!cat) return true;
  const c = String(cat).trim().toLowerCase();

  // normaliza campos posibles
  const fields = [
    p.category && String(p.category).toLowerCase(),
    p.type && String(p.type).toLowerCase(),
    ...(Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase()) : [])
  ].filter(Boolean);

  return fields.includes(c);
}

/* =========================================================
   PROPHETIA — Catálogo (render desde assets/data/catalog.json)
   ========================================================= */


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
  setTimeout(() => { 
    try { window.ppCartInit && window.ppCartInit(); } catch(e){} 
  }, 80);
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

  html += `
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
          <button class="rm" aria-label="Eliminar" style="margin-left:8px;font-size:12px;color:#666;cursor:pointer;">Eliminar</button>
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
try { window.ppCart.updateBadges(); } catch {}
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
  const KEY = 'pp_wishlist_v1';

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
 // Evita duplicidad: si viene del grid PLP/teaser, lo maneja el otro bloque
 if (btn.closest('#plp-grid, #gridCamisetas')) return;
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
  // Notifica a otras vistas (contador/empty state) que la wishlist cambió
  document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
  });

  // Sincroniza cuando el catálogo se pinta o cambia
  window.addEventListener('partials:ready', syncSavedState);
  document.addEventListener('DOMContentLoaded', syncSavedState);
  const obs = new MutationObserver(syncSavedState);
  const grid = document.getElementById('gridCamisetas');
  if (grid) obs.observe(grid, { childList:true, subtree:true });
})();




/* ===== Wishlist: botón ❤️ por card + handler ===== */
(function(){
  const KEY = 'pp_wishlist_v1';



  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const exists = (id, arr) => arr.some(x => String(x.id) === String(id));

  function makeBtn(data){
    const btn = document.createElement('button');
    btn.className = 'icon-btn save';
    btn.setAttribute('data-save','');
    for (const [k,v] of Object.entries(data)) btn.setAttribute('data-'+k, v||'');
    btn.innerHTML = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none"
     stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 10.5c0-2.6 2-4.5 4.5-4.5 1.6 0 3 .9 4 2 1-1.1 2.4-2 4-2 2.5 0 4.5 1.9 4.5 4.5 0 4.4-8.5 9.5-8.5 9.5S3 14.9 3 10.5Z"/>
</svg>`;

    return btn;
  }

   function injectButtons(){
    const grids = document.querySelectorAll('#plp-grid, #gridCamisetas');
    if (!grids.length) return;

    grids.forEach(g=>{
      const cards = g.querySelectorAll('.card');
      cards.forEach(card=>{
        if (card.querySelector('[data-save]')) return;

        const id    = card.getAttribute('data-id') || (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
        const title = card.querySelector('.product-card__title, h4')?.textContent?.trim() || 'Producto Prophetia';
        const image = card.querySelector('img')?.getAttribute('src') || 'assets/img/placeholder.png';
        const url   = card.querySelector('a')?.getAttribute('href') || 'producto.html';

        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

        const btn = makeBtn({ id, title, image, url });
        (card.querySelector('.img-wrap') || card).appendChild(btn);
      });
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
    const inPLP = btn.closest('#plp-grid, #gridCamisetas');
  if (!inPLP) return; // ← Solo maneja el PLP; fuera lo gestiona el primer bloque
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
    document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
  });

  // Observa cuando ppInitCatalog termine de inyectar


  // Observa cuando ppInitCatalog termine de inyectar
  const obs = new MutationObserver(injectButtons);
  document.querySelectorAll('#plp-grid, #gridCamisetas')
    .forEach(g => obs.observe(g, { childList:true, subtree:true }));
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


// === Fade-in Prophetia ===
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting) e.target.classList.add('visible');
  });
},{threshold:.2});
document.querySelectorAll('[data-fade]').forEach(el=>observer.observe(el));



(function(){
  const KEY='pp_wishlist_v1';
  const a = document.getElementById('ppSavedBtn');
  if(!a) return;
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  function update(){ a.dataset.count = String(load().length); }
  document.addEventListener('storage', update);
  document.addEventListener('DOMContentLoaded', update);
  document.addEventListener('pp:wishlist:changed', update);
  update();
})();
/* ===== Wishlist UI sync (conteo + estado vacío) ===== */
(function(){
  const isWishlist = document.body.classList.contains('wishlist-page');
  if (!isWishlist) return;

  const $countSpan = document.getElementById('wlCount');
  const $empty     = document.querySelector('.wl-empty');
  const $grid      = document.querySelector('.wishlist-grid') || document.querySelector('.wl-results');
function getCountFromDOM(){
  return document.querySelectorAll('.wishlist-grid .product-card, .wishlist-grid .card').length;
}

  function getCountFromStorage(){
    try {
const ls = JSON.parse(localStorage.getItem('pp_wishlist_v1') || '[]');
return Array.isArray(ls) ? ls.length : 0;
    } catch(e){ return 0; }
  }

  function render(){
    // coge el mayor (por si pintas por DOM o por LS)
    const n = Math.max(getCountFromDOM(), getCountFromStorage());
    const label = n === 1 ? 'producto' : 'productos';
    if ($countSpan) $countSpan.textContent = n;

    // muestra/oculta estado vacío
    if ($empty && $grid){
      if (n === 0){ $empty.hidden = false; $grid.style.display = 'none'; }
      else        { $empty.hidden = true;  $grid.style.display = '';     }
    }
  }

  // inicial y cada vez que pueda cambiar la lista
  document.addEventListener('pp:wishlist:changed', render);
  document.addEventListener('DOMContentLoaded', render);
  render();
})();




  
  // (Opcional) aquí puedes reusar la lógica de wishlist/toast que ya usas en camisetas

// === Mostrar/Ocultar contraseña (delegación, funciona en todos los paneles) ===
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.toggle-pass');
  if (!btn) return;
if (btn.closest('#ppAuthModal')) return; // ya lo gestiona el handler específico
  const wrap = btn.closest('.sp-password');
  const input = wrap && wrap.querySelector('input[type="password"], input[type="text"]');
  if (!input) return;

  const toText = input.type === 'password';
  input.type = toText ? 'text' : 'password';

  // Accesibilidad + estados
  btn.setAttribute('aria-pressed', String(toText));
  btn.setAttribute('aria-label', toText ? 'Ocultar contraseña' : 'Mostrar contraseña');
});
/* === Auth · Toggle mostrar/ocultar contraseña (login/register) === */
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('#ppAuthModal .toggle-pass');
  if (!btn) return;

  const wrap  = btn.closest('.sp-password');
  const input = wrap ? wrap.querySelector('input[type="password"], input[type="text"]') : null;
  if (!input) return;

  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';

  // Accesibilidad + feedback visual
  btn.setAttribute('aria-pressed', String(!showing));
  btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');

  // Cambia el icono si quieres
  // btn.textContent = showing ? '👁' : '🙈';
});
document.addEventListener('mouseover', e=>{
  const slider = e.target.closest('[data-slider]');
  if(!slider) return;
  const track = slider.querySelector('.slider-track');
  const slides = track.children.length;
  let idx = 0;
  slider._hoverTimer = setInterval(()=>{
    idx = (idx + 1) % slides;
    track.style.transform = `translateX(-${idx*100}%)`;
  }, 1200);
});
document.addEventListener('mouseout', e=>{
  const slider = e.target.closest('[data-slider]');
  if(!slider) return;
  clearInterval(slider._hoverTimer);
  slider.querySelector('.slider-track').style.transform = 'translateX(0%)';
});

/* === PP · PLP PROPHETIA-MODE (Catálogo profesional Prophetia) ========== */
/* === Módulo seguro para renderizar catálogo solo en páginas válidas === */
(async function PP_PLP_PROPHETIA_MODE(){
  // ===== Protege ejecución: solo en páginas con #plp-grid =====
 if (!document.querySelector('#plp-grid')) return;

 // --------- Config ----------
 const PAGE_SIZE = 12;

  const SELECTORS = {
    grid: '#plp-grid',
    toolbar: '#plp-toolbar',
    sort: '#sortSelect',
    loadMore: '#loadMoreBtn',
    quickCats: '#quickCats'
  };

  // --------- Helpers ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const ensure = (html, sel, parent=document.body) => {
    if (!$(sel)) parent.insertAdjacentHTML('beforeend', html);
    return $(sel);
  };
  const fmtPrice = v => typeof v==='number' ? `${v.toFixed(0)}€` : v;
  const imgOr = p => p.cover || (p.images && p.images[0]) || '';
  const swatchesOf = p => Array.isArray(p.colors) && p.colors.length ? p.colors : [imgOr(p)];

  // --------- Data load ----------
  async function loadCatalog(){
    const res = await fetch('assets/data/catalog.json', { cache:'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar catalog.json');
    const data = await res.json();
    // Filtramos CAMISETAS (tshirt) para “camisetas-hombre”; mantenemos unisex
    return data.filter(p => String(p.type).toLowerCase()==='tshirt');
  }

  const all = await loadCatalog();
  let state = {
    raw: all.slice(),
    items: all.slice(),
    page: 1,
    sort: 'relevance',
    chips: {}
  };

  // --------- Sorting ----------
  function sortItems(items, mode){
    const arr = items.slice();
    switch(mode){
      case 'price_asc':  return arr.sort((a,b)=>(a.price??0)-(b.price??0));
      case 'price_desc': return arr.sort((a,b)=>(b.price??0)-(a.price??0));
      case 'newest':     return arr.sort((a,b)=> (b.createdAt??0)-(a.createdAt??0));
      default:           return arr; // relevance: orden natural
    }
  }

  // --------- Quick Categories (chips) ----------
  function buildChips(items){
    const fits = new Set(items.map(p => p.fit).filter(Boolean));
    const colls = new Set(items.map(p => p.collection).filter(Boolean));
    const qc = $(SELECTORS.quickCats);
    const chip = (val, group) => `
      <button class="chip" data-chip="${group}:${val}">
        ${String(val).replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
      </button>`;

    qc.innerHTML = `
      <div class="chip-row" role="list">
        <button class="chip chip--active" data-chip="clear:all">Todo</button>
        ${[...fits].map(v=>chip(v,'fit')).join('')}
        ${[...colls].map(v=>chip(v,'collection')).join('')}
      </div>
    `;

    qc.addEventListener('click', e=>{
      const btn = e.target.closest('.chip'); if(!btn) return;
      $$('.chip', qc).forEach(b=>b.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      const [group,val] = btn.dataset.chip.split(':');
      if(group==='clear'){ state.items = state.raw.slice(); }
      else {
        state.items = state.raw.filter(p => String(p[group]||'')===val);
      }
      state.page = 1;
      render();
    });
  }

  // --------- Card builder ----------
  function cardGtmData(p, idx){
    return {
      id: p.id, name: p.title, price: p.price, category: p.collection,
      position: idx+1, brand: 'PROPHETIA', list: 'Camisetas Hombre'
    };
  }

  function buildSwatches(p){
    const sw = swatchesOf(p).slice(0,6);
    return `
      <div class="card-swatches" role="list">
        ${sw.map((s,i)=>`
          <button class="sw" role="listitem" aria-label="Variante ${i+1}" data-img="${s}"></button>
        `).join('')}
      </div>
    `;
  }

  function buildCard(p, idx){
    const img = imgOr(p);
    const url = `producto.html?id=${encodeURIComponent(p.id)}`;
    const price = fmtPrice(p.price);
    const sizes = (p.sizes||[]).join(' · ');
    const gtm = cardGtmData(p, idx);
    const stock = p.inStock===false ? 'out' : 'in';
    const badgeStock = `<span class="card-badge ${stock==='out'?'is-out':''}" aria-label="${stock==='out'?'Sin stock':'En stock'}">${stock==='out'?'OUT OF STOCK':'IN STOCK'}</span>`;
    const badgeNew = p.isNew ? `<span class="card-badge is-new">NEW</span>` : '';

    return `
      <article class="card" data-gtm='${JSON.stringify(gtm)}'>
        <a class="card-media" href="${url}" aria-label="${p.title}" data-id="${p.id}">
          <img loading="lazy" src="${img}" alt="${p.title}">
          <div class="card-badges">${badgeStock}${badgeNew}</div>
          <button class="nav prev" aria-label="Imagen anterior" type="button">‹</button>
          <button class="nav next" aria-label="Imagen siguiente" type="button">›</button>
        </a>
        <div class="card-body">
          <h3 class="card-title"><a href="${url}" data-id="${p.id}">${p.title}</a></h3>
          <p class="card-sub">${p.short||''}</p>
          <div class="card-meta">
            <span class="card-price">${price||''}</span>
            <span class="card-sizes">${sizes}</span>
          </div>
          ${buildSwatches(p)}
        </div>
        <button class="card-wish" aria-label="Guardar en favoritos" aria-pressed="false" data-id="${p.id}">❤</button>
      </article>
    `;
  }

  // --------- JSON-LD (Breadcrumb + ItemList) ----------
  function injectJSONLD(visible){
    $$('script[data-pp-jsonld]').forEach(s=>s.remove());

    const bc = {
      '@context':'https://schema.org',
      '@type':'BreadcrumbList',
      itemListElement:[
        { '@type':'ListItem','position':1,'name':'Hombre','item': location.origin+'/hombre.html' },
        { '@type':'ListItem','position':2,'name':'Camisetas','item': location.href }
      ]
    };
    const il = {
      '@context':'https://schema.org',
      '@type':'ItemList',
      itemListElement: visible.map((p,i)=>({
        '@type':'ListItem',
        position: i+1,
        item: {
          '@type':'Product',
          name: p.title,
          image: imgOr(p),
          url: `producto.html?id=${encodeURIComponent(p.id)}`
        }
      }))
    };

    for (const obj of [bc, il]){
      const s = document.createElement('script');
      s.type='application/ld+json'; s.dataset.ppJsonld='1';
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    }
  }

  // --------- Render ----------
  function render(){
    const grid = $(SELECTORS.grid);
    const sorted = sortItems(state.items, state.sort);
    const to = state.page * PAGE_SIZE;
    const visible = sorted.slice(0, to);

    grid.innerHTML = visible.map((p, i)=> buildCard(p, i)).join('');
    injectJSONLD(visible);

    const moreBtn = $(SELECTORS.loadMore);
    moreBtn.hidden = visible.length >= sorted.length;

    // dataLayer view_item_list
    if (window.dataLayer){
      window.dataLayer.push({
        event: 'view_item_list',
        items: visible.map((p,i)=>({
          item_id: p.id, item_name: p.title, price: p.price,
          item_category: p.collection, index: i+1
        }))
      });
    }

    // Wiring de interacciones tras pintar
    wireInteractions(visible);
  }

  // --------- Interacciones (swatches, carrusel, wishlist, select_item) ----------
  function wireInteractions(visible){
    // Swatches → cambia imagen principal
    $$('.card').forEach((card, idx)=>{
      const media = $('.card-media', card);
      const img = $('img', media);
      const gtm = JSON.parse(card.dataset.gtm||'{}');
      const p = visible[idx];
      let currentIndex = 0;

      card.querySelectorAll('.card-swatches .sw').forEach((swBtn, swIdx)=>{
        swBtn.addEventListener('mouseenter', ()=>{ img.src = swBtn.dataset.img; });
        swBtn.addEventListener('focus', ()=>{ img.src = swBtn.dataset.img; });
      });

      // Mini-carrusel por flechas (si hay varias imágenes)
      const images = Array.isArray(p.images) && p.images.length ? p.images : [imgOr(p)];
      const prev = $('.nav.prev', media);
      const next = $('.nav.next', media);
      const show = i => { currentIndex = (i+images.length)%images.length; img.src = images[currentIndex]; };

      prev.addEventListener('click', (e)=>{ e.preventDefault(); show(currentIndex-1); });
      next.addEventListener('click', (e)=>{ e.preventDefault(); show(currentIndex+1); });

      // select_item (clic en tarjeta o título)
      const selectFire = ()=>{
        if (window.dataLayer){
          window.dataLayer.push({
            event: 'select_item',
            items: [{
              item_id: gtm.id, item_name: gtm.name, price: gtm.price,
              item_category: gtm.category, index: gtm.position
            }]
          });
        }
      };
      media.addEventListener('click', selectFire);
      $('.card-title a', card)?.addEventListener('click', selectFire);

      // wishlist
      const wish = $('.card-wish', card);
      wish.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();

        const pressed = wish.getAttribute('aria-pressed')==='true';
        wish.setAttribute('aria-pressed', String(!pressed));
        wish.classList.toggle('is-on', !pressed);
        if (window.dataLayer){
          window.dataLayer.push({
            event: 'add_to_wishlist',
            wishlist_status: !pressed ? 'added' : 'removed',
            items: [{
              item_id: gtm.id, item_name: gtm.name, price: gtm.price,
              item_category: gtm.category, index: gtm.position
            }]
          });
        }
            document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));

      });
    });
  }


  // --------- Listeners ----------
  $(SELECTORS.sort).addEventListener('change', e=>{
    state.sort = e.target.value; state.page = 1; render();
  });
  $(SELECTORS.loadMore).addEventListener('click', ()=>{
    state.page++; render();
  });

  // --------- Init ----------
  buildChips(state.raw);
  render();

  // --------- Minimal CSS extra ----------
  const css = `
  .plp-toolbar{display:grid;gap:16px;margin-block:24px}
  .quickcats{overflow:auto;scroll-snap-type:x mandatory;padding-bottom:4px}
  .chip-row{display:flex;gap:8px}
  .chip{white-space:nowrap;border:1px solid #ddd;border-radius:999px;padding:.4rem .8rem;background:#fff}
  .chip--active{border-color:#000}

  .plp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
  @media(min-width:960px){.plp-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}

  .card{display:flex;flex-direction:column;gap:10px;position:relative}
  .card-media{position:relative;display:block}
  .card-media img{width:100%;height:auto;display:block;aspect-ratio:3/4;object-fit:cover;border-radius:8px}
  .card-badges{position:absolute;top:8px;left:8px;display:flex;gap:6px}
  .card-badge{font-size:10px;letter-spacing:.02em;padding:.2rem .4rem;border-radius:999px;background:#fff;border:1px solid #111}
  .card-badge.is-new{background:#111;color:#fff;border-color:#111}
  .card-badge.is-out{background:#eee;color:#777;border-color:#ddd}

  .nav{position:absolute;top:50%;transform:translateY(-50%);border:0;background:rgba(255,255,255,.85);padding:.2rem .5rem;border-radius:6px}
  .nav.prev{left:8px} .nav.next{right:8px}

  .card-title{font-size:14px;line-height:1.3;margin:0}
  .card-sub{opacity:.7;margin:0}
  .card-meta{display:flex;gap:12px;font-size:12px;opacity:.9}
  .card-wish{align-self:flex-end;background:transparent;border:1px solid #111;border-radius:999px;font-size:16px;cursor:pointer;padding:.2rem .6rem}
  .card-wish.is-on{background:#111;color:#fff}

  .card-swatches{display:flex;gap:6px;margin-top:6px}
  .card-swatches .sw{width:14px;height:14px;border-radius:999px;border:1px solid #ccc;background:#f2f2f2}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// ==== Fallback para garantizar que ppOpenCart y ppCloseCart existan ====
window.addEventListener('partials:ready', () => {
  // Espera a que el header se haya inyectado
  if (!window.ppOpenCart) {
    window.ppOpenCart = () => {
      const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
      const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
      if (drawer && overlay) {
        drawer.classList.add('open');
        overlay.classList.add('active');
        document.body.classList.add('no-scroll');
      } else {
        console.warn('[Prophetia] No se encontraron elementos del carrito');
      }
    };
  }

  if (!window.ppCloseCart) {
    window.ppCloseCart = () => {
      const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
      const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
      if (drawer && overlay) {
        drawer.classList.remove('open');
        overlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
      }
    };
  }
});
// ===== Prophetia · Cart init robusto (tras parciales) =====
(function CartInitRobusto(){
  function getEls(){
    return {
      drawer  : document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer'),
      overlay : document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay'),
      list    : document.getElementById('ppCartList')    || document.getElementById('cartList'),
      total   : document.getElementById('ppCartTotal')   || document.getElementById('cartTotal'),
    };
  }

  // API pública (abrir/cerrar) — siempre definida
  window.ppOpenCart = function(){
    const {drawer, overlay} = getEls();
    if (!drawer || !overlay) { console.warn('[Prophetia] No se encontraron elementos del carrito'); return; }
    drawer.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('no-scroll');
  };
  window.ppCloseCart = function(){
    const {drawer, overlay} = getEls();
    if (!drawer || !overlay) return;
    drawer.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
  };

  // Cableado de eventos (idempotente)
  let wired = false;
  window.ppCartInit = function(){
    if (wired) return true;
    const {drawer, overlay, list, total} = getEls();
    if (!drawer || !overlay || !list || !total) return false;

    // Abrir desde cualquier trigger
    document.addEventListener('click', (e)=>{
      if (e.target.closest('[data-cart-open], .js-open-cart, #ppCartBtn')) {
        e.preventDefault();
        try { if (typeof render === 'function') render(); } catch(_) {}
        window.ppOpenCart();
      }
    });

    // Cerrar por overlay / botón / ESC
    overlay.addEventListener('click', window.ppCloseCart);
    document.addEventListener('click', (e)=>{
      if (e.target.closest('[data-close="cart"], .cart-close')) { e.preventDefault(); window.ppCloseCart(); }
    });
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') window.ppCloseCart(); });

    wired = true;
    return true;
  };

  // Reintentos cortos hasta que el header exista
  function tryWire(attempts=20){
    if (window.ppCartInit()) return;
    if (attempts <= 0) return;
    setTimeout(()=>tryWire(attempts-1), 100);
  }

  // Lanza al cargar y tras parciales
  document.addEventListener('DOMContentLoaded', tryWire);
  window.addEventListener('partials:ready', tryWire);
})();
// ===== Prophetia · Ensure Cart DOM + Wiring =====
(function ensureCartAndWire(){
  function ensureCartDOM(){
    let overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    let drawer  = document.getElementById('ppCartDrawer')  || document.getElementById('cartDrawer');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cartOverlay';
      overlay.className = 'cart-overlay';
      document.body.appendChild(overlay);
    }
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'cartDrawer';
      drawer.className = 'cart-drawer';
      drawer.innerHTML = `
        <div class="cart-head">
          <strong>Cesta</strong>
          <button class="cart-close" data-close="cart" aria-label="Cerrar">✕</button>
        </div>
        <div id="cartList" class="cart-list"></div>
        <div class="cart-foot">
          <div class="cart-total"><span>Total</span> <strong id="cartTotal">€0,00</strong></div>
          <button class="cart-checkout">Finalizar compra</button>
        </div>`;
      document.body.appendChild(drawer);
    }
  }

  // API abrir/cerrar (idempotente)
  window.ppOpenCart = function(){
    const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
    const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    if (!drawer || !overlay) { console.warn('[Prophetia] No se encontraron elementos del carrito'); return; }
    drawer.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('no-scroll');
  };
  window.ppCloseCart = function(){
    const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
    const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
  };

  // Wire universal (una única vez)
  let wired = false;
  function wire(){
    if (wired) return;
    const drawer  = document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer');
    const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    const list    = document.getElementById('ppCartList')    || document.getElementById('cartList');
    const total   = document.getElementById('ppCartTotal')   || document.getElementById('cartTotal');
    if (!drawer || !overlay || !list || !total) return; // espera a que exista todo

    document.addEventListener('click', (e)=>{
      if (e.target.closest('[data-cart-open], .js-open-cart, #ppCartBtn')) { e.preventDefault(); window.ppOpenCart(); }
      if (e.target.closest('[data-close="cart"], .cart-close'))           { e.preventDefault(); window.ppCloseCart(); }
    });
    overlay.addEventListener('click', window.ppCloseCart);
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') window.ppCloseCart(); });

    wired = true;
  }

  function bootstrap(){
    ensureCartDOM();
    wire();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
  window.addEventListener('partials:ready', bootstrap);

  // reintentos cortos por si el header tarda
  let tries = 25;
  (function retry(){
    if (wired) return;
    bootstrap();
    if (!wired && --tries > 0) setTimeout(retry, 120);
  })();
})();
