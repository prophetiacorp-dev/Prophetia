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

/* ========== Montador PLP seguro (Swup/parciales) ========== */
function ppMountCatalogSafe({ target, category }) {
  const mount = document.querySelector(target);
  if (!mount || !window.ppInitCatalog) return;
  window.ppInitCatalog({ target, category });
}
window.addEventListener('partials:ready', () => {
  const grid = document.querySelector('#plp-grid');
  if (grid) {
    ppMountCatalogSafe({
      target: '#plp-grid',
      category: grid.dataset.category || 'camisetas-hombre'
    });
  }
});

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
    cartCountHd  : $('#cartCountHd')   || $('#cartCountHeader') || $('#cartCount'),
    cartCount    : $('#cartCount')     || $('#cartCountHd'),
  };
})();

/* ========== Cart storage + badges ========== */
(() => {
  const CART_KEY = 'pp_cart_v2';
  const money = (n=0) => {
    try { return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n); }
    catch { return `${(+n).toFixed(2)} €`; }
  };
  const load  = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const save  = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart||[]));
  const sum   = (c) => c.reduce((a,i)=>a+(i.price*i.qty),0);
  const count = (c) => c.reduce((a,i)=>a+i.qty,0);

  function updateBadges(){
    const c = load(); const n = count(c);
    const ids = window.__PP_IDS || {};
    if (ids.cartCountHd) ids.cartCountHd.textContent = n;
    if (ids.cartCount)   ids.cartCount.textContent   = n;
    if (ids.cartTotal)   ids.cartTotal.textContent   = money(sum(c));
  }

  window.ppCart = { load, save, sum, count, money, updateBadges, CART_KEY };
  document.addEventListener('DOMContentLoaded', updateBadges);
})();

/* ========== Click universal de card → producto ========== */
document.addEventListener('click', (e) => {
  if (e.target.closest('.save-btn, .cart-add, [data-save], [data-cart-open], .nav, #loadMoreBtn, .card-wish')) return;
  const card = e.target.closest('.product-card, .card');
  if (!card) return;
  const id = card.dataset.id || card.getAttribute('data-id');
  if (!id) return;
  e.preventDefault();
  window.location.assign(`producto.html?id=${encodeURIComponent(id)}`);
});

