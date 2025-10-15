/* ==========================
   PROPHETIA — JS unificado (v60)
   ========================== */

// ------- Catálogo de ejemplo (añadí hoodies) -------
const PRODUCTS = [
  // T-Shirts
  {
    id:'atlas-seal',
    title:'Atlas by Prophetia',
    price:59, collection:'myth-series', category:'tshirts',
    fit:'regular', gender:'unisex', stock:24, bestseller:true, newAt:'2025-01-05',
    desc:'Perfil escultórico y sello griego en tinta dorada. DTG-ready.',
    sizes:['S','M','L','XL'],
    images:[
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-front-68eec465daada.png',
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-front-68eec465db232.png',
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-left-front-68eec465db71a.png',
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-back-68eec465dbff1.png'
    ],
    thumb:'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-front-68eec465daada.png'
  },
  {
    id:'calyra-huella',
    title:"Calyra's Ego by Prophetia",
    price:64, collection:'myth-series', category:'tshirts',
    fit:'oversized', gender:'unisex', stock:12, bestseller:false, newAt:'2025-01-18',
    desc:'Diosa egipcia contemporánea, gesto geométrico y aura editorial.',
    sizes:['S','M','L','XL'],
    images:[
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-back-68eec465dbff1.png',
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-front-68eec465db232.png'
    ],
    thumb:'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-back-68eec465dbff1.png'
  },
  {
    id:'letters-01',
    title:'Letters from the Soul — I',
    price:49, collection:'letters-from-the-soul', category:'tshirts',
    fit:'oversized', gender:'unisex', stock:0, bestseller:false, newAt:'2024-12-20',
    desc:'Manifiesto editorial: tipografía Prophetia y silencio elegante.',
    sizes:['S','M','L','XL'],
    images:[
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-right-68eec465dc891.png',
      'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-front-68eec465daada.png'
    ],
    thumb:'Imagenes/Atlas/oversized-faded-t-shirt-faded-bone-right-68eec465dc891.png'
  },

  // Hoodies (mock)
  {
    id:'hoodie-atlas',
    title:'Atlas — Gilded Seal Hoodie',
    price:89, collection:'myth-series', category:'hoodies',
    fit:'regular', gender:'unisex', stock:18, bestseller:true, newAt:'2025-01-22',
    desc:'Hoodie con sello dorado y composición axial Prophetia.',
    sizes:['S','M','L','XL'],
    images:['images/hoodie01_front.jpg','images/hoodie01_back.jpg'],
    thumb:'images/hoodie01_front.jpg'
  },
  {
    id:'hoodie-letters',
    title:'Letters — Editorial Hoodie',
    price:95, collection:'letters-from-the-soul', category:'hoodies',
    fit:'oversized', gender:'unisex', stock:7, bestseller:false, newAt:'2025-01-15',
    desc:'Hoodie tipográfico, minimalista y editorial.',
    sizes:['S','M','L','XL'],
    images:['images/hoodie02_front.jpg','images/hoodie02_back.jpg'],
    thumb:'images/hoodie02_front.jpg'
  }
];

// ------- Utilidades / carrito -------
const qs=s=>document.querySelector(s), qsa=s=>Array.from(document.querySelectorAll(s));
const fmt=n=>`€${n.toFixed(2)}`;
const CART_KEY='pp_cart', COOKIES_KEY='prophetia_cookies', COUPON_KEY='pp_coupon_applied';

function getCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY))||[]}catch{return[]} }
function setCart(c){ localStorage.setItem(CART_KEY,JSON.stringify(c)); renderCart(); }
function addToCart(item){ const c=getCart(); const i=c.findIndex(x=>x.id===item.id&&x.size===item.size); if(i>-1)c[i].qty+=item.qty; else c.push(item); setCart(c); }

