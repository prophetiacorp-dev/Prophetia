// assets/js/cart.js
(function(){
  function bindCart(){
    const open    = document.getElementById('cartOpen');
    const close   = document.getElementById('cartClose');
    const drawer  = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');

    if (!open || !close || !drawer || !overlay) return;

    const openCart = () => {
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      overlay.hidden = false;
      document.body.classList.add('no-scroll');
    };
    const closeCart = () => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      overlay.hidden = true;
      document.body.classList.remove('no-scroll');
    };

    open.addEventListener('click', openCart);
    close.addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);
    document.addEventListener('keydown', (e)=> e.key === 'Escape' && closeCart());
  }

  // inicialización normal
  document.addEventListener('DOMContentLoaded', bindCart);
  // inicialización explícita tras inyectar parciales
  window.ppCartInit = bindCart;
  // respaldo por evento
  window.addEventListener('partials:ready', bindCart);
})();
// ====== Prophetia · Cart empty renderer ====================================
(function () {
  // Utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Llama a esto cuando abras el carrito si no hay items
  function renderEmptyCart() {
    const drawer = $('.cart-drawer');
    const list = $('.cart-list');
    if (!drawer || !list) return;

    // UI vacío (emblema + texto)
    list.innerHTML = `
      <div class="cart-empty">
        <img class="cart-empty__emblem" src="assets/img/logo/prophetia-emblem.png" alt="PROPHETIA" />
        <div class="cart-empty__text">No hay artículos en tu cesta</div>
      </div>

      <div class="cart-info" id="cartInfo">
        ${accordionItem(
          'Plazo de entrega estimado',
          'Los pedidos se procesan en 24–48h laborables. La entrega estándar suele tardar 2–5 días laborables según destino.'
        )}
        ${accordionItem(
          'Envío y devolución gratuitos',
          'Envíos estándar y devoluciones gratuitas en pedidos dentro de la UE durante 14 días desde la recepción.'
        )}
        ${accordionItem(
          'Contáctanos',
          '¿Dudas con la talla, el envío o el cuidado de la prenda? Escríbenos a <a href="mailto:hola@prophetia.studio">hola@prophetia.studio</a>.'
        )}
      </div>
    `;

    // Activa los desplegables (acordeón ligero)
    const info = $('#cartInfo', drawer);
    info.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.acc__btn');
      if (!btn) return;
      const acc = btn.closest('.acc');
      acc.toggleAttribute('open');
    });
  }

  // Plantilla de cada bloque del acordeón
  function accordionItem(title, bodyHTML) {
    return `
      <section class="acc">
        <button class="acc__btn" type="button" aria-expanded="false">
          <span>${title}</span>
          <svg class="acc__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="acc__panel" hidden>
          ${bodyHTML}
        </div>
      </section>
    `;
  }

  // Sincroniza visual de open/closed con el panel (accesible)
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.acc__btn');
    if (!btn) return;
    const acc = btn.closest('.acc');
    const panel = acc.querySelector('.acc__panel');
    const nowOpen = !acc.hasAttribute('open');
    acc.toggleAttribute('open', nowOpen);
    btn.setAttribute('aria-expanded', String(nowOpen));
    panel.hidden = !nowOpen;
  });

  // Exponemos una API mínima por si la quieres usar desde otros módulos:
  // - ppCartSetItems(items): pinta vacío si items.length === 0
  // - ppCartRenderEmpty(): fuerza el estado vacío
  window.ppCartSetItems = function (items = []) {
    const count = Array.isArray(items) ? items.length : 0;
    const countNode = $('.cart-head .cart-count');
    if (countNode) countNode.textContent = count;
    if (count === 0) renderEmptyCart();
  };
  window.ppCartRenderEmpty = renderEmptyCart;

  // Cuando se abra el carrito, si no hay nada renderizado, dibuja vacío
  window.addEventListener('partials:ready', () => {
    // Si tu lógica principal ya pone items, esta línea no molesta.
    // Pinta el "vacío" solo si no hay nada todavía.
    const list = $('.cart-list');
    if (list && !list.children.length) renderEmptyCart();
  });

  // Por si ya está abierto al cargar esta mejora
  document.addEventListener('DOMContentLoaded', () => {
    const list = $('.cart-list');
    if (list && !list.children.length) renderEmptyCart();
  });
})();
