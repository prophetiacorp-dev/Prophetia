# PROPHETIA PRODUCT CARD TOUCH PARITY

Fecha: 2026-08-15 (Europe/Madrid)
Repositorio: `C:\Users\moise\Desktop\Prophetia_Web INDEX FULL`
Rama existente: `codex/render-production`
HEAD auditado y conservado: `dcf0799`

## 1. Causa exacta de desaparición de Quick Add

Quick Add sí existía en el DOM de móvil y tablet. La regresión funcional estaba en `public/assets/js/quick-add.js`: los listeners delegados `pointerover` y `focusin` llamaban a `openQuickAdd()` antes de completarse el tap, click o Enter. En modo compacto `openQuickAdd()` porta el panel desde la card a `document.body`; ese movimiento cambiaba el objetivo durante la misma secuencia de entrada. La prueba previa devolvía el panel cerrado y la activación por teclado perdía el elemento enfocado al ser trasladado.

Además, la mayor parte del catálogo está agotada. En esas cards el `+` se oculta intencionadamente mediante `.card.is-plp-out-of-stock .pp-quick-add-toggle`; solo las cards con alguna variante vendible deben mostrarlo.

## 2. Causa exacta de desaparición de swatches

La causa era CSS. Dentro de `@media (max-width: 1024px)`, `public/assets/css/mobile-shell.css` incluía `.pp-card-colors` y `.pp-card-cuts` en un selector con `display: none !important`. Los botones y sus datos se generaban correctamente, pero sus rectángulos renderizados eran `0×0` tanto a 390×844 como a 768×1024.

## 3. Clasificación CSS, JavaScript y comparación DOM

La regresión era mixta: CSS ocultaba los swatches y JavaScript interrumpía la activación explícita del bottom-sheet.

| Elemento | Desktop | Tablet | Mobile | Causa previa |
| --- | --- | --- | --- | --- |
| Quick Add | DOM y activación correctos | DOM presente; apertura inestable | DOM presente; apertura inestable | `pointerover`/`focusin` portaban el panel antes de finalizar la activación |
| Swatches | DOM visible | DOM presente, `display:none` | DOM presente, `display:none` | Selector responsive de `mobile-shell.css` |
| Size selector | Panel presente y funcional | Panel presente, pero afectado por apertura prematura | Panel presente, pero afectado por apertura prematura | Mismo conflicto de eventos |
| Variant state | Catálogo canónico | Mismo estado | Mismo estado | No existía una fuente móvil paralela |

Tras la corrección, los cuatro elementos reutilizan el mismo DOM, estado y controlador en los tres modos.

## 4. Archivos responsables y modificados

- `public/assets/css/mobile-shell.css`: regla causante y adaptación táctil compartida.
- `public/assets/js/quick-add.js`: separación entre hover de escritorio y activación explícita del bottom-sheet.
- Diez HTML de PLP: solo se actualizó el identificador de caché de `quick-add.js`.
- `scripts/validate-product-card-parity.js`: nueva validación específica.

`AGENTS.override.md` y los informes antiguos no relacionados se preservaron sin integrarlos en esta fase.

## 5. Media queries responsables

La ocultación procedía de `@media (max-width: 1024px)` en `mobile-shell.css`. Se retiraron exclusivamente `.pp-card-colors` y `.pp-card-cuts` del grupo legacy oculto.

La adaptación nueva utiliza una sola autoridad compartida:

```css
@media (max-width: 1024px), (hover: none), (pointer: coarse)
```

Esto cubre viewports compactos y tablets/touch anchos sin tratar el ancho como único indicador. El hover visual de escritorio permanece limitado a `hover:hover`, `pointer:fine` y anchuras de escritorio.

## 6. Listeners responsables

Se conservaron los listeners delegados existentes. `pointerover` y `focusin` ahora salen inmediatamente cuando `isMobileQuickAdd()` es verdadero. El listener delegado de `click` sigue siendo la única autoridad para swatches, cortes, Quick Add, tallas y cierre.

El archivo mantiene:

- una sola delegación `click`;
- un solo `MutationObserver`;
- guard global `window.__PP_QUICK_ADD__`;
- guard por card `data-quick-add-ready`.

## 7. Fuente canónica de variantes

La cadena sigue siendo única:

`assets/data/catalog.json` → `plp-json.js` → `window.ppPLP.getProduct(productId)` → `quick-add.js/getVariants(product)` → `ppAddToCart`.

No se creó `mobileVariants`, HTML de swatches manual ni una segunda fuente para touch.

## 8. Solución implementada