function renderCart(){
  const itemsEl=qs('#cartItems'), totalEl=qs('#cartTotal'), countEl=qs('#cartCount'); if(!itemsEl||!totalEl||!countEl)return;
  const cart=getCart(); let total=0;
  itemsEl.innerHTML=cart.map((c,i)=>{const p=PRODUCTS.find(p=>p.id===c.id)||{}; const line=(p.price||0)*c.qty; total+=line; return `
    <div class="cart-item">
      <img src="${p.thumb||''}" alt="${p.title||''}">
      <div style="flex:1"><div style="font-weight:700">${p.title||'Producto'}</div><small class="muted">Talla ${c.size} · ${c.qty} ud.</small></div>
      <div style="font-weight:700">${fmt(line)}</div>
      <button class="cart-remove" data-i="${i}" aria-label="Eliminar">×</button>
    </div>`}).join('');
  const applied=localStorage.getItem(COUPON_KEY); const discount=applied==='PROPHETIA10'? total*.10 : 0;
  totalEl.textContent=fmt(Math.max(total-discount,0));
  countEl.textContent=cart.reduce((a,b)=>a+b.qty,0);
  qsa('.cart-remove').forEach(btn=>btn.addEventListener('click',()=>{const i=+btn.dataset.i; setCart(getCart().filter((_,idx)=>idx!==i));}));
}
function setupCartDrawer(){
  const d=qs('#cartDrawer'), b=qs('#cartBackdrop'), o=qs('#openCart')||qs('.cart-btn'), c=qs('#closeCart');
  const open=()=>{d?.classList.add('show'); b?.classList.add('show'); renderCart();};
  const close=()=>{d?.classList.remove('show'); b?.classList.remove('show');};
  o?.addEventListener('click',open); c?.addEventListener('click',close); b?.addEventListener('click',close);
}
function setupAnnounce(){qs('#closeAnnounce')?.addEventListener('click',()=>qs('#announceBar')?.remove());}
function setupCookies(){const bn=qs('#cookieBanner'); if(!bn)return; if(!localStorage.getItem(COOKIES_KEY)) bn.style.display='flex';
  qs('#acceptCookies')?.addEventListener('click',()=>{localStorage.setItem(COOKIES_KEY,'accepted'); bn.style.display='none';});
  qs('#rejectCookies')?.addEventListener('click',()=>{localStorage.setItem(COOKIES_KEY,'rejected'); bn.style.display='none';});
}
function setupCoupon(){const i=qs('#couponInput'), a=qs('#applyCoupon'), n=qs('#couponNote'), nm=qs('#couponName');
  a?.addEventListener('click',()=>{const v=(i?.value||'').trim().toUpperCase(); if(v==='PROPHETIA10'){localStorage.setItem(COUPON_KEY,'PROPHETIA10'); if(n&&nm){nm.textContent='PROPHETIA10'; n.style.display='block';} renderCart(); alert('10% aplicado.');} else alert('Cupón no válido.');});
  if(localStorage.getItem(COUPON_KEY)==='PROPHETIA10'&&n&&nm){nm.textContent='PROPHETIA10'; n.style.display='block';}
}

// ------- Mega menu -------
function setupMega(){
  qsa('.mega').forEach(mega=>{
    const t=mega.querySelector('.mega-toggle'); let timer;
    const open=()=>{clearTimeout(timer); mega.classList.add('open'); t?.setAttribute('aria-expanded','true');};
    const close=()=>{timer=setTimeout(()=>{mega.classList.remove('open'); t?.setAttribute('aria-expanded','false');},120);};
    t?.addEventListener('click',e=>{e.preventDefault(); mega.classList.contains('open')?close():open();});
    mega.addEventListener('mouseenter',open); mega.addEventListener('mouseleave',close);
  });
}

// ------- Colecciones (página colecciones) -------
function renderCollections(){
  const grid=qs('#productsGrid'); if(!grid)return;
  const hash=(location.hash||'').replace('#',''); let active=['myth-series','letters-from-the-soul'].includes(hash)?hash:'all';
  draw(active);
  qsa('.chip').forEach(ch=>ch.addEventListener('click',()=>{qsa('.chip').forEach(c=>c.classList.remove('chip-active')); ch.classList.add('chip-active'); draw(ch.dataset.filter);} ));
  if(active!=='all'){ qsa('.chip').forEach(c=>{if(c.dataset.filter===active){qsa('.chip').forEach(x=>x.classList.remove('chip-active')); c.classList.add('chip-active');}}); }
  function draw(filter){
    const list=PRODUCTS.filter(p=> filter==='all'?true:p.collection===filter);
    grid.innerHTML=list.map(p=>`
      <article class="card">
        <div class="img-wrap"><img src="${p.thumb}" alt="${p.title}"></div>
        <h4>${p.title}</h4>
        <p class="collection">${p.desc}</p>
        <span class="price">${fmt(p.price)}</span>
        <a class="btn-primary" href="productos.html?id=${encodeURIComponent(p.id)}">Ver</a>
      </article>`).join('');
  }
}

