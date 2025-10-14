/* =========================
   PROPHETIA — script.js
   ========================= */

const $ = s => document.querySelector(s);
function slugify(s){
  return (s||'')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'');
}

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

/* ===== Announce bar ===== */
(function(){
  const KEY='pp_announce_dismissed_until';
  const bar=$('#announceBar'); const btn=$('#closeAnnounce');
  if(!bar||!btn) return;
  const now=Date.now(); const until=parseInt(localStorage.getItem(KEY)||'0',10);
  if(until>now){ bar.style.display='none'; return; }
  btn.addEventListener('click', ()=>{
    bar.style.display='none';
    localStorage.setItem(KEY, String(now + 7*24*60*60*1000));
  });
})();

/* ===== Fade-in ===== */
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('reveal-show');
      observer.unobserve(e.target);
    }
  });
},{ threshold: 0.15 });
document.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));

/* ===== Carrito (localStorage) ===== */
const CART_KEY='prophetia_cart';
const getCart=()=>{ try{return JSON.parse(localStorage.getItem(CART_KEY))||[];}catch{return[];} };
const setCart=c=>{ localStorage.setItem(CART_KEY,JSON.stringify(c)); renderCart(); };
const addToCart=item=>{
  const cart=getCart(); const i=cart.findIndex(x=>x.sku===item.sku && x.size===item.size);
  if(i>=0){ cart[i].qty+=item.qty; } else { cart.push(item); }
  setCart(cart);
};
const removeFromCart=(sku,size)=> setCart(getCart().filter(x=>!(x.sku===sku && x.size===size)));
function toast(msg){
  let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1700);
}
function renderCart(){
  const itemsEl=$('#cartItems'), totalEl=$('#cartTotal'), countEl=$('#cartCount');
  if(!itemsEl) return;
  const cart=getCart(); let subtotal=0;
  itemsEl.innerHTML = cart.map(x=>{
    const line=(x.price||0)*(x.qty||0); subtotal+=line;
    return `<div class="cart-item">
      <img src="${x.img||''}" alt="${x.title||''}">
      <div><h5>${x.title||''}</h5><div class="muted">Talla: ${x.size||'-'} · €${Number(x.price||0).toFixed(0)} × ${x.qty||1}</div></div>
      <button class="remove" data-sku="${x.sku}" data-size="${x.size}">✕</button>
    </div>`;
  }).join('') || '<p class="muted">Tu carrito está vacío.</p>';

  // cupón
  const total = applyCouponTotal(subtotal);
  totalEl && (totalEl.textContent=`€${total.toFixed(2)}`);
  countEl && (countEl.textContent=cart.reduce((n,x)=>n+(x.qty||0),0));

  itemsEl.querySelectorAll('.remove').forEach(b=> b.addEventListener('click',()=> removeFromCart(b.dataset.sku,b.dataset.size)));
}
renderCart();

/* Drawer carrito */
const cartBtn=$('.cart-btn'), cartDrawer=$('#cartDrawer'), cartBackdrop=$('#cartBackdrop'), closeCartBtn=$('#closeCart');
function openCart(){ if(cartDrawer&&cartBackdrop){ cartDrawer.classList.add('open'); cartBackdrop.classList.add('show'); } }
function closeCart(){ if(cartDrawer&&cartBackdrop){ cartDrawer.classList.remove('open'); cartBackdrop.classList.remove('show'); } }
cartBtn?.addEventListener('click', openCart); closeCartBtn?.addEventListener('click', closeCart); cartBackdrop?.addEventListener('click', closeCart);
$('#checkoutBtn')?.addEventListener('click', ()=> alert('Demo: aquí iría un checkout externo o un link de pago.'));