- Se restauraron los swatches canónicos en la capa responsive.
- Swatches, cortes y `+` reciben áreas táctiles mínimas de 44×44 px.
- El indicador seleccionado conserva borde adicional, no depende solo del color.
- El bottom-sheet solo se abre mediante activación explícita en modo compacto/touch.
- Hover y focus automático permanecen en escritorio fino.
- El cache-busting de `quick-add.js` se actualizó en las diez PLP.

## 9. Comportamiento desktop

PASS. A 1366×768 se verificó `hover:hover` y `pointer:fine`: el `+` abre el panel inline por hover, `aria-expanded=true`, sin portal móvil y sin fijarlo. A 1920×1080 permanecen swatches de 16×16 y Quick Add de 30×30, por lo que no se convirtió el diseño desktop en controles táctiles persistentes sobredimensionados.

## 10. Comportamiento tablet

PASS. A 768×1024 los swatches son visibles y 44×44; Quick Add abre con un click/tap en un bottom-sheet de 753 px de ancho, muestra las tallas canónicas y mantiene cero overflow. Las PLP conservan dos columnas hasta 1024 px.

## 11. Comportamiento móvil

PASS. A 390×844 los swatches y el `+` son 44×44, la grid mantiene dos columnas y no hay desplazamiento horizontal. La activación abre directamente el selector; no requiere un primer tap para revelar el control.

## 12. Comportamiento híbrido

PASS arquitectónico. `MOBILE_QUICK_ADD_QUERY` combina `hover:none`, `pointer:coarse` y `max-width:820px`. Un viewport compacto con ratón usa activación explícita del bottom-sheet; un escritorio `hover:hover + pointer:fine` conserva hover; un tablet ancho coarse entra por capacidad de entrada.

## 13. Swatches

PASS. Al seleccionar Blanco en Atlas:

- `aria-pressed` pasó de Beige a Blanco;
- la URL permaneció en `/mujer`;
- la imagen cambió a `atlasfrontoversizewhite.png`;
- las tallas se recalcularon para color `white`;
- los SKU pasaron a `atlas-seal_oversize_white_*`;
- no se activó Wishlist.

## 14. Quick Add

PASS. El control es un `<button type="button">`, anuncia `aria-expanded`, abre mediante click/tap en compacto y por hover/focus en escritorio. Las cards totalmente agotadas no permiten Quick Add.

## 15. Selector de talla

PASS. En Atlas Blanco se mostraron S, M, L y XL; M y L estaban habilitadas, S y XL agotadas/deshabilitadas. No se eligió ninguna talla automáticamente. Escape cerró el panel, quitó el bloqueo del body y devolvió el foco al `+`.

## 16. Wishlist

PASS. Tras tocar swatch, Quick Add y talla, el corazón mantuvo `aria-pressed=false` y `Guardar en favoritos`. No hubo navegación, click accidental ni listener adicional.

## 17. Agotados

PASS. El estado completo se deriva de variantes con `stock > 0`. De 146 combinaciones canónicas verificadas, 4 son vendibles y 142 están agotadas. Las tallas agotadas quedan deshabilitadas y las cards sin ninguna variante vendible no muestran el `+`.

## 18. Carrito

PASS. En un origen local aislado se ejecutó:

`Atlas → Oversize → Blanco → M → atlas-seal_oversize_white_M → qty 1`.

La línea renderizada mostró el mismo `productId`, corte, versión, color, talla, SKU y precio canónico. El selector se cerró y apareció feedback `Blanco · M añadido a la cesta`. No se creó pedido.

## 19. Accesibilidad

PASS. Swatches y Quick Add son botones reales, poseen nombres accesibles, `aria-pressed`/`aria-expanded`, foco visible y objetivos táctiles de 44 px. El panel usa rol de diálogo en modo portal, atrapa Tab, acepta Escape y restaura foco.

## 20. Reduced motion

PASS. Se reutilizó el sistema existente. `prefers-reduced-motion: reduce` elimina transiciones, fly animation y movimientos del portal sin deshabilitar controles ni selección.

## 21. Responsive

PASS. Las 23 resoluciones obligatorias tuvieron swatches visibles, dos columnas hasta 1024 y overflow horizontal igual a cero. El cambio 1024→1025 reduce el objetivo visual de escritorio de forma controlada sin ocultar acciones.

## 22. Android / Xiaomi

PASS equivalente. Se validaron 360×800, 384×854, 390×844, 393×873, 412×915 y 430×932 con activación real del flujo compacto, scroll, swatches, Quick Add, talla, carrito y dock. No estaba disponible un Xiaomi físico ni emulación de UA/puntero coarse; queda recomendada una comprobación final de hardware, sin bloqueo técnico conocido.