// ------- PDP -------
function renderPDP(){
  const id=new URLSearchParams(location.search).get('id'); if(!id)return;
  const p=PRODUCTS.find(x=>x.id===id); if(!p)return;
  const title=qs('#pTitle'), price=qs('#pPrice'), desc=qs('#pDesc'), main=qs('#pMain'), dots=qs('#pDots'), thumbs=qs('#pThumbs'), sizeRow=qs('#sizeRow'), form=qs('#buyForm'); let idx=0;
  document.title=`${p.title} — PROPHETIA`; title?.textContent=p.title; price?.textContent=fmt(p.price); desc?.textContent=p.desc;
  function setImg(i){idx=(i+p.images.length)%p.images.length; main.src=p.images[idx]; qsa('.dot',dots).forEach((d,di)=>d.classList.toggle('active',di===idx)); qsa('img',thumbs).forEach((t,ti)=>t.classList.toggle('active',ti===idx));}
  if(!main)return;
  main.alt=p.title; dots.innerHTML=p.images.map((_,i)=>`<span class="dot ${i===0?'active':''}"></span>`).join(''); thumbs.innerHTML=p.images.map((s,i)=>`<img src="${s}" alt="${p.title} ${i+1}" class="${i===0?'active':''}">`).join(''); setImg(0);
  qs('.g-prev')?.addEventListener('click',()=>setImg(idx-1)); qs('.g-next')?.addEventListener('click',()=>setImg(idx+1));
  qsa('.dot',dots).forEach((d,i)=>d.addEventListener('click',()=>setImg(i)));
  qsa('img',thumbs).forEach((t,i)=>t.addEventListener('click',()=>setImg(i)));
  sizeRow.innerHTML=p.sizes.map((s,i)=>`<button class="size-btn ${i===0?'active':''}" data-s="${s}">${s}</button>`).join(''); let sel=p.sizes[0];
  qsa('.size-btn',sizeRow).forEach(b=>b.addEventListener('click',()=>{qsa('.size-btn',sizeRow).forEach(x=>x.classList.remove('active')); b.classList.add('active'); sel=b.dataset.s;}));
  form?.addEventListener('submit',e=>{e.preventDefault(); const qty=Math.max(1,parseInt(qs('#qty').value,10)||1); addToCart({id:p.id,size:sel,qty}); alert('Añadido al carrito.');});
}

