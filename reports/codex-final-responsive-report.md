# Informe final de reapertura responsive de Prophetia

## 1. Por qué el informe anterior era visualmente incorrecto

El informe anterior usó ausencia de `overflow`, errores de consola y fallos de validadores como sustituto de una comprobación geométrica completa. Las capturas aportadas demostraban tres errores que ese criterio no detectaba: el hero de 1040 px entraba prematuramente en la composición legacy de escritorio, la toolbar se partía a 320 px y paneles activos de un drawer cerrado seguían siendo visibles a 768/820 px. Además, el documento afirmaba una cobertura ya cerrada aunque parte de sus pruebas correspondía a estados anteriores del render. En esta reapertura las capturas han sido la referencia visual, cada tamaño crítico se cargó en una pestaña aislada y las mediciones se tomaron después de fuentes, partials y render dinámico.

## 2. Selector que causaba el salto en 1024/1040

La causa no era un único valor de ancho, sino la frontera de cascada entre el bloque compartido `@media (max-width: 1024px)` de `mobile-shell.css` y los selectores legacy de cada PLP que volvían a ganar desde 1025 px sobre `.pp-hero.hero--two-cols`, `.pp-hero__media .floating-logo`, `.pp-breadcrumb--hero` y `.pp-hero__side`. En esa frontera el hero pasaba de flujo vertical a logo absoluto de hasta 920 px, laterales con `transform` y geometrías distintas por ruta. Por eso 1040 px se comportaba como un escritorio comprimido y no como un ancho intermedio.

## 3. Breakpoint y estrategia intermedia aplicada

Se añadió una única capa compartida en `plp-hero-spacing.css` para `1025px–1365px`, aplicada a las ocho PLP canónicas. El hero usa Grid con `minmax(0, 1fr)` para el wordmark y una pista derecha calculada como `max(--pp-plp-intermediate-side, --pp-plp-intermediate-breadcrumb)`. Alto, paddings, hueco, ancho lateral y ancho de breadcrumbs evolucionan con `clamp()`; logo, breadcrumb y lateral vuelven al flujo estático sin coordenadas por página. El rango termina en 1365 px, por lo que 1366 y 1920 conservan literalmente la cascada aprobada de escritorio.

## 4. Reglas legacy eliminadas o neutralizadas

En el rango intermedio se neutralizaron `position:absolute`, `translateY`, márgenes, alturas y anchos específicos de las ocho hojas legacy mediante la capa compartida acotada. El breadcrumb dejó de desbordar su pista: la columna derecha reserva como mínimo su ancho y el elemento usa `max-width:100%`. Las proporciones legacy de media/card en `overrides.css` quedaron limitadas a `min-width:1025px`, de modo que la fuente compartida móvil puede gobernar hasta 1024 px. Los paneles `.is-active` del drawer ya no son visibles si su raíz no tiene `.is-open`. También se retiraron inclusiones duplicadas de `plp-json.js` y `plp-carousel.js` en los HTML afectados. Los `!important` añadidos están acotados a la media intermedia o al bloque canónico móvil y son necesarios para vencer selectores route-specific preexistentes sin tocar escritorio.

## 5. Archivos modificados

Durante esta reapertura se modificaron:

- CSS: `public/assets/css/plp-hero-spacing.css`, `mobile-shell.css`, `filters-drawer.css`, `punto-filters-drawer.css` y `overrides.css`.
- JavaScript: `public/assets/js/filters-drawer.js`, `script.js`, `header-init.js` y `quick-add.js`.
- HTML: `public/camisetas-punto-mujer.html`, `public/hoodies-mujer.html` y `public/sudaderas-punto-mujer.html`.
- Control: `CODEX_FINAL_TASKS.md` y este informe.

Los demás cambios ya presentes en el working tree se preservaron. No se modificó `.env`, no se instalaron dependencias y no se alteraron precios, stock, Stripe, tarifas, pedidos ni autenticación.

