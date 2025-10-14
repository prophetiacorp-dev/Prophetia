/* =========================
   PROPHETIA — script.js
   ========================= */

/* ===== Util ===== */
const $ = s => document.querySelector(s);

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

/* ===== Filtros ===== */
function bindFilters(){
  const chips = document.querySelectorAll('.chip');
  const products = document.querySelectorAll('.products-grid .product');
  if(!chips.length || !products.length) return;

  function apply(f){
    chips.forEach(c=>c.classList.toggle('chip-active', c.dataset.filter===f || (f==='all' && c.dataset.filter==='all')));
    products.forEach(p=> p.style.display = (f==='all' || p.dataset.cat===f) ? '' : 'none');
  }
  chips.forEach(ch=> ch.addEventListener('click', ()=>{ const f=ch.dataset.filter||'all'; apply(f); if(f!=='all') location.hash=f; else history.replaceState(null,'',location.pathname); }));
  const fromHash=(location.hash||'#all').slice(1).toLowerCase();
  apply(['myth','baobab','ventus'].includes(fromHash)?fromHash:'all');
}

/* ===== Catálogo dinámico (cards con hover y badge) ===== */
async function loadCatalog(){
  const grid = $('#productsGrid');
  if(!grid) return;
  try{
    const res = await fetch('catalog.json',{cache:'no-store'});
    const products = await res.json();

    grid.innerHTML = products.map(p=>{
      const img1 = p.images?.[0] || '';
      const img2 = p.images?.[1] || p.images?.[0] || '';
      const badge = p.badge ? `<span class="badge">${p.badge}</span>` : '';
      return `
        <article class="card product reveal-init" data-cat="${(p.collection||'').toLowerCase()}">
          <a href="product.html?slug=${p.slug}">
            <div class="media frame">
              ${badge}
              <img class="img-1" loading="lazy" src="${img1}" alt="${p.title}">
              <img class="img-2" loading="lazy" src="${img2}" alt="${p.title} alt">
            </div>
            <div class="card-body">
              <h2 class="product-title">${p.title}</h2>
              <p class="product-meta">${p.collection}${p.technique? ' — '+p.technique:''}</p>
              <div class="price-tag">€${Number(p.price||0).toFixed(0)}</div>
            </div>
          </a>
        </article>`;
    }).join('');

    grid.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));
    bindFilters();
  }catch(e){
    console.error(e);
    grid.innerHTML = "<p>Error al cargar los productos.</p>";
  }
}
loadCatalog();

/* ===== PDP dinámica con tallas/stock, qty y PayPal ===== */
const CART_KEY='prophetia_cart';
const getCart=()=>{ try{return JSON.parse(localStorage.getItem(CART_KEY))||[];}catch{return[];} };
const setCart=c=>{ localStorage.setItem(CART_KEY,JSON.stringify(c)); renderCart(); };
const addToCart=item=>{
  const cart=getCart();
  const i=cart.findIndex(x=>x.sku===item.sku && x.size===item.size);
  if(i>=0){ cart[i].qty+=item.qty; } else { cart.push(item); }
  setCart(cart);
};
const removeFromCart=(sku,size)=> setCart(getCart().filter(x=>!(x.sku===sku && x.size===size)));

function toast(msg){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1700);
}

function renderCart(){
  const itemsEl = $('#cartItems'), totalEl=$('#cartTotal'), countEl=$('#cartCount');
  if(!itemsEl) return;
  const cart=getCart(); let total=0;
  itemsEl.innerHTML = cart.map(x=>{
    const line=(x.price||0)*(x.qty||0); total+=line;
    return `<div class="cart-item">
      <img src="${x.img||''}" alt="${x.title||''}">
      <div><h5>${x.title||''}</h5><div class="muted">Talla: ${x.size||'-'} · €${Number(x.price||0).toFixed(0)} × ${x.qty||1}</div></div>
      <button class="remove" data-sku="${x.sku}" data-size="${x.size}">✕</button>
    </div>`;
  }).join('') || '<p class="muted">Tu carrito está vacío.</p>';
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

(async function hydrateProduct(){
  const slug = new URLSearchParams(location.search).get('slug');
  const pTitle=$('#pTitle'), pDesc=$('#pDesc'), pPrice=$('#pPrice'), pMain=$('#pMain'), pThumbs=$('#pThumbs');
  const sizeRow=$('#sizeRow'), qtyInput=$('#qty'), buyForm=$('#buyForm');
  const stickyBar=$('#stickyBar'), stickyTitle=$('#stickyTitle'), stickyPrice=$('#stickyPrice'), stickyAdd=$('#stickyAdd');
  if(!slug || !pTitle || !pDesc || !pPrice || !pMain || !pThumbs || !sizeRow || !qtyInput || !buyForm || !stickyBar) return;

  try{
    const res = await fetch('catalog.json',{cache:'no-store'}); const list=await res.json(); const p=list.find(x=>x.slug===slug);
    if(!p){ location.href='colecciones.html'; return; }

    document.title = `${p.title} — PROPHETIA`;
    pTitle.textContent=p.title; pDesc.textContent=p.description||''; pPrice.textContent='€'+Number(p.price||0).toFixed(0);
    stickyTitle.textContent=p.title; stickyPrice.textContent='€'+Number(p.price||0).toFixed(0);

    const imgs = Array.isArray(p.images)&&p.images.length?p.images:['images/placeholder.webp'];
    pMain.src=imgs[0]; pMain.alt=p.title;
    pThumbs.innerHTML = imgs.map((src,i)=>`<img class="thumb ${i===0?'active':''}" src="${src}" alt="${p.title} vista ${i+1}">`).join('');
    pThumbs.querySelectorAll('.thumb').forEach(t=> t.addEventListener('click',()=>{ pThumbs.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active')); t.classList.add('active'); pMain.src=t.src; }));

    // Tallas con stock
    const sizes = p.sizes || {S:0,M:0,L:0,XL:0,XXL:0};
    let currentSize = null;
    sizeRow.innerHTML = Object.keys(sizes).map(k=>{
      const disabled = sizes[k]<=0 ? 'disabled' : '';
      return `<button type="button" class="size-btn" data-size="${k}" ${disabled}>${k}</button>`;
    }).join('');
    sizeRow.querySelectorAll('.size-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.disabled) return;
        sizeRow.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); currentSize=btn.dataset.size;
      });
    });

    // Añadir al carrito
    function addSelected(qty){
      if(!currentSize) return alert('Elige talla');
      if((sizes[currentSize]||0) <= 0) return alert('Sin stock en esa talla');
      const n = Math.max(1, parseInt(qty||1,10));
      addToCart({ sku:p.sku||p.slug, title:p.title, price:Number(p.price)||0, size:currentSize, qty:n, img:imgs[0] });
      toast('Añadido al carrito'); openCart();
    }
    buyForm.addEventListener('submit', e=>{ e.preventDefault(); addSelected(qtyInput.value); });
    stickyAdd?.addEventListener('click', ()=> addSelected(qtyInput.value));

    // PayPal Buttons (si el SDK cargó)
    const ppWrap = document.getElementById('paypalButtons');
    if(window.paypal && ppWrap){
      paypal.Buttons({
        style:{ layout:'vertical', color:'gold', shape:'rect', label:'paypal' },
        createOrder: (data, actions)=>{
          const size = currentSize || Object.keys(sizes).find(s=>sizes[s]>0) || 'S';
          const qty  = Math.max(1, parseInt(qtyInput.value||'1',10));
          return actions.order.create({
            purchase_units:[{
              amount:{ currency_code:'EUR', value:(Number(p.price||0)*qty).toFixed(2) },
              items:[{ name:`${p.title} (Talla ${size})`, unit_amount:{currency_code:'EUR', value:Number(p.price||0).toFixed(2)}, quantity:String(qty), sku:p.sku||p.slug }]
            }]
          });
        },
        onApprove: async (data, actions)=>{
          await actions.order.capture();
          setCart([]); // vaciar carrito tras pago
          alert('¡Gracias! Pedido procesado.');
        },
        onError: (err)=>{ console.error(err); alert('Hubo un problema con el pago.'); }
      }).render(ppWrap);
    }

  }catch(err){ console.error(err); }
})();

