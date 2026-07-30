# PROPHETIA — TAREAS FINALES PARA CODEX

## ESTADO DE LA FASE

Este documento continúa una corrección responsive anterior que quedó incompleta al agotarse el uso de Codex.

No empieces de cero.

Debes:

- preservar los cambios válidos existentes;
- determinar qué partes de la fase anterior quedaron realmente aplicadas;
- terminar los puntos pendientes;
- corregir las regresiones visibles;
- validar el resultado completo.

No hagas commit, push ni despliegue.

---

# 1. CHECKPOINT Y AUDITORÍA INICIAL

- [x] Ejecutar `git status --short`.
- [x] Guardar un checkpoint del diff actual en `reports/`.
- [x] Revisar los últimos cambios en:
  - `mobile-shell.css`
  - hojas PLP específicas;
  - `filters-drawer.js`;
  - `header-init.js`;
  - `script.js`;
  - wishlist;
  - archive;
  - popup/account panel.
- [x] Identificar reglas responsive duplicadas o contradictorias.
- [x] Confirmar las rutas canónicas existentes sin inventar nuevas URLs.
- [x] Confirmar qué servidor local y qué directorio están sirviendo realmente la web.

No reviertas cambios en bloque.

---

# 2. ESTRUCTURA RESPONSIVE CANÓNICA DE LAS PLP

Todas las páginas PLP de Mujer y Hombre deben mantener esta secuencia visual:

1. Floating logo PROPHETIA correspondiente al tema.
2. Breadcrumbs.
3. Título y `pp-hero__list`.
4. Barra `pp-filters`.
5. Grid de productos.

Aplicar una implementación compartida y fluida hasta 1024 px.

Rutas que deben revisarse:

- [x] `/mujer`
- [x] `/hombre`
- [x] Camisetas de punto Mujer
- [x] Sudaderas de punto Mujer
- [x] Streetwear Mujer
- [x] Hoodies Mujer
- [x] Camisetas de punto Hombre
- [x] Sudaderas de punto Hombre
- [x] Streetwear Hombre
- [x] Ruta canónica real de Hoodies Hombre

Requisitos:

- [x] `pp-hero__list` alineada a la izquierda en móvil y tablet.
- [x] Lista vertical, sin elementos forzados horizontalmente.
- [x] Sin rectángulos negros alrededor de las palabras.
- [x] Sin líneas dobles.
- [x] Sin desplazamientos al hacer hover, focus o seleccionar la página actual.
- [x] Sin posiciones absolutas que rompan otras dimensiones.
- [x] Dos columnas de productos hasta 1024 px.
- [x] Sin saltos accidentales a tres columnas en 912 o 960 px.
- [x] Sin overflow horizontal.

Mantener cuatro columnas de escritorio donde ya corresponda.

---

# 3. CARDS DE PRODUCTO

Aplicar la solución compartida a todos los grids.

## Card badge

- [x] Texto completo.
- [x] Centrado horizontal y verticalmente.
- [x] Sin recorte.
- [x] Una sola línea cuando exista espacio.
- [x] Tamaño tipográfico fluido.
- [x] No solaparse con wishlist, Quick Add ni estado de stock.

## Wishlist

- [x] Colocar el corazón en la esquina inferior derecha de la zona visual de la imagen.
- [x] Mantenerlo dentro de la card.
- [x] Separación visual aproximada de 8 px respecto a los bordes.
- [x] Área táctil mínima de 44×44 px.
- [x] No cubrir el badge.
- [x] No cubrir la prenda.
- [x] No cambiar la altura de la card.
- [ ] Mantener estado animado y accesible para usuarios registrados.

## Contenido

- [x] Nombre, descripción, precio, guardado y stock legibles en tema claro y oscuro.
- [x] No ocultar precios por falta de contraste.
- [x] Evitar alturas fijas que corten nombres largos.
- [x] Mantener alineación coherente entre ambas columnas.

---