## 6. Geometría final del floating logo

En `/streetwear-mujer`, ruta usada para el barrido de frontera, el rect final `[x, y, ancho, alto]` es `[28, 83, 683, 91.3]` a 1024, `[28, 83.1, 683.3, 91.3]` a 1025 y `[27.2, 83.5, 698.1, 93.3]` a 1040. Desde 1025 crece de forma fluida hasta el máximo legacy de 920 px; a 1365 mide 920 px. No intersecta breadcrumbs ni lateral. En móvil/tablet queda primero en el orden vertical y usa `object-fit:contain`; en páginas oscuras cambia al recurso blanco existente.

## 7. Geometría final de breadcrumbs

A 1024 el breadcrumb está en flujo vertical, `[28, 186.3, 953]`. A 1025 entra en su pista derecha propia, `[742, 83.1, 240]`; a 1040 queda en `[756.5, 83.5, 240]`. Tras la microfase de frontera, en `/streetwear-mujer` alcanza `[1102.6, 105, 189.4]` a 1365 y enlaza con `[1103.6, 105, 189.4]` a 1366. La pista Grid reserva el mayor ancho entre breadcrumb y lateral, por lo que ya no invade el wordmark ni desborda su columna. En móvil/tablet permanece después del logo, con scroll interno solo si el texto intrínseco lo necesitara y sin alterar el documento.

## 8. Geometría final de `pp-hero__side`

A 1024 el lateral continúa en flujo vertical bajo el breadcrumb, `[28, 222.3, 953]`. A 1025 ocupa la pista derecha, `[742, 128.6, 240]`; a 1040 queda en `[759.1, 129, 237.4]`. Desde 1180 la capa intermedia reutiliza el dial editorial existente de Streetwear Mujer para interpolar su separación; a 1365 queda en `[1176.5, 312.9, 133.5]` y a 1366 en `[1177.5, 312.9, 133.5]`. Dentro de la media intermedia conserva `position:static`, `transform:none`, alineación inicial y ancho fluido, sin márgenes negativos ni desplazamiento JavaScript.

## 9. Geometría final de `pp-hero__list`

La lista ocupa el 100 % del lateral, se alinea a la izquierda y conserva una columna vertical limpia. En 1024 sigue el orden logo → breadcrumb → título → lista; desde 1025 comparte la pista derecha bajo el título. Se neutralizaron transformaciones, fondos, bordes y cambios geométricos en `hover/focus`; las páginas oscuras no generan rectángulos negros detrás de los enlaces. La matriz final confirmó que título y lista permanecen dentro del rect del lateral en las ocho rutas.

## 10. Solución de `pp-filters` a 320 px

La toolbar móvil usa una única fuente de verdad: Grid `minmax(0, 1fr) max-content`, dos grupos Flex sin wrap, huecos fluidos, controles de 44 px de alto, tipografía `clamp(10px, 2.6vw, 14px)` y checkbox fluido de 17–23 px. A 320 px “Filtros / Ordenar por” permanece a la izquierda y “En stock / Vista” a la derecha, en la misma línea y dentro del rect de la toolbar. En la interacción final de `/streetwear-mujer`, la toolbar comenzó en `y=275.3125` y el grid en `y=334.3125`; abrir el sort no cambió esas coordenadas de documento.

## 11. Causa de los colores visibles fuera del drawer

Las reglas de los paneles daban visibilidad a `.men-filters-panel.is-active` y `.women-filters-panel.is-active` sin exigir que el drawer padre estuviera abierto. A ello se sumaba una regla de ancho de `punto-filters-drawer.css` con mayor especificidad que la geometría compartida. El root podía estar desplazado/cerrado mientras swatches, tallas y footer seguían participando en pintura o interacción a 768/820 px.

## 12. Corrección del estado cerrado

