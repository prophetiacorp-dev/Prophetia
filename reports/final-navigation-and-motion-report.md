# Informe final — navegación móvil y movimiento PROPHETIA

## 1. Causa del contenido incorrecto de Prophetia House

El header mantenía dos listas independientes. `#panel-house` contenía las cuatro entradas editoriales correctas, mientras `#ppMobileSectionHouse` repetía manualmente esas entradas después de cinco destinos de cuenta. Además, `sectionForPath()` clasificaba rutas de usuario como si pertenecieran a House. La mezcla era estructural: no procedía de autenticación ni de datos remotos.

## 2. Fuente canónica final del menú

La única fuente es ahora la lista de escritorio `ul[data-pp-house-source]` de `public/assets/partials/header.html`. `header-init.js` vacía el destino `ul[data-pp-house-target]` y clona de forma segura sus elementos `li` con `cloneNode(true)`. No se clonan IDs ni listeners y no existe una segunda configuración de rutas.

## 3. Labels y rutas reales de Prophetia House

- Prophetia House Essence → `/about`
- Studio → `/studio`
- Música → `/musica`
- Eventos → `/events`

Las cuatro rutas responden HTTP 200 y su respuesta coincide por SHA-256 con el HTML local correspondiente. Se corrigió únicamente la grafía `Esence` a `Essence` en esta navegación.

## 4. Elementos eliminados de House móvil

Se retiraron de la pestaña editorial: Prophetia Tribe, Mi perfil, Mis pedidos, Lista de deseos y Libro de direcciones. Tampoco aparecen Vault, calendario, reservas, cierre de sesión ni ningún otro destino de cuenta dentro de House.

## 5. Contenido final del área de usuario

Sin sesión, el águila abre el diálogo existente de acceso/registro. Con una sesión resuelta, conduce al área real `/my-content`. El panel de cuenta existente conserva: Mi perfil, Pedidos, Reservas, Lista de deseos, Datos de cuenta, Libro de direcciones, Mis servicios y Cerrar sesión. Todos sus enlaces internos se comprobaron contra rutas reales. House Essence no está en ese panel.

## 6. Separación entre House y cuenta

House queda limitado a arquitectura editorial y el águila queda limitada a identidad de usuario. Las rutas de cuenta ya no seleccionan la pestaña House; el estado autenticado se resuelve antes de decidir entre acceso y `/my-content`. La prueba invitada confirmó que el águila no abre House y que el diálogo de acceso no contiene House Essence.

## 7. Causa de la negrita en Sudaderas de punto

El selector compartido `.pp-mobile-menu__links a[aria-current='page']` aplicaba `font-weight: 650`. Al marcar la ruta activa, “Sudaderas de punto” cambiaba de anchura y parecía tener un tratamiento exclusivo, aunque el problema afectaba conceptualmente a cualquier enlace activo.

## 8. Estado activo final

Todos los enlaces usan `font-weight: 400`. `aria-current="page"` se aplica solo cuando el `href` normalizado coincide exactamente con `window.location.pathname`; no hay coincidencias parciales. El estado se expresa mediante color contenido y una única línea editorial de 1 px, fuera del flujo, sin alterar altura, anchura ni posición del texto.

## 9. Archivos modificados

Archivos intervenidos en esta fase: `public/assets/partials/header.html`, `public/assets/js/header-init.js`, `public/assets/css/mobile-shell.css`, `public/assets/css/quick-add.css`, `public/assets/js/quick-add.js`, `public/assets/js/cart.js`, `public/assets/js/product-page.js`, `public/assets/js/script.js`, `public/assets/js/filters-drawer.js`, `public/assets/collects/archive-summer.html`, `public/assets/js/popup.js`, `public/assets/css/popup.css`, `scripts/validate-mobile-parity.js` y el nuevo `scripts/validate-navigation-motion.js`. También se generaron el checkpoint, las evidencias de navegador y este informe dentro de `reports/`. Los cambios previos de toolbar, responsive y seguridad del working tree se preservaron.

