/* ================ Config ================ */
const CATALOG_URL = "catalog.json";
const DISCOUNT_CODE = "PROPHETIA10";
const DISCOUNT_PCT  = 10;

const $  = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
const slugify = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

/* Announce */
$('#closeAnnounce')?.addEventListener('click',()=>$('#announceBar').style.display='none');

/* Mega menu */
(function(){
  const mega=$('.mega'); if(!mega) return;
  const btn=mega.querySelector('.mega-toggle');
  const open =()=>{ mega.classList.add('open'); btn.setAttribute('aria-expanded','true'); };
  const close=()=>{ mega.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
  btn.addEventListener('click',e=>{e.preventDefault(); mega.classList.contains('open')?close():open();});
  document.addEventListener('click',e=>{ if(!mega.contains(e.target)) close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
})();

/* Carrito + cupón */
const CART_KEY='pp_cart';
const getCart = ()=> JSON.parse(localStorage.getItem(CART_KEY)||'[]');
const setCart = c  => localStorage.setItem(CART_KEY,JSON.stringify(c));
function addToCart(p){ const c=getCart(); const ex=c.find(x=>x.sku===p.sku && x.size===p.size); ex?ex.qty+=p.qty:c.push(p); setCart(c); updateCartCount(); renderCart(); openCart(); }
function updateCartCount(){ const el=$('#cartCount'); if(el) el.textContent=getCart().reduce((n,x)=>n+(x.qty||0),0); }
function openCart(){ $('#cartDrawer')?.classList.add('show'); $('#cartBackdrop')?.classList.add('show'); }
function closeCart(){ $('#cartDrawer')?.classList.remove('show'); $('#cartBackdrop')?.classList.remove('show'); }
$('#cartBackdrop')?.addEventListener('click',closeCart); $('#closeCart')?.addEventListener('click',closeCart); $('.cart-btn')?.addEventListener('click',openCart);

function hasActiveCoupon(){ const u=+localStorage.getItem('pp_coupon_expires_at')||0; return localStorage.getItem('pp_coupon_applied')===DISCOUNT_CODE && Date.now()<u; }
function setActiveCoupon(days=30){ const until=Date.now()+days*86400000; localStorage.setItem('pp_coupon_applied',DISCOUNT_CODE); localStorage.setItem('pp_coupon_expires_at',String(until)); const n=$('#couponNote'), nm=$('#couponName'); if(n&&nm){ nm.textContent=DISCOUNT_CODE; n.style.display='block'; } renderCart(); }
$('#applyCoupon')?.addEventListener('click',()=>{ const v=($('#couponInput')?.value||'').trim().toUpperCase(); if(v===DISCOUNT_CODE){ setActiveCoupon(); alert('Descuento aplicado'); } else alert('Código no válido'); });

function renderCart(){
  const box=$('#cartItems'), tot=$('#cartTotal'); if(!box||!tot) return;
  const c=getCart(); let subtotal=0;
  box.innerHTML=c.map((x,i)=>{ const line=(x.price||0)*(x.qty||1); subtotal+=line; return `
    <div class="cart-item">
      <img src="${x.img||x.images?.[0]||'images/noimg.png'}" alt="${x.title}">
      <div class="cart-info"><strong>${x.title}</strong><span>Talla: ${x.size||'-'} — €${Number(x.price||0).toFixed(0)} × ${x.qty||1}</span></div>
      <button class="cart-remove" data-i="${i}">×</button>
    </div>`; }).join('') || '<p class="muted">Tu carrito está vacío.</p>';
  box.querySelectorAll('.cart-remove').forEach(b=> b.addEventListener('click',()=>{ const i=+b.dataset.i; const cc=getCart(); cc.splice(i,1); setCart(cc); renderCart(); updateCartCount(); }));
  const total = hasActiveCoupon()? subtotal*(1-DISCOUNT_PCT/100) : subtotal;
  tot.textContent = hasActiveCoupon()? `€${total.toFixed(2)} (-${DISCOUNT_PCT}%)` : `€${total.toFixed(2)}`;
}
updateCartCount(); renderCart();

/* Catálogo (colecciones) */
async function loadCatalog(){
  const grid=$('#productsGrid'); if(!grid) return;
  try{
    const res=await fetch(CATALOG_URL,{cache:'no-store'});
    const products=await res.json();

    grid.innerHTML = products.map(p=>{
      const cat=p.collection_slug||slugify(p.collection);
      const imgs=Array.isArray(p.images)&&p.images.length?p.images:['images/noimg.png'];
      const dots = imgs.map((_,i)=>`<span class="card-dot ${i===0?'active':''}" data-i="${i}"></span>`).join('');
      return `
        <article class="card product" data-cat="${cat}">
          <div class="img-wrap" data-images='${JSON.stringify(imgs).replace(/'/g,"&apos;")}'>
            ${p.badge?`<span class="badge">${p.badge}</span>`:''}
            <img src="${imgs[0]}" alt="${p.title}">
            <div class="card-arrows">
              <button class="card-arrow prev" aria-label="Anterior">‹</button>
              <button class="card-arrow next" aria-label="Siguiente">›</button>
            </div>
            <div class="card-dots">${dots}</div>
          </div>
          <h4>${p.title}</h4>
          <p class="collection">${p.collection}${p.technique?` — ${p.technique}`:''}</p>
          <strong class="price">€${Number(p.price||0).toFixed(0)}</strong>
          <a class="btn-primary" href="product.html?slug=${p.slug}">Ver detalle</a>
        </article>`;
    }).join('');

    bindFilters();
    bindCardSlides();

  }catch(e){
    console.error(e);
    grid.innerHTML = '<p>Error al cargar catálogo.</p>';
  }
}

/* Filtros: SOLO 2 colecciones */
function bindFilters(){
  const chips=$$('.chip'), cards=$$('.products-grid .product'); if(!chips.length||!cards.length) return;
  function apply(f){
    chips.forEach(c=>c.classList.toggle('chip-active', c.dataset.filter===f || (f==='all'&&c.dataset.filter==='all')));
    cards.forEach(p=>{ p.style.display = (f==='all'||p.dataset.cat===f)?'':'none'; });
  }
  chips.forEach(ch=> ch.addEventListener('click',()=>{ const f=ch.dataset.filter||'all'; apply(f); if(f!=='all') location.hash=f; else history.replaceState(null,'',location.pathname); }));
  const h=(location.hash||'#all').slice(1).toLowerCase();
  apply(['myth-series','letters-from-the-soul'].includes(h)?h:'all');
}

/* Slider en tarjeta: flechas + puntos + autoplay hover */
function bindCardSlides(){
  $$('.card.product .img-wrap').forEach(wrap=>{
    const img = $('img',wrap); if(!img) return;
    const images = JSON.parse(wrap.dataset.images.replace(/&apos;/g,"'"));
    let i=0, timer=null;

    const set = (idx)=>{
      i = (idx+images.length)%images.length;
      img.style.opacity=0;
      setTimeout(()=>{ img.src=images[i]; img.style.opacity=1; },100);
      wrap.querySelectorAll('.card-dot').forEach((d,k)=>d.classList.toggle('active',k===i));
    };

    $('.prev',wrap)?.addEventListener('click',e=>{ e.stopPropagation(); set(i-1); });
    $('.next',wrap)?.addEventListener('click',e=>{ e.stopPropagation(); set(i+1); });
    wrap.querySelectorAll('.card-dot').forEach(d=> d.addEventListener('click',e=>{ e.stopPropagation(); set(+d.dataset.i); }));

    if(images.length>1){
      wrap.addEventListener('mouseenter',()=>{ timer=setInterval(()=>set(i+1),1600); });
      wrap.addEventListener('mouseleave',()=>{ clearInterval(timer); timer=null; set(0); });
    }
  });
}

loadCatalog();

/* PDP (flechas + puntos + thumbs) */
(async function hydratePDP(){
  const slug=new URLSearchParams(location.search).get('slug'); if(!slug) return;
  const pTitle=$('#pTitle'), pDesc=$('#pDesc'), pPrice=$('#pPrice'),
        pMain=$('#pMain'), pThumbs=$('#pThumbs'), pDots=$('#pDots'),
        sizeRow=$('#sizeRow'), qty=$('#qty'), buyForm=$('#buyForm');
  try{
    const res=await fetch(CATALOG_URL,{cache:'no-store'}); const list=await res.json();
    const p=list.find(x=>x.slug===slug); if(!p) return;

    document.title=`${p.title} — PROPHETIA`;
    pTitle.textContent=p.title; pDesc.textContent=p.description||''; pPrice.textContent='€'+Number(p.price||0).toFixed(0);

    const imgs=(Array.isArray(p.images)&&p.images.length?p.images:['images/noimg.png']);
    let idx=0; const set = (k)=>{ idx=k; pMain.style.opacity=0; setTimeout(()=>{ pMain.src=imgs[idx]; pMain.style.opacity=1; },100);
      $$('.thumb',pThumbs).forEach((t,i)=>t.classList.toggle('active',i===idx));
      $$('.dot',pDots).forEach((d,i)=>d.classList.toggle('active',i===idx));
    };

    pMain.src=imgs[0];
    pThumbs.innerHTML = imgs.map((s,i)=>`<img class="thumb ${i===0?'active':''}" src="${s}" alt="${p.title} ${i+1}">`).join('');
    pDots.innerHTML   = imgs.map((_,i)=>`<span class="dot ${i===0?'active':''}" data-i="${i}"></span>`).join('');
    $$('.thumb',pThumbs).forEach((t,i)=> t.addEventListener('click',()=>set(i)));
    $$('.dot',pDots).forEach((d,i)=> d.addEventListener('click',()=>set(i)));
    $('.g-prev')?.addEventListener('click',()=> set((idx-1+imgs.length)%imgs.length));
    $('.g-next')?.addEventListener('click',()=> set((idx+1)%imgs.length));

    const sizes=p.sizes||{S:0,M:0,L:0,XL:0,XXL:0}; let currentSize=null;
    sizeRow.innerHTML = Object.keys(sizes).map(k=>`<button type="button" class="size-btn" data-size="${k}" ${sizes[k]<=0?'disabled':''}>${k}</button>`).join('');
    $$('.size-btn',sizeRow).forEach(b=> b.addEventListener('click',()=>{ if(b.disabled)return; $$('.size-btn',sizeRow).forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentSize=b.dataset.size; }));

    buyForm?.addEventListener('submit',e=>{
      e.preventDefault();
      const q=Math.max(1,parseInt(qty?.value||'1',10));
      if(!currentSize) return alert('Elige talla');
      addToCart({ sku:p.sku||p.slug, title:p.title, price:Number(p.price)||0, size:currentSize, qty:q, img:imgs[idx], images:imgs });
    });

  }catch(err){ console.error(err); }
})();