El root cerrado combina `aria-hidden="true"`, `inert`, `opacity:0`, `visibility:hidden` y `pointer-events:none`; los paneles solo se exponen bajo un ancestro `.is-open`. La especificidad del selector móvil se igualó con la de los drawers de punto para que el panel abierto cubra el viewport hasta 1024 px. Cerrado se midieron cero descendientes visibles y cero enfocables. Abierto, el drawer claro a 768 ocupa `[0, 0, 753, 1024]`; el oscuro a 1040 ocupa `[388, 0, 637, 1200]`, ambos con un único scroll interior y footer accesible. X, overlay y Escape cierran; el foco queda atrapado mientras está abierto y vuelve al disparador al cerrar.

## 13. Resultado de sort

En `/streetwear-mujer` a 320, el popover final quedó fijo en `[28, 12, 280, 340.8]`, dentro del viewport y sin reflow. La ordenación real por precio ascendente produjo `[39.99, 64, 68, 68, 88]`; selección, click exterior y Escape cerraron el menú y devolvieron el foco a `womenSortButton`. Los modos descendente y alfabético ya validados usan el mismo comparador, que no cambió en esta reapertura. El único cambio posterior fue repetir el cálculo de posición en el siguiente frame para evitar coordenadas transitorias.

## 14. Resultado de cards y wishlist

Las ocho PLP presentan dos columnas hasta 1024, tres a 1025/1040 y cuatro cuando el ancho lo permite. Media y Quick Add usan la proporción compartida con `object-fit:contain`; badges no se recortan, el texto y precio son visibles y el corazón conserva 44×44 px dentro de la esquina inferior derecha. Se corrigió además la elección de media en `quick-add.js`: la ruta femenina usa su cover femenino o `unisex`, nunca el género opuesto. El invitado recibe primero el aviso exacto accesible y después el modal existente; al cerrarlo se restaura el foco y `aria-pressed` sigue en `false`. En `/wishlist`, las tabs móviles son dos columnas reales y a 320/390 sus `scrollWidth` coinciden con `clientWidth`, sin solapamiento; escritorio no cambió. La validación autenticada se mantiene pendiente.

## 15. Resultado en páginas claras

`/camisetas-punto-mujer`, `/sudaderas-punto-mujer`, `/camisetas-punto-hombre` y `/sudaderas-punto-hombre` pasaron las 18 resoluciones obligatorias. Logo, breadcrumb, título, lista, toolbar, cards, badges, precio, drawer y foco mantienen contraste sobre fondo claro. A 768 y 820 no aparece ningún color, talla, panel o footer fuera del drawer cerrado. El drawer claro abierto a 768 conserva X, cuerpo desplazable, CTA y cierre por Escape.

## 16. Resultado en páginas oscuras

`/streetwear-mujer`, `/hoodies-mujer`, `/streetwear-hombre` y `/hoodies` pasaron la misma matriz. Logo blanco, breadcrumbs, lista, “En stock”, “Vista”, sort, bordes, badges y textos de card son legibles; la toolbar no adquiere fondo beige y la lista no dibuja rectángulos por enlace. `/hoodies-mujer` renderiza exactamente su único producto sin filtros y cero al activar “En stock”, coherente con su stock real; el cover mostrado es el femenino. No se creó el alias inexistente `/hoodies-hombre`.

## 17. Resultados exactos a 1024, 1025 y 1040 px

Mediciones finales de `/streetwear-mujer` después del render:

| viewport | floating logo `[x,y,w,h]` | breadcrumb `[x,y,w]` | side `[x,y,w]` | `pp-filters` y | columnas |
|---|---:|---:|---:|---:|---:|
| 1024×1200 | `[28,83,683,91.3]` | `[28,186.3,953]` | `[28,222.3,953]` | `403.7` | 2 |
| 1025×1200 | `[28,83.1,683.3,91.3]` | `[742,83.1,240]` | `[742,128.6,240]` | `404.0` | 3 |
| 1040×1200 | `[27.2,83.5,698.1,93.3]` | `[756.5,83.5,240]` | `[759.1,129,237.4]` | `412.0` | 3 |