## 10. Selectores CSS eliminados o neutralizados

Se neutralizó la negrita de `.pp-mobile-menu__links a[aria-current='page']`; el borde activo de pestaña se sustituyó por un pseudo-elemento que no causa reflow; `will-change` dejó de ser permanente en `.tribe-panel` y solo se usa durante transiciones que lo requieren; los estados `.is-closing` de overlays mantienen el escudo visual hasta finalizar. Las reglas responsive compartidas siguen terminando en 1365 px, por lo que no pisan el escritorio aprobado desde 1366 px.

## 11. Listeners JavaScript modificados

`initMobileDock()` conserva un único controlador mediante `AbortController`, destruye el anterior y cancela timers/revisiones. Se unificaron cierre, Escape y retorno de foco en menú, auth/cuenta, carrito, filtros, Quick Add, selector PDP, Archive y Tribe. El backdrop de Tribe tenía dos listeners demostrados; quedó con uno. Los dos sincronizadores visuales de Wishlist ahora tienen ámbitos disjuntos —global fuera de PLP y PLP dentro de sus grids—, sin cambiar altas/bajas. El bloque Tribe legado de `script.js` no se ejecuta en la arquitectura actual y se dejó intacto; la carga directa de `plp-firestore.js` en Camisetas Hombre también se conservó porque el caché de módulos evita doble evaluación y no se demostró una segunda mutación.

## 12. Sistema de variables de movimiento

La capa compartida define `--pp-motion-instant: 120ms`, `--pp-motion-fast: 180ms`, `--pp-motion-base: 260ms`, `--pp-motion-slow: 340ms`, `--pp-mobile-level-duration: 280ms`, `--pp-ease-standard: cubic-bezier(.22,.61,.36,1)`, `--pp-ease-enter: cubic-bezier(.16,1,.3,1)` y `--pp-ease-exit: cubic-bezier(.4,0,1,1)`. El movimiento se limita principalmente a `opacity` y `transform`.

## 13. Transición del menú

El panel entra con opacidad y `translateY(8px)` sin desplazar el documento. El header y la X permanecen estables. La apertura bloquea el fondo, habilita el contenido antes de introducir el foco y la salida conserva el escudo, scroll-lock y estado accesible hasta terminar. X y Escape usan el mismo cierre; después se aplican `hidden`/`inert` y el foco vuelve a Menú. Diez ciclos consecutivos terminaron con ARIA, foco, scroll y geometría correctos.

## 14. Transición entre pestañas

Mujer, Hombre, Colecciones, Prophetia House y Originals comparten salida `opacity 1→0` con `translateX(-6px)` y entrada desde `translateX(6px)`, usando 180 ms. Las secciones ocupan la misma celda Grid para no cambiar la altura. Solo una pestaña mantiene `aria-selected="true"`; el carrusel se desplaza únicamente si la seleccionada queda fuera de vista. Cambiar de pestaña reinicia el segundo nivel sin cerrar el menú.

## 15. Transición Prêt-à-porter

El mismo track aloja raíz y segundo nivel. Abrir mueve el track de `0` a `-100%`; volver lo restaura durante 280 ms, sin rebote ni scroll horizontal. Mujer y Hombre contienen Todo Prêt-à-porter, Camisetas de punto, Sudaderas de punto, Hoodies y Streetwear. Escape vuelve primero al nivel raíz; cerrar o cambiar pestaña limpia transformaciones y ARIA, y reabrir comienza siempre en raíz.

## 16. Transición de drawers

Carrito y filtros conservan overlay y bloqueo durante la salida, cancelan callbacks al reabrir y restauran foco solo al finalizar. Quick Add, zoom/selector PDP, Archive, acceso y cuenta aplican el mismo contrato de revisión. Tribe se endureció sin tocar membresía: foco inicial dentro del diálogo, trap de Tab/Shift+Tab, Escape, backdrop único, salida cancelable y retorno al disparador. En móvil, auth/cuenta ocupan el viewport con safe areas y scroll interior; el dock queda oculto bajo drawers abiertos.

