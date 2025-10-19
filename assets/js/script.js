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