El cambio de topología en 1025 coloca breadcrumb/lateral en una pista propia, pero el logo varía solo 0.3 px de ancho y la toolbar 0.3 px en vertical respecto de 1024; no existe el precipicio de altura que mostraba la captura original. También se midieron y capturaron 1000, 1020, 1023, 1030, 1039, 1041, 1060, 1100, 1180, 1279, 1280, 1365 y 1366.

## 18. Comparación antes/después de 1366 y 1920

La comparación se fijó sobre `/camisetas-punto-mujer`; los valores antes y después son idénticos:

| viewport | elemento | antes | después |
|---|---|---:|---:|
| 1366×768 | logo | `[10,100,920,123]` | `[10,100,920,123]` |
| 1366×768 | breadcrumb | `[1047.2,82,248.8]` | `[1047.2,82,248.8]` |
| 1366×768 | side | `[1117.5,136,178.5]` | `[1117.5,136,178.5]` |
| 1366×768 | filtros / grid | `y=584 / [32,623.6,1272], 4 col.` | `y=584 / [32,623.6,1272], 4 col.` |
| 1920×1080 | logo | `[10,100,920,123]` | `[10,100,920,123]` |
| 1920×1080 | breadcrumb | `[1616.2,82,248.8]` | `[1616.2,82,248.8]` |
| 1920×1080 | side | `[1633.7,136,231.3]` | `[1633.7,136,231.3]` |
| 1920×1080 | filtros / grid | `y=718.7 / [32,758.3,1841], 4 col.` | `y=718.7 / [32,758.3,1841], 4 col.` |

La nueva media no alcanza 1366; header, footer, carrito, cuenta, hover y geometría legacy de escritorio quedan fuera de su cascada.

## 19. Capturas generadas

Se conservaron 228 PNG en `reports/responsive-reopen-shots/`: 161 capturas `qa-*` —144 de la matriz final de ocho rutas por 18 resoluciones y 17 reintentos aislados—, 16 capturas `boundary-streetwear-mujer-*`, 19 capturas finales de interacciones/auxiliares, 13 capturas “before” y 19 evidencias adicionales. Entre las evidencias principales están:

- `boundary-streetwear-mujer-1024x1200.png`, `-1025x1200.png`, `-1040x1200.png`, `-1365x1200.png` y `-1366x1200.png`.
- `final-drawer-sudaderas-mujer-768x1024-open.png` y `final-drawer-streetwear-mujer-1040x1200-open.png`.
- `final-sort-streetwear-mujer-320x568-price-asc.png` y `final-wishlist-guest-streetwear-mujer-390x844-notice.png`.
- `final-wishlist-tabs-fixed-320x568.png`, `-390x844.png`, `-768x1024.png` y `-1366x768.png`.
- `final-mobile-menu-women-sublevel-390x844.png` y las capturas finales de Wishlist/Archive a 390, 768 y 1366.

## 20. Validaciones técnicas

Resultados finales:

- Sintaxis: 19 JavaScript modificados; 17 scripts clásicos pasaron `node --check` y los dos ESM pasaron `node --input-type=module --check`.
- `git diff --check`: correcto; solo avisos informativos LF/CRLF.
- `npm run check:mobile`: 46 documentos, versión `20260724-mobile-parity1`.
- `npm run check:mobile-parity`: 47 documentos, 26 rutas, 15 resoluciones obligatorias y 15 anchuras intermedias.
- `validate-commerce.js`: 14 productos, 3 sudaderas, 6 zonas preparadas y 0 tarifas activas.
- `validate-checkout-gate.js`: cuatro endpoints protegidos, acceso directo cerrado y cero pedidos creados.
- `npm run check:technical`: 423 archivos públicos y 146 SKU revisados con el placeholder legal permitido.
- Navegador real: 144 combinaciones finales de PLP sin overflow horizontal, IDs duplicados, imágenes rotas, swatches visibles con drawer cerrado ni errores de consola; drawers, sort, Wishlist invitada y menú móvil tuvieron pruebas de foco/Escape.
- Auditoría estática de las ocho PLP: un único renderer, sort, carrusel, drawer, Quick Add y controlador de reservas activos; cero `src` e IDs HTML duplicados.