/* ========== Drawer del carrito (render + API add + toggle único) ========== */
(() => {
  const KEY = 'pp_cart_v2';
  const FBACK = 'pp_cart';
  const $ = window.pp$;

  const els = () => ({
    btn     : document.getElementById('ppCartBtn'),
    drawer  : document.getElementById('ppCartDrawer') || document.getElementById('cartDrawer'),
    overlay : document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay'),
    list    : document.getElementById('ppCartList')    || document.getElementById('cartList'),
    total   : document.getElementById('ppCartTotal')   || document.getElementById('cartTotal'),
  });

  const readRaw  = () => {
    const a = localStorage.getItem(KEY);
    if (a) { try{ return JSON.parse(a); } catch{} }
    const b = localStorage.getItem(FBACK);
    if (b) { try{ return JSON.parse(b); } catch{} }
    return [];
  };
  const writeRaw = (c=[]) => localStorage.setItem(KEY, JSON.stringify(c));
  const money = (n)=> new Intl.NumberFormat('es-ES',{style:'currency', currency:'EUR'}).format(n||0);
  const escapeHTML = (s='') => { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; };

  function render(){
    const E = els();
    if (!E.list || !E.total) return;
    const cart = readRaw();
    if (!cart.length){
      E.list.innerHTML = '<p class="muted" style="padding:12px 0;">Tu cesta está vacía.</p>';
      E.total.textContent = money(0);
      if (E.btn) E.btn.title = 'Carrito (0)';
      return;
    }
    let subtotal = 0;
    const html = cart.map((it,i)=>{
      const qty   = +it.qty||1;
      const price = +it.price||0;
      subtotal += price*qty;
      const img   = it.img || it.cover || (it.images && it.images[0]) || 'assets/img/placeholder.png';
      const title = it.title || 'Producto';
      const meta  = [it.color, it.size].filter(Boolean).join(' · ');
      return `
        <article class="cart-item" data-i="${i}" style="display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #eee;">
          <div style="width:72px;height:92px;border:1px solid #eee;border-radius:10px;overflow:hidden;background:#f7f7f7;">
            <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover">
          </div>
          <div>
            <div style="font-weight:600">${escapeHTML(title)}</div>
            ${meta ? `<div class="cart-item__meta">${meta}</div>` : ''}
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
              <button class="qbtn" data-op="-" aria-label="Restar" style="width:28px;height:28px;border:1px solid #e5e7eb;border-radius:999px;background:#fff">−</button>
              <span>${qty}</span>
              <button class="qbtn" data-op="+" aria-label="Sumar"  style="width:28px;height:28px;border:1px solid #e5e7eb;border-radius:999px;background:#fff">+</button>
              <button class="rm"  aria-label="Eliminar" style="margin-left:8px;font-size:12px;color:#666">Eliminar</button>
            </div>
            <div class="muted" style="margin-top:8px;font-size:12px;">Entrega estimada: <strong>2–6 días hábiles</strong></div>
          </div>
          <div style="font-weight:700">${money(price*qty)}</div>
        </article>`;
    }).join('');
    E.list.innerHTML = html;
    E.total.textContent = money(subtotal);
    if (E.btn) E.btn.title = `Carrito (${cart.reduce((s,x)=>s+(+x.qty||0),0)})`;
  }

  function mutate(i, op){
    const cart = readRaw();
    const it = cart[i]; if (!it) return;
    if (op === '+') it.qty = (+it.qty||1) + 1;
    if (op === '-') it.qty = Math.max(1,(+it.qty||1) - 1);
    writeRaw(cart); render(); try{ window.ppCart.updateBadges(); }catch{}
  }
  function removeAt(i){
    const cart = readRaw();
    cart.splice(i,1);
    writeRaw(cart); render(); try{ window.ppCart.updateBadges(); }catch{}
  }

  // Delegación clicks en lista
  document.addEventListener('click',(e)=>{
    const row = e.target.closest('.cart-item'); if(!row) return;
    const idx = +row.dataset.i;
    const q   = e.target.closest('.qbtn');
    const rm  = e.target.closest('.rm');
    if (q)  mutate(idx, q.dataset.op);
    if (rm) removeAt(idx);
  });

  // API pública abrir/cerrar (únicas)
  window.ppOpenCart  = () => { const {drawer,overlay}=els(); if(!drawer||!overlay) return;
    drawer.classList.add('open'); overlay.classList.add('active'); document.body.classList.add('no-scroll'); };
  window.ppCloseCart = () => { const {drawer,overlay}=els(); if(!drawer||!overlay) return;
    drawer.classList.remove('open'); overlay.classList.remove('active'); document.body.classList.remove('no-scroll'); };

  // Toggle universal (un solo listener)
  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    const drawer  = document.getElementById('ppCartDrawer')  || document.getElementById('cartDrawer');

    // Cerrar (overlay o botón)
    if (e.target === overlay || e.target.closest('[data-close="cart"], .cart-close')) {
      e.preventDefault(); window.ppCloseCart(); return;
    }
    // Triggers abrir/cerrar
    const trigger = e.target.closest('[data-cart-open], .js-open-cart, #ppCartBtn, #btnCart, [aria-controls="ppCartDrawer"], [aria-controls="cartDrawer"]');
    if (!trigger) return;
    if (e.target.closest('#ppCartDrawer, #cartDrawer')) return;
    e.preventDefault();
    const isOpen = drawer?.classList.contains('open');
    if (isOpen) { window.ppCloseCart(); trigger.setAttribute('aria-expanded','false'); }
    else        { try{ render(); }catch{} window.ppOpenCart(); trigger.setAttribute('aria-expanded','true'); }
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') window.ppCloseCart(); });

  // API pública add
  window.ppAddToCart = function add(p={}){
    const cart = readRaw();
    const base = Object.assign({qty:1}, p);
    const hit = cart.find(x => x.id===base.id && x.size===base.size && x.color===base.color);
    if (hit) hit.qty += (+base.qty||1);
    else cart.push({
      id:String(base.id||Math.random()).slice(2),
      title: base.title||'Producto',
      price:+base.price||0,
      img: base.img || base.cover || (base.images && base.images[0]) || 'assets/img/placeholder.png',
      color: base.color||'',
      size: base.size||'',
      qty: +base.qty||1
    });
    writeRaw(cart);
    try{ window.ppCart.updateBadges(); }catch{}
    render(); window.ppOpenCart();
  };

  document.addEventListener('DOMContentLoaded', render);
})();