# 4. WISHLIST PARA USUARIO NO REGISTRADO

Comportamiento esperado al pulsar el corazón estando deslogueado:

1. No aparentar que el producto se ha guardado.
2. Mostrar primero un aviso comprensible:
   `Inicia sesión o crea una cuenta para guardar productos en tu lista de deseos.`
3. El aviso debe ser accesible mediante `role="status"` o `aria-live`.
4. Después del aviso puede abrirse el panel existente de acceso/registro.
5. No abrir el panel sin explicación.
6. No crear otro sistema de autenticación.
7. No duplicar listeners.
8. Evitar dobles aperturas.
9. Restaurar el foco correctamente al cerrar.

- [x] Validar usuario deslogueado.
- [ ] Validar usuario registrado.
- [ ] Validar añadir.
- [ ] Validar eliminar.
- [ ] Validar persistencia tras recarga.

---

# 5. PÁGINA WISHLIST

La página actual está desajustada en diferentes anchuras.

- [x] Auditar su HTML, grid, fondos y breakpoints.
- [x] Mantener la identidad editorial PROPHETIA.
- [x] Corregir logo cortado o desplazado.
- [x] Corregir tabs `Mi selección` y `Puede que te guste`.
- [x] Evitar que el contador flotante tape contenido.
- [x] Grid responsive consistente.
- [x] Card completa dentro del viewport.
- [x] Dock móvil sin cubrir el contenido final.
- [x] Estado vacío correcto.
- [ ] Estado con productos correcto.
- [x] Recomendaciones correctas.
- [x] Sin overflow horizontal.
- [x] No modificar la lógica de datos salvo que exista un fallo demostrado.

---

# 6. ARCHIVE

Localiza la página y ruta canónicas de Archive. No inventes un alias.

- [x] Auditar hero, logo, breadcrumbs, contenido editorial y grid.
- [x] Corregir responsive completo.
- [x] Evitar elementos cortados o fuera del viewport.
- [x] Mantener relación de aspecto de imágenes.
- [x] Mantener texto legible.
- [x] Adaptar columnas fluidamente.
- [x] Evitar alturas rígidas.
- [x] Evitar espacios vacíos artificiales.
- [x] Mantener escritorio intacto.
- [x] Validar móvil, tablet y escritorio.

---

# 7. ORDENAR POR

En todas las PLP:

- [x] Debe funcionar.
- [x] No puede desplazar la barra ni el grid.
- [x] No puede aumentar la altura del documento al abrirse.
- [x] Debe abrirse como popover superpuesto.
- [x] Debe permanecer anclado visualmente al botón.
- [x] Sin pill exterior innecesaria.
- [x] Sin subrayado duplicado.
- [x] Sin borde heredado de formularios.
- [x] Fondo y contraste según tema.
- [x] Área táctil mínima de 44 px.
- [x] Cerrar al seleccionar.
- [x] Cerrar al pulsar fuera.
- [x] Cerrar con Escape.
- [x] Restaurar el foco.
- [x] Navegación por teclado.
- [x] Ordenación real por precio y resto de opciones existentes.

No duplicar el normalizador ni el formateador existente.

---

# 8. BARRA DE FILTROS

Debe conservarse en una sola línea cuando el ancho lo permita:

Izquierda:

- Filtros
- Ordenar por

Derecha:

- checkbox En stock
- Vista, cuando exista

Requisitos:

- [x] Utilizar dos grupos flexibles.
- [x] `justify-content: space-between`.
- [x] No envolver palabras internamente.
- [x] Tipografía fluida con `clamp()`.
- [x] Reducir gaps antes de permitir saltos.
- [x] No centrar accidentalmente el grupo izquierdo.
- [x] No crear fondo beige ajeno al tema.
- [x] No desplazar el grid.
- [x] Sin overflow.

---

# 9. DRAWERS DE FILTROS