No existe en el repositorio una suite automatizada dedicada a Wishlist, PLP visuales o drawers. La cobertura disponible se ejecutó mediante validadores y navegador real. `CHECKOUT_ENABLED` permanece desactivado, sin tarifas reales activas.

## 21. Fallos todavía pendientes

Permanecen abiertas seis comprobaciones que requieren una sesión autenticada real: animación/accesibilidad del corazón registrado, usuario registrado, añadir, eliminar, persistencia tras recarga y Wishlist con productos. En la microfase final no había una sesión autenticada reutilizable: el único tab previo estaba desconectado y las sesiones aisladas nuevas no contenían la clase de autenticación. No se usaron credenciales inventadas ni mocks para marcarlas como superadas.

La discontinuidad de `/streetwear-mujer` entre 1365 y 1366 quedó corregida en la capa intermedia compartida: el lateral pasa de `y=312.88` a `y=312.88`, la lista de `y=346.88` a `y=346.88`, los filtros solo `0.06px` y el grid `0.06px`. Las siete rutas restantes conservaron exactamente su geometría anterior a 1365, y 1366×768 y 1920×1080 conservaron todos sus rectángulos con delta cero. El detalle completo está en `reports/codex-final-microphase-1365-1366.md`. La animación del menú con movimiento normal y el hover físico del carrusel siguen siendo candidatos a una observación manual en dispositivo; el camino `prefers-reduced-motion`, la jerarquía, ARIA, foco, Escape y el controlador único sí fueron verificados.

La auditoría estática también deja dos residuos de mantenimiento: `camisetas-punto-hombre.html` carga directamente `plp-firestore.js` aunque su grid usa JSON —el módulo solo exporta y no inicia otro render—, y `script.js` conserva un bloque Tribe potencialmente redundante con `popup.js`. En la carga canónica no hay doble listener porque el partial todavía no existe cuando pasa `script.js`, pero el contrato depende de ese orden de inyección. Wishlist conserva dos recorridos de sincronización visual tras eventos de autenticación; son idempotentes y no duplican la mutación de añadir/eliminar.

No se hizo commit, push, despliegue ni cambio de rama. El checkout continúa bloqueado.

## 22. Adenda — visor de producto móvil/tablet y limpieza de proveedor (2026-08-13)

### Referencias y causa raíz

Se compararon las capturas aportadas de Loewe, Zara y Lacoste con los visores reales de Lacoste y Bottega Veneta a 390×844 y Lacoste a 768×1024. El patrón común es un visor a pantalla completa con imagen protagonista, salida persistente en la parte superior y navegación secundaria que no compite con la prenda.

En Prophetia el botón `#pdpZoomClose` ya existía y su JavaScript era correcto. El fallo procedía de la cascada responsive de `pdp.css`: `.lb-figure` declaraba `height: 100vh` o `100dvh` y añadía entre 172 y 174 px de padding con el modelo de caja `content-box`. El flex centraba ese bloque sobredimensionado y desplazaba la X a `y=-73 px` en 390×844. No se duplicó el lightbox ni su controlador.

### Archivos y solución