// ------- Catálogo (camisetas / hoodies) -------
function renderCategoryPage(){
  const grid=qs('#categoryGrid'); if(!grid)return;
  const pager=qs('#pager'); const cat=(document.body.dataset.cat)||'tshirts';
  let fit=(location.hash.replace('#','')==='oversized')?'oversized':'all', gender='all', inStock=false, sort='relevance', page=1, perPage=12;

  const fitChips=qsa('.chip[data-sub]'), genderChips=qsa('.chip[data-gender]'), stockChk=qs('#inStockOnly'), sortSel=qs('#sortSelect');

  if(fit==='oversized'){ fitChips.forEach(c=>c.classList.toggle('chip-active', c.dataset.sub==='oversized')); }
  fitChips.forEach(ch=>ch.addEventListener('click',()=>{fit=ch.dataset.sub; fitChips.forEach(x=>x.classList.remove('chip-active')); ch.classList.add('chip-active'); page=1; draw();}));
  genderChips.forEach(ch=>ch.addEventListener('click',()=>{gender=ch.dataset.gender; genderChips.forEach(x=>x.classList.remove('chip-active')); ch.classList.add('chip-active'); page=1; draw();}));
  stockChk?.addEventListener('change',()=>{inStock=!!stockChk.checked; page=1; draw();});
  sortSel?.addEventListener('change',()=>{sort=sortSel.value; page=1; draw();});

  function filtered(){
    return PRODUCTS
      .filter(p=>p.category===cat)
      .filter(p=>fit==='all'?true:p.fit===fit)
      .filter(p=>gender==='all'?true:p.gender===gender)
      .filter(p=>inStock? p.stock>0 : true);
  }
  function sorted(list){
    const byDate=(a,b)=>new Date(b.newAt)-new Date(a.newAt);
    if(sort==='price-asc') return list.sort((a,b)=>a.price-b.price);
    if(sort==='price-desc') return list.sort((a,b)=>b.price-a.price);
    if(sort==='new') return list.sort(byDate);
    return list.sort((a,b)=> (b.bestseller?1:0)-(a.bestseller?1:0) || byDate(a,b));
  }
  function paginate(list){const total=list.length; const pages=Math.max(1,Math.ceil(total/perPage)); page=Math.min(page,pages); const s=(page-1)*perPage; return {slice:list.slice(s,s+perPage), pages, total};}

  function draw(){
    let list=sorted(filtered()); const {slice,pages}=paginate(list);
    grid.innerHTML=slice.map(p=>`
      <article class="tile">
        ${p.bestseller?'<span class="badge best">Best</span>':''}
        ${new Date(p.newAt)>new Date(Date.now()-1000*60*60*24*21)?'<span class="badge new" style="left:auto;right:10px">New</span>':''}
        <a href="productos.html?id=${encodeURIComponent(p.id)}">
          <div class="tile-img"><img src="${p.thumb}" alt="${p.title}"></div>
          <div class="tile-body"><div class="tile-title">${p.title}</div><div class="tile-price">${fmt(p.price)}${p.stock<=0?' · <span class="muted">Agotado</span>':''}</div></div>
        </a>
      </article>`).join('');

    if(pages<=1){pager.innerHTML=''; return;}
    let html=`<button class="page-btn" ${page<=1?'disabled':''} data-go="${page-1}">«</button>`;
    for(let i=1;i<=pages;i++){
      if(pages>7){
        if(i===1||i===pages||Math.abs(i-page)<=1) html+=`<button class="page-btn ${i===page?'active':''}" data-go="${i}">${i}</button>`;
        else if((i===2&&page>3)||(i===pages-1&&page<pages-2)) html+=`<span class="page-btn" disabled>…</span>`;
      } else html+=`<button class="page-btn ${i===page?'active':''}" data-go="${i}">${i}</button>`;
    }
    html+=`<button class="page-btn" ${page>=pages?'disabled':''} data-go="${page+1}">»</button>`;
    pager.innerHTML=html;
    qsa('.page-btn',pager).forEach(b=>{const go=b.getAttribute('data-go'); if(!go)return; b.addEventListener('click',()=>{const n=parseInt(go,10); if(!isNaN(n)){page=n; draw();}});});
  }
  draw();
}

