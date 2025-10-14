/* ===== Scroll suave ===== */
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const href = a.getAttribute('href');
    if(href.startsWith('#')){
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({behavior:'smooth'});
    }
  });
});

/* ===== Nav móvil ===== */
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if(toggle && nav){
  toggle.addEventListener('click', ()=>{
    const open = nav.style.display === 'block';
    nav.style.display = open ? 'none' : 'block';
  });
}

/* ===== Filtros en collections ===== */
const chips = document.querySelectorAll('.chip');
const products = document.querySelectorAll('.products-grid .product');
chips.forEach(ch=>{
  ch.addEventListener('click', ()=>{
    chips.forEach(c=>c.classList.remove('chip-active'));
    ch.classList.add('chip-active');
    const cat = ch.dataset.filter;
    products.forEach(p=>{
      if(cat === 'all' || p.dataset.cat === cat){ p.style.display = ''; }
      else { p.style.display = 'none'; }
    });
  });
});

/* ===== Thumbs en product ===== */
const mainImg = document.getElementById('pMain');
const thumbs = document.querySelectorAll('.thumb');
thumbs.forEach(t=>{
  t.addEventListener('click', ()=>{
    thumbs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    mainImg.src = t.src;
    mainImg.alt = t.alt;
  });
});

/* ===== Relleno dinámico de producto por querystring (opcional simple) ===== */
const params = new URLSearchParams(location.search);
const slug = params.get('slug');
if(slug){
  // Muy simple: cambia título según slug. Luego podrás mapear a JSON.
  const titles = {
    'the-apollon-seal': 'The Apollon Seal — Prophetia',
    'baobab-lancers': 'Baobab Lancers — Prophetia',
    'ventus-zephyrus': 'Ventus Zephyrus — Prophetia'
  };
  const t = document.getElementById('pTitle');
  if(t && titles[slug]) t.textContent = titles[slug];
}
/* ===== Cargar catálogo automáticamente ===== */
async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return; // si no estamos en collections.html, salir

  try {
    const response = await fetch('catalog.json');
    const products = await response.json();

    // Generar tarjetas dinámicamente
    grid.innerHTML = products.map(p => `
      <article class="card product" data-cat="${p.collection.toLowerCase()}">
        <a href="product.html?slug=${p.slug}">
          <div class="media">
            <img loading="lazy" src="${p.img}" alt="${p.title} — Prophetia">
          </div>
          <div class="card-body">
            <h2 class="product-title">${p.title}</h2>
            <p class="product-meta">${p.collection} — ${p.technique}</p>
          </div>
        </a>
      </article>
    `).join('');
  } catch (err) {
    console.error("Error cargando catálogo:", err);
    grid.innerHTML = "<p>Error al cargar los productos.</p>";
  }
}
loadCatalog();
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

/* ===== Hook para colecciones: observar tarjetas generadas dinámicamente ===== */
async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  try {
    const response = await fetch('../catalog.json'); // si colecciones.html está en /Imágenes/
    const products = await response.json();

    grid.innerHTML = products.map(p => `
      <article class="card product reveal-init" data-cat="${p.collection.toLowerCase()}">
        <a href="../product.html?slug=${p.slug}">
          <div class="media">
            <img loading="lazy" src="${p.img}" alt="${p.title} — Prophetia">
          </div>
          <div class="card-body">
            <h2 class="product-title">${p.title}</h2>
            <p class="product-meta">${p.collection} — ${p.technique}</p>
          </div>
        </a>
      </article>
    `).join('');

    // observar después de insertar
    grid.querySelectorAll('.reveal-init').forEach(el=>observer.observe(el));
  } catch (err) {
    console.error("Error cargando catálogo:", err);
    grid.innerHTML = "<p>Error al cargar los productos.</p>";
  }
}
loadCatalog && loadCatalog();
