/* =========================
   PROPHETIA — script.js
   ========================= */

/* ===== Scroll suave ===== */
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const href = a.getAttribute('href');
    if(href && href.startsWith('#')){
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({behavior:'smooth'});
    }
  });
});

/* ===== Menú móvil ===== */
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if (toggle && nav){
  toggle.addEventListener('click', ()=>{
    const open = getComputedStyle(nav).display !== 'none';
    nav.style.display = open ? 'none' : 'block';
  });
}

/* ===== Fade-in con IntersectionObserver ===== */
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('reveal-show');
      observer.unobserve(e.target);
    }
  });
},{ threshold: 0.15 });
document.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));

/* ===== Filtros (chips) en colecciones ===== */
function bindFilters(){
  const chips = document.querySelectorAll('.chip');
  const products = document.querySelectorAll('.products-grid .product');
  if(!chips.length || !products.length) return;

  function apply(filter){
    chips.forEach(c=>{
      const isActive = c.dataset.filter===filter || (filter==='all' && c.dataset.filter==='all');
      c.classList.toggle('chip-active', isActive);
    });
    products.forEach(p=>{
      p.style.display = (filter==='all' || p.dataset.cat===filter) ? '' : 'none';
    });
  }

  chips.forEach(ch=>{
    ch.addEventListener('click', ()=>{
      const f = ch.dataset.filter || 'all';
      apply(f);
      if(f !== 'all') location.hash = f; else history.replaceState(null,'',location.pathname);
    });
  });

  const fromHash = (location.hash||'#all').slice(1).toLowerCase();
  apply(['myth','baobab','ventus'].includes(fromHash) ? fromHash : 'all');
}

/* ===== Catálogo dinámico (imagen + precio) ===== */
async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  try {
    const res = await fetch('catalog.json', {cache:'no-store'});
    const products = await res.json();

    grid.innerHTML = products.map(p => `
      <article class="card product reveal-init" data-cat="${(p.collection||'').toLowerCase()}">
        <a href="product.html?slug=${p.slug}">
          <div class="media frame">
            <img loading="lazy" src="${p.images?.[0] || ''}" alt="${p.title || ''} — Prophetia">
          </div>
          <div class="card-body">
            <h2 class="product-title">${p.title || ''}</h2>
            <p class="product-meta">${p.collection || ''} ${p.technique ? '— '+p.technique : ''}</p>
            <div class="price-tag">€${Number(p.price||0).toFixed(0)}</div>
          </div>
        </a>
      </article>
    `).join('');

    grid.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));
    bindFilters();
  } catch (e) {
    console.error('Error cargando catálogo:', e);
    grid.innerHTML = "<p>Error al cargar los productos.</p>";
  }
}
loadCatalog();

/* ===== PDP dinámica (product.html) ===== */
(async function hydrateProduct(){
  const slug = new URLSearchParams(location.search).get('slug');
  const pTitle = document.getElementById('pTitle');
  const pDesc  = document.getElementById('pDesc');
  const pPrice = document.getElementById('pPrice');
  const pMain  = document.getElementById('pMain');
  const pThumbs= document.getElementById('pThumbs');
  const buyForm= document.getElementById('buyForm');
  if(!slug || !pTitle || !pDesc || !pPrice || !pMain || !pThumbs || !buyForm) return;

  try {
    const res = await fetch('catalog.json', {cache:'no-store'});
    const list = await res.json();
    const p = list.find(x=>x.slug===slug);
    if(!p){ location.href='colecciones.html'; return; }

    document.title = `${p.title} — PROPHETIA`;
    pTitle.textContent = p.title || '';
    pDesc.textContent  = p.description || '';
    pPrice.textContent = '€' + Number(p.price||0).toFixed(0);

    const imgs = Array.isArray(p.images) && p.images.length ? p.images : ['images/placeholder.webp'];
    pMain.src = imgs[0]; pMain.alt = p.title || '';

    pThumbs.innerHTML = imgs.map((src,i)=>`<img class="thumb ${i===0?'active':''}" src="${src}" alt="${(p.title||'')+' vista '+(i+1)}">`).join('');
    pThumbs.querySelectorAll('.thumb').forEach(t=>{
      t.addEventListener('click', ()=>{
        pThumbs.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));
        t.classList.add('active'); pMain.src=t.src; pMain.alt=t.alt;
      });
    });

    buyForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const size = (document.getElementById('size')||{}).value;
      if(!size) return alert('Elige talla');
      addToCart({ sku: p.sku || p.slug, title: p.title, price: Number(p.price)||0, size, qty: 1, img: imgs[0] });
      openCart();
    });
  } catch(err){ console.error(err); }
})();

/* ===== Carrito (localStorage) ===== */
const CART_KEY = 'prophetia_cart';
function getCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch{ return []; } }
function setCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); renderCart(); }
function addToCart(item){
  const cart = getCart();
  const i = cart.findIndex(x => x.sku === item.sku && x.size === item.size);
  if(i>=0){ cart[i].qty += item.qty; } else { cart.push(item); }
  setCart(cart);
}
function removeFromCart(sku, size){ setCart(getCart().filter(x => !(x.sku===sku && x.size===size))); }

function renderCart(){
  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const countEl = document.getElementById('cartCount');
  if(!itemsEl) return;

  const cart = getCart();
  let total = 0;
  itemsEl.innerHTML = cart.map(x=>{
    const line = (x.price||0) * (x.qty||0); total += line;
    return `
      <div class="cart-item">
        <img src="${x.img||''}" alt="${x.title||''}">
        <div>
          <h5>${x.title||''}</h5>
          <div class="muted">Talla: ${x.size||'-'} · €${Number(x.price||0).toFixed(0)} × ${x.qty||1}</div>
        </div>
        <button class="remove" data-sku="${x.sku}" data-size="${x.size}">✕</button>
      </div>`;
  }).join('') || '<p class="muted">Tu carrito está vacío.</p>';

  if(totalEl) totalEl.textContent = `€${total.toFixed(2)}`;
  if(countEl) countEl.textContent = cart.reduce((n,x)=>n+(x.qty||0),0);

  itemsEl.querySelectorAll('.remove').forEach(btn=>{
    btn.addEventListener('click', ()=> removeFromCart(btn.dataset.sku, btn.dataset.size));
  });
}
renderCart();

/* ===== Drawer del carrito ===== */
const cartBtn = document.querySelector('.cart-btn');
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('cartBackdrop');
const closeCartBtn = document.getElementById('closeCart');
function openCart(){ if(cartDrawer && cartBackdrop){ cartDrawer.classList.add('open'); cartBackdrop.classList.add('show'); } }
function closeCart(){ if(cartDrawer && cartBackdrop){ cartDrawer.classList.remove('open'); cartBackdrop.classList.remove('show'); } }
cartBtn?.addEventListener('click', openCart);
closeCartBtn?.addEventListener('click', closeCart);
cartBackdrop?.addEventListener('click', closeCart);

/* ===== Checkout demo ===== */
document.getElementById('checkoutBtn')?.addEventListener('click', ()=>{
  alert('Demo: aquí iría Stripe/PayPal o un formulario de pedido.');
});