## 17. Transición de sort

Ordenar por usa un popover fijo anclado al disparador, con `opacity` y `translateY(5px)` durante 180 ms. Abrir no cambia las coordenadas de toolbar, grid ni altura del documento. Selección, clic exterior, pérdida de foco y Escape cierran de forma coherente; una reapertura cancela el cierre anterior y Escape devuelve el foco.

## 18. Microinteracciones aplicadas

Los controles móviles responden con `scale(.97)` durante 120 ms, sin afectar layout ni `focus-visible`. En escritorio con `hover:hover` y `pointer:fine`, solo la imagen de card escala a `1.015`; badge, wishlist y Quick Add permanecen fijos. El corazón anima únicamente una mutación real autenticada; en invitado no adopta estado guardado. Badges no tienen animación continua.

## 19. Comportamiento con reduced motion

Las variables pasan a `.01ms`, se eliminan desplazamientos y escalados, `scroll-behavior` vuelve a `auto` y JavaScript finaliza cierres sin esperas largas. La sesión de navegador disponible tenía `prefers-reduced-motion: reduce`; se comprobaron en ejecución foco, ARIA, reaperturas y desbloqueo inmediato. La variante temporal normal quedó cubierta por CSS, revisiones, `transitionend` y validación estática, pero no por una segunda sesión física sin reducción.

## 20. Medidas de rendimiento

Las lecturas geométricas de tabs/sort se agrupan antes de escrituras; las transiciones usan compositor y revisiones cancelables. No se añadió motor, dependencia, intervalo permanente ni observer global. Los observers existentes permanecen acotados a grids/paneles, los listeners tienen guardas de inicialización y se retiró `will-change` permanente de Tribe. No se detectó mutación doble de Wishlist ni doble evaluación funcional de Firestore.

## 21. Comprobaciones de foco y ARIA

Se verificaron `aria-expanded`, `aria-controls`, `aria-hidden`, `aria-selected`, `aria-current`, `inert`, traps, Escape y retorno de foco. Menú, auth, carrito, filtros, Quick Add, PDP, Archive y Tribe introducen el foco dentro; Tab/Shift+Tab permanecen contenidos. La carrera nativa del diálogo de acceso al cerrar con Escape se corrigió esperando de forma acotada a que abandone el top layer. En la prueba final, X y Escape devolvieron foco al águila; Wishlist invitada lo devolvió al corazón.

## 22. Rutas comprobadas

HTTP y render real: `/home`, `/mujer`, `/hombre`, `/camisetas-punto-mujer`, `/sudaderas-punto-mujer`, `/streetwear-mujer`, `/hoodies-mujer`, `/camisetas-punto-hombre`, `/sudaderas-punto-hombre`, `/streetwear-hombre`, `/hoodies`, `/wishlist`, `/my-content`, `/account`, `/about`, `/studio`, `/musica`, `/events`, `/pedidos`, `/reservas`, `/addresses` y `/my-services`. Todas respondieron 200 con el documento local esperado. El validador de navegación revisó 30 rutas y no encontró destinos inventados.

## 23. Resoluciones comprobadas

Matriz real: 320×568, 360×800, 375×667, 390×844, 393×873, 412×915, 430×932, 480×900, 600×960, 768×1024, 820×1180, 912×1368, 1024×1366, 1025×1366, 1040×1200, 1280×800, 1365×768, 1366×768 y 1920×1080. Barridos adicionales: 599, 601, 767, 769, 819, 821, 1023, 1026, 1364 y 1367 px. El validador amplió la cobertura a 23 resoluciones obligatorias y 28 anchuras intermedias.

## 24. Resultados en móvil equivalente a Xiaomi 15