/* ===== Cupón bienvenida (-10%) ===== */
const DISCOUNT_CODE='PROPHETIA10', DISCOUNT_PCT=10;
const COUPON_KEY='pp_coupon_applied', COUPON_EXPIRES='pp_coupon_expires_at';
function hasActiveCoupon(){ try{ const until=parseInt(localStorage.getItem(COUPON_EXPIRES)||'0',10); return localStorage.getItem(COUPON_KEY)===DISCOUNT_CODE && Date.now()<until; }catch{return false;} }
function setActiveCoupon(days=30){
  const until=Date.now()+days*24*60*60*1000;
  localStorage.setItem(COUPON_KEY,DISCOUNT_CODE); localStorage.setItem(COUPON_EXPIRES,String(until));
  const note=$('#couponNote'), name=$('#couponName'); if(note&&name){ name.textContent=DISCOUNT_CODE; note.style.display='block'; }
  renderCart();
}
function applyCouponTotal(subtotal){
  if(hasActiveCoupon()){ const discount=subtotal*(DISCOUNT_PCT/100); const total=Math.max(0, subtotal-discount); const totalEl=$('#cartTotal'); totalEl&&(totalEl.textContent=`€${total.toFixed(2)} (-${DISCOUNT_PCT}%)`); return total; }
  return subtotal;
}
$('#applyCoupon')?.addEventListener('click', ()=>{
  const val=($('#couponInput')?.value||'').trim().toUpperCase();
  if(val===DISCOUNT_CODE){ setActiveCoupon(); toast('Descuento aplicado'); } else { alert('Código no válido'); }
});

/* ===== Pop-up registro + EmailJS ===== */
(function(){
  const MKEY='pp_welcome_seen_until';
  const modal=$('#welcomeModal'), back=$('#welcomeBackdrop'), close=$('#welcomeClose');
  const form=$('#welcomeForm'), email=$('#welcomeEmail'), codeBox=$('#welcomeCodeBox'), copyBtn=$('#copyCode');
  if(!modal||!back||!form) return;
  const now=Date.now(), until=parseInt(localStorage.getItem(MKEY)||'0',10);
  function open(){ modal.classList.add('show'); back.classList.add('show'); }
  function hide(){ modal.classList.remove('show'); back.classList.remove('show'); }
  if(!hasActiveCoupon() && now>=until){ setTimeout(open,10000); }
  close?.addEventListener('click', hide); back?.addEventListener('click', hide);
  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); const value=(email?.value||'').trim(); if(!value) return;
    try{ if(window.emailjs){ await emailjs.send("YOUR_EMAILJS_SERVICE_ID","YOUR_EMAILJS_TEMPLATE_ID",{ user_email:value, coupon:DISCOUNT_CODE }); } }catch(err){ console.error(err); }
    form.style.display='none'; codeBox.hidden=false; setActiveCoupon();
    localStorage.setItem(MKEY, String(now + 30*24*60*60*1000));
  });
  copyBtn?.addEventListener('click', ()=>{ navigator.clipboard?.writeText(DISCOUNT_CODE); toast('Código copiado y aplicado'); hide(); });
})();

/* ===== Filtros (chips) — adaptado a 2 colecciones ===== */
function bindFilters(){
  const chips=document.querySelectorAll('.chip');
  const products=document.querySelectorAll('.products-grid .product');
  if(!chips.length || !products.length) return;
  function apply(filter){
    chips.forEach(c=> c.classList.toggle('chip-active', c.dataset.filter===filter || (filter==='all' && c.dataset.filter==='all')));
    products.forEach(p=> p.style.display = (filter==='all' || p.dataset.cat===filter) ? '' : 'none');
  }
  chips.forEach(ch=> ch.addEventListener('click', ()=>{
    const f = ch.dataset.filter || 'all'; apply(f);
    if(f!=='all') location.hash=f; else history.replaceState(null,'',location.pathname);
  }));
  const fromHash=(location.hash||'#all').slice(1).toLowerCase();
  apply(['myth-series','letters-from-the-soul'].includes(fromHash)?fromHash:'all');
}

/* ===== Catálogo dinámico (cards con hover y badge) ===== */
async function loadCatalog(){
  const grid=$('#productsGrid'); if(!grid) return;
  try{
    const res=await fetch('catalog.json',{cache:'no-store'}); const products=await res.json();
    grid.innerHTML = products.map(p=>{
      const catSlug = p.collection_slug || slugify(p.collection);
      const img1=p.images?.[0]||'', img2=p.images?.[1]||p.images?.[0]||'';
      const badge=p.badge?`<span class="badge">${p.badge}</span>`:'';
      return `
      <article class="card product reveal-init" data-cat="${catSlug}">
        <a href="product.html?slug=${p.slug}">
          <div class="media frame">
            ${badge}
            <img class="img-1" loading="lazy" src="${img1}" alt="${p.title}">
            <img class="img-2" loading="lazy" src="${img2}" alt="${p.title} alt">
          </div>
          <div class="card-body">
            <h2 class="product-title">${p.title}</h2>
            <p class="product-meta">${p.collection}${p.technique?' — '+p.technique:''}</p>
            <div class="price-tag">€${Number(p.price||0).toFixed(0)}</div>
          </div>
        </a>
      </article>`;
    }).join('');
    grid.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));
    bindFilters();
  }catch(e){ console.error(e); $('#productsGrid').innerHTML="<p>Error al cargar los productos.</p>"; }
}
loadCatalog();