- `public/assets/css/pdp.css`: el visor hasta 860 px usa un contenedor `border-box` de `100dvh`, respeta safe areas y mantiene X, flechas y miniaturas dentro del viewport. La superficie pasa a un fondo neutro Prophetia, los controles alcanzan un área táctil mínima de 44×44 px y la tira de miniaturas conserva desplazamiento táctil sin mostrar scrollbar. Se modificaron y consolidaron los selectores existentes de `#pdpZoom`; no se añadió otro componente ni se eliminó ningún selector.
- `public/assets/data/catalog.json`: la descripción pública `Stanley/Stella Creator 2.0` se sustituyó en la fuente por `Corte clásico de líneas limpias`. La auditoría posterior encontró cero apariciones de `Stanley` o `Stella` en HTML, CSS, JavaScript y datos públicos.
- JavaScript modificado: ninguno; cierre por X, Escape, backdrop, navegación y restauración de foco ya estaban correctamente implementados.

### Validación real

La X quedó visible y dentro de límites en 320×568, 360×800, 390×844, 430×932, 600×960, 768×1024, 820×1180, 860×1180, 861×1180, 912×1368, 1024×1366 y 1366×768. El barrido 860/861 confirmó que ambos lados del breakpoint conservan la salida. No hubo overflow horizontal entre 320 y 1024.

Se probaron `/producto?id=atlas-seal`, `/producto?id=calyra-ego` con 10 imágenes y `/producto?id=atlas-hoodie` con 5 imágenes. En todas se abrió el visor desde la primera imagen y la X permaneció accesible; la galería larga desplazó sus miniaturas horizontalmente sin scrollbar visible. Siguiente cambió la imagen y activó la miniatura `1`; X y Escape cerraron el diálogo, eliminaron el bloqueo modal y devolvieron el foco a la imagen exacta que lo abrió. La consola local registró cero errores.

Validaciones superadas: `node --check public/assets/js/product-page.js`, parseo de `catalog.json`, `git diff --check`, `validate-mobile-parity.js` (47 documentos, 18 rutas, 23 resoluciones obligatorias y 28 anchuras intermedias), `validate-commerce.js` (14 productos, 6 zonas y 0 tarifas activas) y `npm.cmd run check:technical` (425 archivos públicos y 146 SKU).

La cascada visual nueva termina en 860 px, por lo que el visor de escritorio mantiene sus reglas previas; a 1366×768 la X siguió visible y dentro del viewport. Riesgo residual: las safe areas se validaron mediante las variables del navegador responsive, no en un dispositivo iOS físico con notch. Las comprobaciones autenticadas de Wishlist registradas en la sección anterior continúan pendientes y no forman parte de esta corrección.

El checkout continúa bloqueado, con cero tarifas activas. Tras la autorización expresa del 13/08/2026, esta adenda y sus dos cambios de producto se prepararon para commit y push en la rama de producción existente; no se hizo despliegue manual en Render ni cambio de rama.

## 23. Adenda — portadas de Prophetia House y Studio (2026-08-13)

La causa de que las nuevas imágenes no aparecieran en Render era que `portadahouse1.png`, `portadahouse2.png` y `studio1.png` existían solo en el working tree y todavía no formaban parte de Git. `about.html` ya contenía las dos rutas nuevas y se preservó ese cambio del usuario.

Se actualizaron los atributos intrínsecos y los textos alternativos de las dos figuras de `/about`: Silent usa `portadahouse1.png` (1122×1402) y Street usa `portadahouse2.png` (1122×1402). En `/studio`, el bloque `#destilar` usa `studio1.png` (1448×1086) y el pie editorial `Estudio de síntesis / Dirección Prophetia`. No fue necesario modificar CSS ni JavaScript.

Se validaron `/about` y `/studio#destilar` en navegador real a 390×844, 820×1180 y 1366×768. Las imágenes cargaron con sus dimensiones naturales, `object-fit: cover`, sin recursos rotos ni overflow horizontal. El checkout continuó bloqueado: cuatro endpoints protegidos, cero pedidos y cero tarifas activas. No se hizo despliegue manual en Render ni cambio de rama.
