/* =====================================================
   PROPHETIA — Script principal
   ===================================================== */

const CATALOG_URL = "catalog.json";
const DISCOUNT_CODE = "PROPHETIA10";
const DISCOUNT_PCT = 10;

const $ = (s, c=document)=>c.querySelector(s);
const $$ = (s, c=document)=>[...c.querySelectorAll(s)];
const slugify = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

/* ===== Announce bar ===== */
(function(){
  const bar=$('#announceBar'), btn=$('#closeAnnounce'); if(!bar||!btn) return;
  btn.addEventListener('click', ()=> bar.style.display='none');
})();

/* ===== Mega menu (click/touch + cerrar fuera/Esc) ===== */
(function(){
  const mega=document.querySelector('.mega'); if(!mega) return;
  const btn=mega.querySelector('.mega-toggle');
  const open=()=>{ mega.classList.add('open'); btn.setAttribute('aria-expanded','true'); };
  const close=()=>{ mega.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
  btn.addEventListener('click', e=>{ e.preventDefault(); mega.classList.contains('open')?close():open(); });
  document.addEventListener('click', e=>{ if(!mega.contains(e.target)) close(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
})();

/* ===== Menu móvil simple ===== */
(function(){
  const t=$('.nav-toggle'), nav=$('.site-nav'); if(!t||!nav) return;
  t.addEventListener('click', ()=>{ nav.style.display = getComputedStyle(nav).display==='none'?'flex':'none'; });
})();

/* ===== Carrito ===== */
const CART_KEY='cart';
const getCart=()=>JSON.parse(localStorage.getItem(CART_KEY)||'[]');
const setCart=c=>localStorage.setItem(CART_KEY,JSON.stringify(c));
function addToCart(p){ const c=getCart(); const ex=c.find(x=>x.sku===p.sku && x.size===p.size); ex?ex.qty+=p.qty:(c.push(p)); setCart(c); updateCartCount(); renderCart(); openCart(); }
function updateCartCount(){ $('#cartCount') && ($('#cartCount').textContent = getCart().reduce((n,x)=>n+(x.qty||0),0)); }
function openCart(){ $('#cartDrawer')?.classList.add('show'); $('#cartBackdrop')?.classList.add('show'); }
function closeCart(){ $('#cartDrawer')?.classList.remove('show'); $('#cartBackdrop')?.classList.remove('show'); }
$('#cartBackdrop')?.addEventListener('click', closeCart);
$('#closeCart')?.addEventListener('click', closeCart);
$('.cart-btn')?.addEventListener('click', openCart);

/* ===== Cupón ===== */
function hasActiveCoupon(){ const u=parseInt(localStorage.getItem('pp_coupon_expires_at')||'0',10); return localStorage.getItem('pp_coupon_applied')===DISCOUNT_CODE && Date.now()<u; }
function setActiveCoupon(days=30){ const until=Date.now()+days*24*60*60*1000; localStorage.setItem('pp_coupon_applied',DISCOUNT_CODE); localStorage.setItem('pp_coupon_expires_at',String(until)); renderCart(); const n=$('#couponNote'), nm=$('#couponName'); if(n&&nm){ nm.textContent=DISCOUNT_CODE; n.style.display='block'; } }
$('#applyCoupon')?.addEventListener('click',()=>{ const v=($('#couponInput')?.value||'').trim().toUpperCase(); if(v===DISCOUNT_CODE){ setActiveCoupon(); alert('Descuento aplicado'); } else alert('Código no válido'); });

/* ===== Render carrito ===== */
function renderCart(){
  const itemsEl=$('#cartItems'), totalEl=$('#cartTotal'); if(!itemsEl||!totalEl) return;
  const cart=getCart(); let subtotal=0;
  itemsEl.innerHTML = cart.map((x,i)=>{ const line=(x.price||0)*(x.qty||1); subtotal+=line; return `
    <div class="cart-item">
      <img src="${x.img||x.images?.[0]||'images/noimg.png'}" alt="${x.title}">
      <div class="cart-info"><strong>${x.title}</strong><span>Talla: ${x.size||'-'} — €${Number(x.price||0).toFixed(0)} × ${x.qty||1}</span></div>
      <button class="cart-remove" data-i="${i}">×</button>
    </div>`; }).join('') || '<p class="muted">Tu carrito está vacío.</p>';
  itemsEl.querySelectorAll('.cart-remove').forEach(b=> b.addEventListener('click',()=>{ const i=parseInt(b.dataset.i,10); const c=getCart(); c.splice(i,1); setCart(c); renderCart(); updateCartCount(); }));
  let total=subtotal; if(hasActiveCoupon()){ total=subtotal*(1-DISCOUNT_PCT/100); totalEl.textContent=`€${total.toFixed(2)} (-${DISCOUNT_PCT}%)`; } else { totalEl.textContent=`€${total.toFixed(2)}`; }
}
updateCartCount(); renderCart();

/* ===== Popup -10% ===== */
(function(){
  const MKEY='pp_welcome_seen_until';
  const modal=$('#welcomeModal'), back=$('#welcomeBackdrop'), close=$('#welcomeClose');
  const form=$('#welcomeForm'), email=$('#welcomeEmail'), codeBox=$('#welcomeCodeBox'), copyBtn=$('#copyCode');
  if(!modal) return;
  const now=Date.now(), until=parseInt(localStorage.getItem(MKEY)||'0',10);
  const open=()=>{ modal.classList.add('show'); back.classList.add('show'); };
  const hide=()=>{ modal.classList.remove('show'); back.classList.remove('show'); };
  if(!hasActiveCoupon() && now>=until) setTimeout(open,10000);
  close?.addEventListener('click', hide); back?.addEventListener('click', hide);
  form?.addEventListener('submit', async e=>{
    e.preventDefault(); const v=(email?.value||'').trim(); if(!v) return;
    try{ if(window.emailjs){ await emailjs.send("YOUR_EMAILJS_SERVICE_ID","YOUR_EMAILJS_TEMPLATE_ID",{user_email:v,coupon:DISCOUNT_CODE}); } }catch(e){}
    form.style.display='none'; codeBox.hidden=false; setActiveCoupon(); localStorage.setItem(MKEY,String(now+30*24*60*60*1000));
  });
  copyBtn?.addEventListener('click',()=>{ navigator.clipboard?.writeText(DISCOUNT_CODE); hide(); });
})();

/* ===== Catálogo (colecciones) ===== */
async function loadCatalog(){
  const grid=$('#productsGrid'); if(!grid) return;
  try{
    const res=await fetch(CATALOG_URL,{cache:'no-store'}); const products=await res.json();
    grid.innerHTML = products.map(p=>{
      const catSlug=p.collection_slug||slugify(p.collection);
      const img=p.images?.[0]||'images/noimg.png';
      return `<article class="card product" data-cat="${catSlug}">
        <div class="img-wrap">${p.badge?`<span class="badge">${p.badge}</span>`:''}<img src="${img}" alt="${p.title}"></div>
        <h4>${p.title}</h4><p class="collection">${p.collection}</p>
        <strong class="price">€${Number(p.price||0).toFixed(0)}</strong>
        <a class="btn-primary" href="product.html?slug=${p.slug}">Ver detalle</a>
      </article>`;
    }).join('');
    bindFilters();
  }catch(e){ grid.innerHTML='<p>Error al cargar catálogo.</p>'; }
}

/* ===== Filtros solo para Myth Series y Letters from the Soul ===== */
function bindFilters(){
  const chips=$$('.chip'), prods=$$('.products-grid .product'); if(!chips.length||!prods.length) return;
  function apply(f){ chips.forEach(c=>c.classList.toggle('chip-active', c.dataset.filter===f || (f==='all'&&c.dataset.filter==='all'))); prods.forEach(p=>p.style.display=(f==='all'||p.dataset.cat===f)?'':'none'); }
  chips.forEach(ch=> ch.addEventListener('click',()=>{ const f=ch.dataset.filter||'all'; apply(f); if(f!=='all') location.hash=f; else history.replaceState(null,'',location.pathname); }));
  const h=(location.hash||'#all').slice(1).toLowerCase(); apply(['myth-series','letters-from-the-soul'].includes(h)?h:'all');
}
loadCatalog();

/* ===== PDP dinámica ===== */
(async function hydratePDP(){
  const slug=new URLSearchParams(location.search).get('slug'); if(!slug) return;
  const pTitle=$('#pTitle'), pDesc=$('#pDesc'), pPrice=$('#pPrice'), pMain=$('#pMain'), pThumbs=$('#pThumbs'), sizeRow=$('#sizeRow'), qty=$('#qty'), buyForm=$('#buyForm');
  if(!pTitle||!pMain) return;
  try{
    const res=await fetch(CATALOG_URL,{cache:'no-store'}); const list=await res.json(); const p=list.find(x=>x.slug===slug); if(!p) return;
    document.title=`${p.title} — PROPHETIA`;
    pTitle.textContent=p.title; pDesc.textContent=p.description||''; pPrice.textContent='€'+Number(p.price||0).toFixed(0);
    const imgs = (Array.isArray(p.images)&&p.images.length?p.images:['images/noimg.png']);
    pMain.src=imgs[0]; pThumbs.innerHTML = imgs.map((s,i)=>`<img class="thumb ${i===0?'active':''}" src="${s}" alt="${p.title} ${i+1}">`).join('');
    $$('.thumb', pThumbs).forEach(t=> t.addEventListener('click',()=>{ $$('.thumb',pThumbs).forEach(x=>x.classList.remove('active')); t.classList.add('active'); pMain.src=t.src; }));
    const sizes=p.sizes||{S:0,M:0,L:0,XL:0,XXL:0}; let currentSize=null;
    sizeRow.innerHTML = Object.keys(sizes).map(k=>`<button type="button" class="size-btn" data-size="${k}" ${sizes[k]<=0?'disabled':''}>${k}</button>`).join('');
    $$('.size-btn', sizeRow).forEach(b=> b.addEventListener('click',()=>{ if(b.disabled)return; $$('.size-btn',sizeRow).forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentSize=b.dataset.size; }));
    buyForm?.addEventListener('submit',e=>{ e.preventDefault(); const q=Math.max(1,parseInt(qty?.value||'1',10)); if(!currentSize) return alert('Elige talla'); addToCart({sku:p.sku||p.slug,title:p.title,price:Number(p.price)||0,size:currentSize,qty:q,img:imgs[0]}); });
  }catch(e){ console.error(e); }
})();