En 393×873 se comprobaron apertura/cierre repetido, cinco pestañas, ambos Prêt-à-porter, House exacto, águila invitada, carrito, filtros, sort, Quick Add y Wishlist invitada. No hubo overflow horizontal, salto de scroll, dock sobre overlay, foco exterior ni bloqueo visible. No se realizó un trace de rendimiento en un Xiaomi 15 físico; la afirmación se limita al viewport equivalente del navegador real disponible.

## 25. Riesgo para escritorio

La geometría aprobada permanece exacta. A 1366×768: toolbar `[0, 584, 1336, 39.59375]` y grid `[32, 623.59375, 1272]`. A 1920×1080: toolbar `[0, 718.71875, 1905, 39.59375]` y grid `[32, 758.3125, 1841]`. En ambos casos el overflow es 0 y los tres controles derechos conservan 52×52 px y sus posiciones aprobadas. Las capturas finales están en `reports/navigation-motion-shots/`. No se modificó la regla visual activa de PLP desde 1366 px.

## 26. Pruebas técnicas superadas

- `node --check` en todos los JavaScript modificados y en el inline de Archive: OK.
- `git diff --check`: OK; solo avisos esperados LF/CRLF.
- `validate-navigation-motion.js`: 131 comprobaciones, 30 rutas, 6 estados.
- `validate-mobile-parity.js`: 47 documentos, 18 rutas, 23 resoluciones y 28 anchuras.
- `validate-toolbar-responsive.js`: 10 rutas, 23 resoluciones, 32 pruebas de sort.
- `validate-commerce.js`: 14 productos, 3 sudaderas, 6 zonas, 0 tarifas activas.
- `validate-checkout-gate.js`: 4 endpoints protegidos y 0 pedidos.
- `validate-security-logging.js`: 28 comprobaciones y 0 pedidos.
- `validate-production.js --allow-legal-placeholder`: 423 archivos públicos y 146 SKUs.
- Consola final del navegador: 0 errores y 0 warnings.
- Auditoría: 0 IDs duplicados, 0 scripts repetidos y 0 firmas de secretos reales.

## 27. Rutas sin destino real

Ninguna dentro de Prophetia House ni de los accesos de cuenta auditados. Los 29 enlaces internos del header resuelven a archivos reales. No se añadió `href="#"`, alias público ni ruta “Próximamente” falsa.

## 28. Pruebas pendientes por falta de sesión autenticada

El navegador disponible solo ofrecía una sesión invitada y no se inventaron credenciales. Quedan pendientes con sesión real: águila autenticada, añadir/eliminar Wishlist contra el estado autenticado, persistencia tras recarga y `/wishlist` con productos guardados. También quedan como comprobación externa una sesión física sin reduced motion y pruebas en Android Chrome/Firefox o Xiaomi 15 real; la matriz equivalente y la reducción de movimiento sí fueron verificadas.

## 29. Confirmación de checkout bloqueado

Checkout continúa bloqueado: cuatro endpoints protegidos, acceso directo cerrado, cero tarifas activas y cero pedidos creados. No se habilitó Stripe live ni `CHECKOUT_ENABLED=true`.

## 30. Confirmación del logger de seguridad intacto

El logger mantiene su middleware único y la guarda contra doble ejecución. Superó 28 comprobaciones locales. El escaneo del diff encontró cero claves privadas y cero firmas de claves Stripe, Google, AWS, GitHub, Slack, SendGrid o JWT; no se leyó ni modificó `.env`.

## 31. Confirmación de que no hubo commit

No se creó ningún commit. La rama existente `codex/render-production` y el working tree con cambios permanecen intactos.

## 32. Confirmación de que no hubo push

No se ejecutó ningún push ni se contactó un remoto para publicar estos cambios.

## 33. Confirmación de que no hubo despliegue

No se desplegó en Render ni en ningún otro entorno. El trabajo termina en el servidor local `127.0.0.1:4242` con checkout bloqueado.