## 23. Tablet / iPad

PASS equivalente. Se validaron 768×1024, 820×1180, 912×1368, 960×1280 y 1024×1366, además de orientación horizontal equivalente por las anchuras intermedias. El contrato coarse está cubierto por CSS y `matchMedia`; no se dispuso de iPad físico.

## 24. Rutas validadas

PASS en navegador real y HTTP 200:

- `/mujer`
- `/hombre`
- `/camisetas-punto-mujer`
- `/sudaderas-punto-mujer`
- `/streetwear-mujer`
- `/hoodies-mujer`
- `/camisetas-punto-hombre`
- `/sudaderas-punto-hombre`
- `/streetwear-hombre`
- `/hoodies`

En las diez rutas, el número de cards mejoradas coincidió con el número renderizado y hubo un solo grupo/toggle por card.

## 25. Resoluciones validadas

PASS:

`320×568`, `344×700`, `360×800`, `375×667`, `384×854`, `390×844`, `393×873`, `412×915`, `430×932`, `480×900`, `600×960`, `679×900`, `768×1024`, `820×1180`, `912×1368`, `960×1280`, `1024×1366`, `1025×1366`, `1040×1200`, `1280×800`, `1365×768`, `1366×768`, `1920×1080`.

Barrido adicional: 330, 352, 368, 400, 448, 520, 640, 700, 740, 800, 860, 900, 940, 980, 1000, 1016, 1032, 1100, 1200, 1300, 1400, 1600 y 1800 px.

## 26. Pruebas ejecutadas

PASS:

- `node --check public\assets\js\quick-add.js`
- `node --check scripts\validate-product-card-parity.js`
- `node scripts\validate-product-card-parity.js`
- `node scripts\validate-mobile-parity.js`
- `node scripts\validate-commerce.js`
- `node scripts\validate-checkout-gate.js`
- `node scripts\validate-security-logging.js`
- `node --experimental-vm-modules scripts\validate-production.js --allow-legal-placeholder`
- `git diff --check`

## 27. Errores de consola

PASS. La captura de consola del navegador para las PLP no devolvió errores ni advertencias. Tampoco aparecieron excepciones al seleccionar color, abrir/cerrar panel, ordenar, filtrar o añadir la variante.

## 28. Network

PASS local. Las diez rutas, `mobile-shell.css`, `quick-add.js` y `catalog.json` respondieron HTTP 200 desde el servidor real en `127.0.0.1:4242`. No se efectuaron llamadas reales de pago, pedido, correo ni despliegue.

## 29. Regresiones

No se detectaron regresiones en toolbar, filtros, sort, cards, badges, Wishlist, dock, temas claro/oscuro, menú ni drawers. El rerender por ordenación mantuvo 13 cards, 13 grupos de opciones y 13 toggles; filtrar en stock produjo una card y al retirar el filtro restauró las 13 sin duplicaciones.

## 30. Checkout bloqueado

Confirmado. `CHECKOUT_ENABLED=false`; cuatro endpoints protegidos rechazaron acceso y se crearon cero pedidos. Restaurar `PLP → Quick Add → Cart` no habilitó `Cart → Checkout`.

## 31. Logger intacto

Confirmado. `validate-security-logging.js` superó 28 comprobaciones locales. No se debilitó ni modificó el logger de seguridad.

## 32. `git diff --stat`

Alcance funcional antes de añadir este informe:

- 12 archivos tracked: 103 inserciones y 14 eliminaciones.
- 1 validador nuevo: 197 líneas.
- Total funcional: 13 archivos.

Los cambios HTML son exclusivamente el nuevo identificador de caché de `quick-add.js` en las diez PLP.

## 33. Confirmación de no commit

Confirmado. No se hizo commit. HEAD continúa en `dcf0799`.

## 34. Confirmación de no push

Confirmado. No se hizo push.

## 35. Confirmación de no deploy y resultado final

Confirmado. No se desplegó en Render ni en ningún otro entorno.

```text
PROPHETIA PRODUCT CARD TOUCH PARITY

Desktop Quick Add: PASS
Tablet Quick Add: PASS
Mobile Quick Add: PASS

Desktop Color Selector: PASS
Tablet Color Selector: PASS
Mobile Color Selector: PASS

Variant Sync: PASS
Size Selection: PASS
Wishlist Isolation: PASS
Cart Variant Integrity: PASS
Responsive: PASS
Android Touch: PASS
Tablet Touch: PASS
Accessibility: PASS
Desktop Regression: PASS

Checkout enabled: NO
Real orders created: NO
Commit: NO
Push: NO
Deploy: NO
```