- [x] Deben caber completamente en el viewport.
- [x] No sobresalir por la derecha.
- [x] Ancho máximo `100vw`.
- [x] Altura basada en `100dvh`.
- [x] Respetar safe areas.
- [x] Scroll solo en el cuerpo interior.
- [x] Footer de acciones siempre accesible.
- [x] X centrada en un control de al menos 44×44 px.
- [x] X en posición coherente.
- [x] Contraste correcto en fondos claros y oscuros.
- [x] Colores visibles.
- [x] Tallas visibles.
- [x] `Eliminar filtros` y `Ver resultados` legibles.
- [x] Cerrar mediante X, Escape y overlay.
- [x] Bloquear correctamente el scroll de fondo.
- [x] Restaurar el foco.
- [x] No mostrar el dock mientras el drawer esté abierto.

---

# 10. PANEL DE CUENTA / REGISTRO

En móvil y tablet:

- [x] Al pulsar el águila central debe ocupar correctamente toda la pantalla.
- [x] `width: 100%`.
- [x] `max-width: none` en móvil.
- [x] Altura basada en `100dvh`.
- [x] Respetar safe areas.
- [x] Fondo editorial solo cuando tenga contraste suficiente.
- [x] X en la esquina superior derecha.
- [x] X centrada en un control accesible.
- [x] Título, formulario y enlaces completamente visibles.
- [x] Inputs y botones dimensionados correctamente.
- [x] Sin contenido lateral cortado.
- [x] Scroll interior cuando sea necesario.
- [x] Escape debe cerrar y devolver el foco al águila.
- [x] No modificar Firebase Auth ni los estados de sesión.

En escritorio:

- [x] Mantener el panel lateral aprobado.
- [x] Links con separación vertical correcta.
- [x] Indicador hover/focus debajo del texto.
- [x] Nunca atravesando la palabra.
- [x] Sin movimiento de layout.

---

# 11. MENÚ MÓVIL PRÊT-À-PORTER

Reutilizar el menú existente.

- [x] Mujer abre segundo nivel.
- [x] Hombre abre segundo nivel.
- [x] Transición de derecha a izquierda.
- [x] Primer nivel sale hacia `translateX(-100%)`.
- [x] Segundo nivel entra desde `translateX(100%)`.
- [x] Duración aproximada de 240–320 ms.
- [x] Sin rebote.
- [x] Respetar `prefers-reduced-motion`.
- [x] Atrás realiza transición inversa.
- [x] Escape vuelve primero al nivel anterior.
- [x] Cerrar el menú reinicia al primer nivel.
- [x] Cambiar de pestaña reinicia el submenú.
- [x] ARIA correcta.
- [x] Rutas reales.
- [x] Sin categorías inexistentes.
- [x] Sin drawer paralelo.

---

# 12. HERO DE VÍDEO

En `/home`, `/mujer` y `/hombre`, donde corresponda:

- [x] No mostrar una imagen Afterhour incorrecta antes del vídeo.
- [x] No producir flash visual de contenido equivocado.
- [x] Mantener un fallback correcto y coherente.
- [x] Vídeo con `object-fit: cover`.
- [x] No deformar.
- [x] No duplicar `source`.
- [x] Esperar `loadeddata` o `canplay` para mostrarlo.
- [x] Aplicar fade controlado.
- [x] Mantener autoplay silenciado cuando el navegador lo permita.
- [x] Gestionar correctamente `prefers-reduced-motion`.
- [x] No ocultar permanentemente el vídeo por una regla responsive errónea.

---

# 13. TEMAS CLAROS Y OSCUROS

- [x] Textos legibles.
- [x] Filtros legibles.
- [x] Checkbox visible.
- [x] Precio visible.
- [x] Wishlist visible.
- [x] Badge visible.
- [x] Drawer visible.
- [x] Estados hover/focus visibles.
- [x] No introducir fondos beige genéricos.
- [x] Reutilizar variables temáticas existentes.

---

# 14. TÉCNICA RESPONSIVE OBLIGATORIA

Priorizar:

