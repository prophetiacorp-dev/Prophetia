# Integración de fotografías de modelo en grids — 2026-08-14

## Alcance

- Guitar by Prophetia: fotografías frontal y trasera para Hombre y Mujer, incluidas las variantes beige y Blue Ice.
- Somewhere in Summer: fotografías frontal, trasera y alternativas editoriales para Hombre y Mujer.
- Like Gods: sustitución de los cuatro recursos femeninos retirados por los nuevos mockups y fotografías frontal/trasera.
- Broken Gods: fotografías frontal y trasera para Mujer.
- Gaia’s Pulse: corrección del encuadre frontal y trasero en el grid de Hombre.

## Causas raíz

1. Los recursos nuevos existían en disco, pero Guitar, Somewhere y las variantes femeninas de Like Gods y Broken Gods no declaraban las parejas `listingImages` que el renderer prioriza en los grids.
2. Like Gods Mujer seguía apuntando a cuatro nombres de archivo retirados, por lo que las referencias habían quedado rotas.
3. Gaia usa fotografías 2:3 dentro de una zona visual 4:5. La regla compartida `object-fit: cover` recortaba la parte superior e inferior de la imagen.

## Solución

- Se conectaron todos los recursos entregados al catálogo y a sus galerías sin cambiar precios, stock, variantes comerciales ni rutas.
- Se añadieron parejas `listingImages` por género y, donde existe selección de color o versión, también por color/versión.
- El renderer admite ahora la opción declarativa `listingFit: "contain"` mediante la clase compartida `has-contained-listing-media`.
- Gaia activa esa opción solo en su media masculina, manteniendo la geometría del grid y el comportamiento del resto de cards.
- Se actualizó el identificador de caché de la hoja PLP y de `script.js` en las diez PLP que los consumen.

## Rutas verificadas en navegador real

- `/hombre`
- `/camisetas-punto-hombre`
- `/hoodies`
- `/streetwear-hombre`
- `/mujer`
- `/camisetas-punto-mujer`
- `/hoodies-mujer`
- `/streetwear-mujer`

## Resoluciones y resultado

- 390×844: dos columnas, parejas frontal/trasera correctas y sin overflow horizontal.
- 1024×1366: dos columnas, parejas frontal/trasera correctas y sin overflow horizontal.
- 1366×768: cuatro columnas en PLP de categoría; render de Hombre y Mujer sin overflow horizontal.
- Gaia se comprobó con `object-fit: contain` y fotografía natural 1024×1536 completamente visible.
- Consola del navegador: sin errores ni advertencias durante el recorrido de rutas.

## Validaciones técnicas

- `node --check public/assets/js/script.js`: correcto.
- Parseo de `public/assets/data/catalog.json`: correcto.
- Auditoría de rutas de imágenes del catálogo: todos los archivos existen.
- `git diff --check`: correcto; únicamente avisos de normalización LF/CRLF.
- `npm run check:technical`: 457 archivos públicos y 146 SKUs verificados.
- `npm run check:mobile-parity`: 47 documentos, 18 rutas, 23 resoluciones y 28 anchuras intermedias.
- `validate-navigation-motion.js`: 131 comprobaciones superadas.
- `validate-toolbar-responsive.js`: 10 rutas, 23 resoluciones y 32 pruebas de ordenar superadas.
- `validate-checkout-gate.js`: checkout bloqueado, cuatro endpoints protegidos y cero pedidos creados.

## Confirmaciones

- No se modificaron precios, stock, Stripe, envíos, fiscalidad ni autenticación.
- Checkout continúa bloqueado.
- No se desplegó en Render.
- Los cambios previos ajenos en `AGENTS.override.md` y los informes existentes no forman parte de este alcance.