/* ===== PDP dinámica (galería, tallas/stock, sticky, JSON-LD) ===== */
(async function hydrateProduct(){
  const slug=new URLSearchParams(location.search).get('slug');
  const pTitle=$('#pTitle'), pDesc=$('#pDesc'), pPrice=$('#pPrice'), pMain=$('#pMain'), pThumbs=$('#pThumbs');
  const sizeRow=$('#sizeRow'), qtyInput=$('#qty'), buyForm=$('#buyForm');
  const stickyBar=$('#stickyBar'), stickyTitle=$('#stickyTitle'), stickyPrice=$('#stickyPrice'), stickyAdd=$('#stickyAdd');
  if(!slug || !pTitle || !pDesc || !pPrice || !pMain || !pThumbs || !sizeRow || !qtyInput || !buyForm || !stickyBar) return;

  try{
    const res=await fetch('catalog.json',{cache:'no-store'}); const list=await res.json(); const p=list.find(x=>x.slug===slug);
    if(!p){ location.href='colecciones.html'; return; }

    document.title = `${p.title} — PROPHETIA`;
    pTitle.textContent=p.title; pDesc.textContent=p.description||''; pPrice.textContent='€'+Number(p.price||0).toFixed(0);
    stickyTitle.textContent=p.title; stickyPrice.textContent='€'+Number(p.price||0).toFixed(0);

    const imgs = Array.isArray(p.images)&&p.images.length?p.images:['images/placeholder.webp'];
    pMain.src=imgs[0]; pMain.alt=p.title;
    pThumbs.innerHTML = imgs.map((src,i)=>`<img class="thumb ${i===0?'active':''}" src="${src}" alt="${p.title} vista ${i+1}">`).join('');
    pThumbs.querySelectorAll('.thumb').forEach(t=> t.addEventListener('click',()=>{ pThumbs.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active')); t.classList.add('active'); pMain.src=t.src; }));

    // tallas con stock
    const sizes=p.sizes||{S:0,M:0,L:0,XL:0,XXL:0}; let currentSize=null;
    sizeRow.innerHTML = Object.keys(sizes).map(k=>`<button type="button" class="size-btn" data-size="${k}" ${sizes[k]<=0?'disabled':''}>${k}</button>`).join('');
    sizeRow.querySelectorAll('.size-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ if(btn.disabled) return; sizeRow.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); currentSize=btn.dataset.size; });
    });

    function addSelected(qty){
      if(!currentSize) return alert('Elige talla');
      if((sizes[currentSize]||0)<=0) return alert('Sin stock en esa talla');
      const n=Math.max(1, parseInt(qty||'1',10));
      addToCart({ sku:p.sku||p.slug, title:p.title, price:Number(p.price)||0, size:currentSize, qty:n, img:imgs[0] });
      toast('Añadido al carrito'); openCart();
    }
    buyForm.addEventListener('submit', e=>{ e.preventDefault(); addSelected(qtyInput.value); });
    stickyAdd?.addEventListener('click', ()=> addSelected(qtyInput.value));

    // JSON-LD dinámico
    const slot=$('#jsonld');
    if(slot){
      const data={"@context":"https://schema.org","@type":"Product","name":p.title,"image":imgs.slice(0,1),"description":p.description||"","sku":p.sku||p.slug,"brand":{"@type":"Brand","name":"PROPHETIA"},"offers":{"@type":"Offer","price":String(p.price||0),"priceCurrency":"EUR","availability":"https://schema.org/InStock","url":location.href}};
      slot.textContent=JSON.stringify(data);
    }
  }catch(err){ console.error(err); }
})();