/* ========== Hooks mínimos ========== */
(() => {
  window.ppCartRefresh = () => { try{ window.ppCart.updateBadges(); }catch{} };
  window.ppInitHome = window.ppInitHome || function(){};
})();

/* ========== Wishlist (global) ========== */
(() => {
  const KEY = 'pp_wishlist_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const find = (id, arr) => arr.find(x => String(x.id) === String(id));

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

  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-save]');
    if(!btn) return;
    if (btn.closest('#plp-grid, #gridCamisetas')) return; // PLP se gestiona abajo
    const item = {
      id    : btn.getAttribute('data-id'),
      title : btn.getAttribute('data-title') || 'Producto Prophetia',
      price : btn.getAttribute('data-price') || '',
      image : btn.getAttribute('data-image') || 'assets/img/placeholder.png',
      url   : btn.getAttribute('data-url')   || 'producto.html'
    };
    let list = load();
    const hit = find(item.id, list);
    list = hit ? list.filter(x => String(x.id) !== String(item.id)) : [...list, item];
    save(list);
    syncSavedState();
    document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
  });

  window.addEventListener('partials:ready', syncSavedState);
  document.addEventListener('DOMContentLoaded', syncSavedState);
  const grid = document.getElementById('gridCamisetas');
  if (grid) new MutationObserver(syncSavedState).observe(grid, { childList:true, subtree:true });
})();