/* ===== Fin PDP ===== */
/* ===== Announce bar (persistente 7 días) ===== */
(function(){
  const KEY='pp_announce_dismissed_until';
  const bar=document.getElementById('announceBar');
  const btn=document.getElementById('closeAnnounce');
  if(!bar||!btn) return;
  const now=Date.now();
  const until=parseInt(localStorage.getItem(KEY)||'0',10);
  if(until>now){ bar.style.display='none'; return; }
  btn.addEventListener('click', ()=>{
    bar.style.display='none';
    const sevenDays=now + 7*24*60*60*1000;
    localStorage.setItem(KEY, String(sevenDays));
  });
})();

/* ===== Newsletter modal (EmailJS) ===== */
(function(){
  const MKEY='pp_newsletter_seen_until';
  const modal=document.getElementById('nlModal');
  const backdrop=document.getElementById('nlBackdrop');
  const close=document.getElementById('nlClose');
  const form=document.getElementById('nlForm');
  const emailInput=document.getElementById('nlEmail');
  const thanks=document.getElementById('nlThanks');
  if(!modal||!backdrop||!form) return;

  function open(){ modal.classList.add('show'); backdrop.classList.add('show'); }
  function closeFn(){ modal.classList.remove('show'); backdrop.classList.remove('show'); }

  // Mostrar tras 12s si no se mostró en 7 días
  const now=Date.now(), until=parseInt(localStorage.getItem(MKEY)||'0',10);
  if(until<=now){ setTimeout(open, 12000); }
  close?.addEventListener('click', closeFn);
  backdrop?.addEventListener('click', closeFn);

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email=emailInput.value.trim();
    if(!email) return;
    try{
      if(window.emailjs){
        await emailjs.send("YOUR_EMAILJS_SERVICE_ID","YOUR_EMAILJS_TEMPLATE_ID",{ user_email: email });
      }
      form.style.display='none'; thanks.hidden=false;
      const sevenDays=now + 7*24*60*60*1000;
      localStorage.setItem(MKEY, String(sevenDays));
      setTimeout(closeFn, 2000);
    }catch(err){ console.error(err); alert('No se pudo enviar. Vuelve a intentar.'); }
  });
})();

/* ===== JSON-LD dinámico para product.html ===== */
(async function jsonldProduct(){
  const slug=new URLSearchParams(location.search).get('slug');
  const slot=document.getElementById('jsonld');
  if(!slug||!slot) return;
  try{
    const res=await fetch('catalog.json',{cache:'no-store'});
    const list=await res.json();
    const p=list.find(x=>x.slug===slug);
    if(!p) return;
    const firstImg=(Array.isArray(p.images)&&p.images[0])||'';
    const data={
      "@context":"https://schema.org",
      "@type":"Product",
      "name": p.title,
      "image": firstImg ? [firstImg] : [],
      "description": p.description||"",
      "sku": p.sku||p.slug,
      "brand": {"@type":"Brand","name":"PROPHETIA"},
      "offers":{
        "@type":"Offer",
        "price": String(p.price||0),
        "priceCurrency":"EUR",
        "availability": "https://schema.org/InStock",
        "url": location.href
      }
    };
    slot.textContent = JSON.stringify(data);
  }catch(e){ console.error(e); }
})();