// ------- Modal Prophetia Tribe -------
function setupTribe(){
  const modal=qs('#tribeModal'); if(!modal) return;
  const openBtn=qs('#openTribe'); const closeBtn=qs('#closeTribe'); const ok=qs('#tribeOk');
  const form=qs('#tribeForm'); const thanks=qs('#tribeThanks');

  const open=()=>{modal.classList.add('show'); modal.setAttribute('aria-hidden','false');};
  const close=()=>{modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');};

  openBtn?.addEventListener('click',open);
  closeBtn?.addEventListener('click',close);
  ok?.addEventListener('click',close);
  modal.addEventListener('click',e=>{ if(e.target===modal) close(); });

  // auto-open una vez por sesión
  if(!sessionStorage.getItem('pp_tribe_seen')){ setTimeout(open, 1400); sessionStorage.setItem('pp_tribe_seen','1'); }

  form?.addEventListener('submit',e=>{
    e.preventDefault();
    // Aquí podrías integrar EmailJS; de momento sólo “ok”.
    form.style.display='none'; thanks.style.display='block';
    localStorage.setItem('pp_coupon_applied','PROPHETIA10'); // ejemplo
  });
}

// ------- Init -------
document.addEventListener('DOMContentLoaded', ()=>{
  setupAnnounce();
  setupMega();
  setupCartDrawer();
  setupCookies();
  setupCoupon();
  renderCollections();
  renderPDP();
  renderCart();
  renderCategoryPage();
  setupTribe();
});
document.addEventListener('DOMContentLoaded', () => {
  /* ====== MEGA MENÚS (hover + click) ====== */
  const megas = document.querySelectorAll('.mega');

  megas.forEach(mega => {
    const toggle = mega.querySelector('.mega-toggle');
    const panel  = mega.querySelector('.mega-panel');
    let hideTimer;

    const open = () => {
      clearTimeout(hideTimer);
      mega.classList.add('open');
      toggle?.setAttribute('aria-expanded','true');
    };
    const close = (delay = 120) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        mega.classList.remove('open');
        toggle?.setAttribute('aria-expanded','false');
      }, delay);
    };

    // Abrir por hover y focus
    toggle?.addEventListener('mouseenter', open);
    toggle?.addEventListener('focus', open);
    panel?.addEventListener('mouseenter', open);

    // Cerrar cuando salimos del botón o del panel
    toggle?.addEventListener('mouseleave', () => close(120));
    panel?.addEventListener('mouseleave', () => close(120));

    // Toggle por click (móvil / touch / accesibilidad)
    toggle?.addEventListener('click', (e) => {
      e.preventDefault();
      if (mega.classList.contains('open')) close(0);
      else open();
    });
  });

  // Cerrar todos con click fuera o ESC
  const closeAllMegas = () => megas.forEach(m => m.classList.remove('open'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mega')) closeAllMegas();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMegas();
  });

  /* ====== AVISO SUPERIOR ====== */
  document.getElementById('closeAnnounce')?.addEventListener('click', () => {
    document.getElementById('announceBar')?.remove();
  });

  /* ====== CARRITO LATERAL (básico) ====== */
  const cartDrawer   = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const openCartBtn  = document.getElementById('openCart') || document.querySelector('.cart-btn');
  const closeCartBtn = document.getElementById('closeCart');

  const openCart  = () => { cartDrawer?.classList.add('show'); cartBackdrop?.classList.add('show'); };
  const closeCart = () => { cartDrawer?.classList.remove('show'); cartBackdrop?.classList.remove('show'); };

  openCartBtn?.addEventListener('click', openCart);
  closeCartBtn?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);

  /* ====== COOKIES ====== */
  const banner = document.getElementById('cookieBanner');
  if (banner && !localStorage.getItem('prophetia_cookies')) {
    banner.style.display = 'flex';
  }
  document.getElementById('acceptCookies')?.addEventListener('click', () => {
    localStorage.setItem('prophetia_cookies','accepted');
    banner.style.display = 'none';
  });
  document.getElementById('rejectCookies')?.addEventListener('click', () => {
    localStorage.setItem('prophetia_cookies','rejected');
    banner.style.display = 'none';
  });

  /* ====== MODAL “PROPHETIA TRIBE” ====== */
  const tribeModal  = document.getElementById('tribeModal');
  const openTribe   = document.getElementById('openTribe');
  const closeTribe  = document.getElementById('closeTribe');
  const tribeForm   = document.getElementById('tribeForm');
  const tribeThanks = document.getElementById('tribeThanks');
  const tribeOk     = document.getElementById('tribeOk');

  const showTribe = () => { if (tribeModal) tribeModal.style.display = 'block'; };
  const hideTribe = () => { if (tribeModal) tribeModal.style.display = 'none'; };

  openTribe?.addEventListener('click', showTribe);
  closeTribe?.addEventListener('click', hideTribe);
  tribeOk?.addEventListener('click', hideTribe);
  tribeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    tribeForm.style.display  = 'none';
    tribeThanks.style.display = 'block';
  });
});