/* ========== Wishlist (PLP) + inyección botón ❤️ ========== */
(() => {
  const KEY='pp_wishlist_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const exists = (id, arr) => arr.some(x => String(x.id) === String(id));

  function makeBtn(data){
    const btn = document.createElement('button');
    btn.className = 'icon-btn save';
    btn.setAttribute('data-save','');
    for (const [k,v] of Object.entries(data)) btn.setAttribute('data-'+k, v||'');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5c0-2.6 2-4.5 4.5-4.5 1.6 0 3 .9 4 2 1-1.1 2.4-2 4-2 2.5 0 4.5 1.9 4.5 4.5 0 4.4-8.5 9.5-8.5 9.5S3 14.9 3 10.5Z"/></svg>`;
    return btn;
  }
  function injectButtons(){
    document.querySelectorAll('#plp-grid, #gridCamisetas').forEach(g=>{
      g.querySelectorAll('.card').forEach(card=>{
        if (card.querySelector('[data-save]')) return;
        const id    = card.getAttribute('data-id') || (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
        const title = card.querySelector('.product-card__title, h4')?.textContent?.trim() || 'Producto Prophetia';
        const image = card.querySelector('img')?.getAttribute('src') || 'assets/img/placeholder.png';
        const url   = card.querySelector('a')?.getAttribute('href') || 'producto.html';
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        (card.querySelector('.img-wrap') || card).appendChild(makeBtn({ id, title, image, url }));
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
  document.addEventListener('click',(ev)=>{
    const btn = ev.target.closest('[data-save]');
    if(!btn) return;
    const inPLP = btn.closest('#plp-grid, #gridCamisetas');
    if(!inPLP) return;
    const item = {
      id: btn.getAttribute('data-id'),
      title: btn.getAttribute('data-title') || 'Producto Prophetia',
      price: btn.getAttribute('data-price') || '',
      image: btn.getAttribute('data-image') || 'assets/img/placeholder.png',
      url: btn.getAttribute('data-url') || 'producto.html'
    };
    let list = load();
    list = exists(item.id, list) ? list.filter(x => String(x.id)!==String(item.id)) : [...list, item];
    save(list); syncState();
    document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
  });

  const obs = new MutationObserver(injectButtons);
  document.querySelectorAll('#plp-grid, #gridCamisetas').forEach(g => obs.observe(g, { childList:true, subtree:true }));
  document.addEventListener('DOMContentLoaded', injectButtons);
  window.addEventListener('partials:ready', injectButtons);
})();

/* ========== Toast helper ========== */
(() => {
  const TOAST_TIME = 2600;
  let t; window.ppToast = (msg='Añadido a artículos guardados', href='wishlist.html')=>{
    const box = document.getElementById('ppToast'); if(!box) return;
    box.hidden = false;
    box.querySelector('#ppToastMsg').textContent = msg;
    box.querySelector('#ppToastAction').setAttribute('href', href);
    box.classList.add('is-open'); clearTimeout(t);
    t = setTimeout(()=>box.classList.remove('is-open'), TOAST_TIME);
  };
})();

/* ========== Spotify chip (drag + toggle + remember) ========== */
window.ppInitAudio = function(){
  const chip  = document.getElementById('ppAudioChip');
  const panel = document.getElementById('ppAudioPanel');
  if (!chip || !panel) return;
  const KEY = 'pp_audio_pos_v1';
  const clamp = (v,min,max)=>Math.min(Math.max(v,min),max);
  const savePos=(x,y)=>localStorage.setItem(KEY,JSON.stringify({x,y}));
  const loadPos=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
  const place=(x,y)=>{ const w=innerWidth,h=innerHeight,cw=chip.offsetWidth||1,ch=chip.offsetHeight||1;
    x=clamp(x,8,w-cw-8); y=clamp(y,8,h-ch-8);
    Object.assign(chip.style,{left:x+'px',top:y+'px',right:'auto',position:'fixed'}); savePos(x,y); positionPanel(); };
  const positionPanel=()=>{ const r=chip.getBoundingClientRect(), w=innerWidth;
    Object.assign(panel.style,{position:'fixed',top:Math.round(r.bottom+8)+'px',right:Math.max(12,w-r.right)+'px'}); };
  const st=loadPos(); if(st) place(st.x,st.y); else requestAnimationFrame(()=>{ const cw=chip.offsetWidth||140; place(Math.round((innerWidth-cw)/2),16); });
  let dragging=false,sx=0,sy=0,bx=0,by=0;
  const onDown=e=>{ const p=e.touches?e.touches[0]:e; dragging=true; chip.classList.add('dragging');
    const r=chip.getBoundingClientRect(); sx=p.clientX; sy=p.clientY; bx=r.left; by=r.top;
    addEventListener('mousemove',onMove); addEventListener('mouseup',onUp);
    addEventListener('touchmove',onMove,{passive:false}); addEventListener('touchend',onUp); };
  const onMove=e=>{ if(!dragging) return; const p=e.touches?e.touches[0]:e; if(e.touches) e.preventDefault(); place(bx+(p.clientX-sx),by+(p.clientY-sy)); };
  const onUp=()=>{ dragging=false; chip.classList.remove('dragging');
    removeEventListener('mousemove',onMove); removeEventListener('mouseup',onUp);
    removeEventListener('touchmove',onMove); removeEventListener('touchend',onUp); };
  chip.addEventListener('mousedown',onDown); chip.addEventListener('touchstart',onDown,{passive:true});
  let open=false; const toggle=()=>{ open=!open; panel.classList.toggle('hidden',!open); panel.setAttribute('aria-hidden',String(!open)); if(open) positionPanel(); };
  chip.addEventListener('click',()=>{ if(!dragging) toggle(); });
  addEventListener('resize',()=>{ const p=loadPos(); if(p) place(p.x,p.y); if(!panel.classList.contains('hidden')) positionPanel();});
};

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
  const KEY='pp_wishlist_v1'; const a=document.getElementById('ppSavedBtn'); if(!a) return;
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  const update=()=>{ a.dataset.count = String(load().length); };
  document.addEventListener('storage', update);
  document.addEventListener('DOMContentLoaded', update);
  document.addEventListener('pp:wishlist:changed', update);
  update();
})();

/* ========== Página Wishlist (conteo + estado vacío) ========== */
(() => {
  if (!document.body.classList.contains('wishlist-page')) return;
  const $count = document.getElementById('wlCount');
  const $empty = document.querySelector('.wl-empty');
  const $grid  = document.querySelector('.wishlist-grid') || document.querySelector('.wl-results');
  const getCountDOM = () => document.querySelectorAll('.wishlist-grid .product-card, .wishlist-grid .card').length;
  const getCountLS  = () => { try{ const ls=JSON.parse(localStorage.getItem('pp_wishlist_v1')||'[]'); return Array.isArray(ls)?ls.length:0; }catch{ return 0; } };
  const render = () => {
    const n = Math.max(getCountDOM(), getCountLS());
    if ($count) $count.textContent = n;
    if ($empty && $grid){ if(n===0){ $empty.hidden=false; $grid.style.display='none'; } else { $empty.hidden=true; $grid.style.display=''; } }
  };
  document.addEventListener('pp:wishlist:changed', render);
  document.addEventListener('DOMContentLoaded', render);
  render();
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

/* ========== PLP modo Prophetia (mínimo necesario) ========== */
(async function PP_PLP_PROPHETIA_MODE(){
  const grid = document.querySelector('#plp-grid'); if(!grid) return;

  const PAGE_SIZE = 12;
  const $ = window.pp$, $$ = window.pp$$;
  const fmt = v => typeof v==='number' ? `${v.toFixed(0)}€` : v;
  const imgOf = p => p.cover || (p.images && p.images[0]) || '';

  async function loadCatalog(){
    const res = await fetch('assets/data/catalog.json', { cache:'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar catalog.json');
    const data = await res.json();
    return data.filter(p => String(p.type).toLowerCase()==='tshirt');
  }

  const all = await loadCatalog();
  let state = { raw: all.slice(), items: all.slice(), page: 1, sort: 'relevance' };

  const sortMap = {
    price_asc :(a,b)=>(a.price??0)-(b.price??0),
    price_desc:(a,b)=>(b.price??0)-(a.price??0),
    newest    :(a,b)=>(b.createdAt??0)-(a.createdAt??0)
  };
  const sortItems = (arr, mode) => mode in sortMap ? arr.slice().sort(sortMap[mode]) : arr.slice();

  function card(p, i){
    const url = `producto.html?id=${encodeURIComponent(p.id)}`;
    const sizes = (p.sizes||[]).join(' · ');
    const stock = p.inStock===false ? 'out' : 'in';
    const badgeStock = `<span class="card-badge ${stock==='out'?'is-out':''}">${stock==='out'?'OUT OF STOCK':'IN STOCK'}</span>`;
    const badgeNew = p.isNew ? `<span class="card-badge is-new">NEW</span>` : '';
    return `
      <article class="card" data-gtm='${JSON.stringify({id:p.id,name:p.title,price:p.price,category:p.collection,position:i+1,brand:'PROPHETIA'})}'>
        <a class="card-media" href="${url}" aria-label="${p.title}" data-id="${p.id}">
          <img loading="lazy" src="${imgOf(p)}" alt="${p.title}">
          <div class="card-badges">${badgeStock}${badgeNew}</div>
          <button class="nav prev" aria-label="Imagen anterior" type="button">‹</button>
          <button class="nav next" aria-label="Imagen siguiente" type="button">›</button>
        </a>
        <div class="card-body">
          <h3 class="card-title"><a href="${url}" data-id="${p.id}">${p.title}</a></h3>
          <p class="card-sub">${p.short||''}</p>
          <div class="card-meta"><span class="card-price">${fmt(p.price)||''}</span><span class="card-sizes">${sizes}</span></div>
        </div>
        <button class="card-wish" aria-label="Guardar en favoritos" aria-pressed="false" data-id="${p.id}">❤</button>
      </article>`;
  }

  function render(){
    const sorted = sortItems(state.items, state.sort);
    const visible = sorted.slice(0, state.page * PAGE_SIZE);
    grid.innerHTML = visible.map(card).join('');

    const moreBtn = document.querySelector('#loadMoreBtn');
    if (moreBtn) moreBtn.hidden = visible.length >= sorted.length;

    // Interacciones por card
    $$('.card').forEach((c, idx)=>{
      const media = $('.card-media', c), img = media.querySelector('img');
      const p = visible[idx]; const images = Array.isArray(p.images)&&p.images.length ? p.images : [imgOf(p)];
      let i = 0; const show = j => { i=(j+images.length)%images.length; img.src = images[i]; };
      $('.nav.prev', media).addEventListener('click', e=>{ e.preventDefault(); show(i-1); });
      $('.nav.next', media).addEventListener('click', e=>{ e.preventDefault(); show(i+1); });

      const wish = $('.card-wish', c);
      wish.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation();
        const on = wish.getAttribute('aria-pressed')==='true';
        wish.setAttribute('aria-pressed', String(!on));
        wish.classList.toggle('is-on', !on);
        document.dispatchEvent(new CustomEvent('pp:wishlist:changed'));
      });
    });
  }

  document.querySelector('#sortSelect')?.addEventListener('change', e=>{ state.sort = e.target.value; state.page=1; render(); });
  document.querySelector('#loadMoreBtn')?.addEventListener('click', ()=>{ state.page++; render(); });

  render();

  // CSS mínimo (si no tienes hoja específica)
  const css = `
  .plp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
  @media(min-width:960px){.plp-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  .card{display:flex;flex-direction:column;gap:10px;position:relative}
  .card-media{position:relative;display:block}
  .card-media img{width:100%;height:auto;display:block;aspect-ratio:3/4;object-fit:cover;border-radius:8px}
  .card-badges{position:absolute;top:8px;left:8px;display:flex;gap:6px}
  .card-badge{font-size:10px;padding:.2rem .4rem;border-radius:999px;background:#fff;border:1px solid #111}
  .card-badge.is-new{background:#111;color:#fff;border-color:#111}
  .card-badge.is-out{background:#eee;color:#777;border-color:#ddd}
  .nav{position:absolute;top:50%;transform:translateY(-50%);border:0;background:rgba(255,255,255,.85);padding:.2rem .5rem;border-radius:6px}
  .nav.prev{left:8px}.nav.next{right:8px}
  .card-title{font-size:14px;line-height:1.3;margin:0}
  .card-sub{opacity:.7;margin:0}
  .card-meta{display:flex;gap:12px;font-size:12px;opacity:.9}
  .card-wish{align-self:flex-end;background:transparent;border:1px solid #111;border-radius:999px;font-size:16px;cursor:pointer;padding:.2rem .6rem}
  .card-wish.is-on{background:#111;color:#fff}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
})();

/* ========== Fallback: asegúrate de que el DOM del carrito existe (si falta) ========== */
(() => {
  function ensure(){
    let overlay = document.getElementById('ppCartOverlay') || document.getElementById('cartOverlay');
    let drawer  = document.getElementById('ppCartDrawer')  || document.getElementById('cartDrawer');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id='cartOverlay'; overlay.className='cart-overlay';
      document.body.appendChild(overlay);
    }
    if (!drawer){
      drawer = document.createElement('aside');
      drawer.id='cartDrawer'; drawer.className='cart-drawer';
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
  const boot = ()=>ensure();
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('partials:ready', boot);
  let tries = 20; (function retry(){ ensure(); if(--tries>0) setTimeout(retry,120); })();
})();
