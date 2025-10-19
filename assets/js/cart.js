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