- CSS Grid;
- Flexbox;
- `minmax()`;
- `repeat()`;
- `auto-fit` o reglas compartidas controladas;
- `clamp()`;
- `min()`;
- `max()`;
- porcentajes;
- `aspect-ratio`;
- container queries solo si encajan con la arquitectura existente;
- `100dvh`;
- safe-area insets.

Evitar:

- nuevas coordenadas absolutas;
- márgenes mágicos;
- alturas rígidas de contenido;
- duplicación de HTML;
- múltiples media queries que compitan;
- parches específicos por dispositivo;
- frameworks nuevos;
- Tailwind o Bootstrap;
- JavaScript para solucionar lo que corresponde a CSS;
- nuevos `!important` salvo necesidad demostrada contra código legacy.

La solución debe comportarse correctamente también entre los breakpoints exactos.

---

# 15. MATRIZ DE VALIDACIÓN

Validar como mínimo:

## Móvil

- [x] 320×568
- [x] 360×800
- [x] 375×667
- [x] 390×844
- [x] 412×915
- [x] 430×932

## Tablet e intermedios

- [x] 600×960
- [x] 679×900
- [x] 768×1024
- [x] 820×1180
- [x] 912×1368
- [x] 960×1280
- [x] 1024×1366

## Escritorio

- [x] 1366×768
- [x] 1920×1080

Además, realizar barridos intermedios para detectar cruces de media queries.

En cada ruta comprobar:

- orden estructural;
- número de columnas;
- overflow;
- posiciones;
- badges;
- wishlist;
- filtros;
- sort;
- drawers;
- dock;
- tipografía;
- contraste;
- focus;
- Escape;
- scroll;
- consola.

No aceptar como válida una comprobación realizada antes de que finalice el render dinámico.

---

# 16. COMERCIO BLOQUEADO

No modificar esta política durante la fase:

- [x] Mantener checkout bloqueado.
- [x] No activar pagos.
- [x] No activar pedidos.
- [x] No modificar Stripe live.
- [x] No inventar precios de transporte.
- [x] No habilitar `CHECKOUT_ENABLED=true`.
- [x] No desplegar.

---

# 17. VALIDACIONES TÉCNICAS

Ejecutar al final:

- [x] `node --check` para cada JavaScript modificado.
- [x] `git diff --check`.
- [x] `node scripts\\validate-mobile-parity.js`.
- [x] Pruebas existentes relacionadas con PLP.
- [ ] Pruebas existentes de wishlist (no existe suite dedicada y la validación autenticada requiere una sesión real).
- [x] Pruebas existentes de catálogo.
- [x] Pruebas existentes de drawers.
- [x] Auditoría de IDs duplicados.
- [x] Auditoría de listeners duplicados.
- [x] Comprobación de consola.
- [x] Comprobación de overflow horizontal.
- [x] Comparación de escritorio antes/después.

Los avisos LF/CRLF no deben confundirse con errores reales.

---

# 18. INFORME FINAL

Crear:

`reports/codex-final-responsive-report.md`

Debe incluir exactamente:

1. causa raíz de cada problema;
2. archivos modificados;
3. selectores eliminados;
4. selectores consolidados;
5. JavaScript modificado;
6. solución de Wishlist deslogueado;
7. solución responsive de Wishlist;
8. solución responsive de Archive;
9. solución de cards;
10. solución de sort;
11. solución de filtros;
12. solución de drawers;
13. solución del panel de cuenta;
14. solución del menú Prêt-à-porter;
15. solución del vídeo;
16. rutas comprobadas;
17. resoluciones comprobadas;
18. barridos intermedios realizados;
19. errores de consola;
20. validaciones superadas;
21. riesgos residuales;
22. pruebas manuales pendientes;
23. confirmación de escritorio;
24. confirmación de que checkout continúa bloqueado;
25. confirmación de que no hubo commit, push ni despliegue.

No declarar “sin pendientes” cuando quede alguna comprobación sin ejecutar.
