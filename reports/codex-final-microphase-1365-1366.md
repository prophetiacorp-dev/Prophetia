# Informe breve — microfase de frontera 1365/1366

Fecha de validación: 2026-07-30. Ruta de referencia: `/streetwear-mujer`. Cada tamaño se abrió en una sesión aislada y se midió después de cargar fuentes, partials y cards.

## 1. Causa exacta del salto 1365/1366

La media compartida `@media (min-width: 1025px) and (max-width: 1365px)` dejaba `.pp-hero__side` en Grid, `position: static` y segunda fila, con `y=142.50` a 1365. Al expirar un píxel después reaparecía la regla legacy de `streetwear-mujer.css`, `position:absolute; top:clamp(150px,18vw,250px)`, que colocaba el mismo lateral en `y=312.88`. El salto era una frontera de cascada, no un error del contenido.

## 2. Selector corregido

Se corrigieron los selectores compartidos ya existentes de `plp-hero-spacing.css`: el contenedor `.pp-hero.hero--two-cols` y `.pp-hero__side`. La media sigue terminando en 1365. El progreso se calcula con `clamp(0, (100vw - 1180px) / 185px, 1)` y Grid interpola pista, separación y paddings hacia la geometría legacy. No se añadió selector por ruta: la participación usa el dial editorial preexistente `--hero-side-y-sw`; las demás PLP reciben el fallback neutro.

## 3. Evolución geométrica de 1180 a 1367

Coordenadas en píxeles; logo, breadcrumb, side y list se expresan como `x / y`; filtros y grid registran su `y` de documento. No hubo overflow horizontal ni errores de consola.

| ancho | floating logo | breadcrumbs | `pp-hero__side` | `pp-hero__list` | `pp-filters` | grid |
|---:|---:|---:|---:|---:|---:|---:|
| 1180 | 19.75 / 87.16 | 891.55 / 87.16 | 918.83 / 133.20 | 918.83 / 167.20 | 487.38 | 538.97 |
| 1200 | 16.89 / 87.41 | 914.38 / 89.56 | 949.83 / 153.53 | 949.83 / 187.53 | 498.13 | 549.72 |
| 1240 | 11.84 / 87.53 | 960.00 / 94.02 | 1009.56 / 193.53 | 1009.56 / 227.53 | 519.66 | 571.25 |
| 1280 | 7.72 / 87.20 | 1005.64 / 98.00 | 1066.23 / 232.63 | 1066.23 / 266.63 | 541.19 | 592.78 |
| 1300 | 6.00 / 86.88 | 1028.44 / 99.84 | 1093.41 / 251.88 | 1093.41 / 285.88 | 551.95 | 603.55 |
| 1320 | 4.50 / 86.42 | 1050.88 / 101.55 | 1119.83 / 270.88 | 1119.83 / 304.88 | 562.72 | 614.31 |
| 1340 | 3.25 / 85.86 | 1073.38 / 103.16 | 1145.50 / 289.69 | 1145.50 / 323.69 | 573.48 | 625.08 |
| 1350 | 2.70 / 85.53 | 1084.91 / 103.91 | 1158.03 / 298.98 | 1158.03 / 332.98 | 578.86 | 630.45 |
| 1360 | 2.22 / 85.19 | 1096.66 / 104.64 | 1170.41 / 308.25 | 1170.41 / 342.25 | 584.25 | 635.84 |
| 1364 | 2.03 / 85.03 | 1101.41 / 104.92 | 1175.28 / 311.94 | 1175.28 / 345.94 | 586.39 | 637.98 |
| 1365 | 2.00 / 85.00 | 1102.58 / 105.00 | 1176.50 / 312.88 | 1176.50 / 346.88 | 586.94 | 638.53 |
| 1366 | 2.00 / 85.00 | 1103.56 / 105.00 | 1177.47 / 312.88 | 1177.47 / 346.88 | 587.00 | 638.59 |
| 1367 | 2.00 / 85.00 | 1104.56 / 105.00 | 1178.47 / 313.05 | 1178.47 / 347.05 | 587.00 | 638.59 |

En la frontera crítica 1365→1366 el delta vertical es `0` para logo, breadcrumb, side y list, y `0.06px` para filtros y grid. El movimiento horizontal es el crecimiento natural de aproximadamente un píxel.

## 4. Confirmación de escritorio idéntico

La comparación antes/después de `/streetwear-mujer` dio delta exacto `0` en todos los rectángulos medidos:

- 1366×768: logo `[2,85,920,122.98]`, breadcrumb `[1103.56,105,189.44,17.5]`, side `[1177.47,312.88,133.53,102.5]`, filtros `y=587`, grid `[32,638.59,1287]`.
- 1920×1080: logo `[2,85,920,122.98]`, breadcrumb `[1657.56,105,189.44,17.5]`, side `[1731.47,317,133.53,109]`, filtros `y=721.72`, grid `[32,773.31,1841]`.

Ambos conservaron cuatro columnas y el mismo ancho de documento. Las otras siete PLP también mantuvieron exactamente sus rectángulos previos a 1365.
Las capturas antes/después también son idénticas byte a byte: SHA-256 `33916AF6…38183` a 1366×768 y `D868D078…704CD` a 1920×1080.

## 5. Wishlist autenticada

No se pudo completar sin falsear el requisito de sesión real. El único tab previo reutilizable estaba desconectado; las sesiones aisladas disponibles cargaron sin el estado `pp-auth-logged`. Por tanto siguen pendientes corazón autenticado, animación, `aria-pressed`, alta, aparición, persistencia, baja, desaparición tras recarga y foco. No se inventaron credenciales, no se inspeccionaron datos sensibles y no se marcaron esas pruebas como aprobadas.

## 6. Listeners duplicados encontrados o descartados

No se demostró duplicación funcional. El bloque Tribe de `script.js` termina antes de enlazar cuando el partial aún no existe; `popup.js` enlaza después y conserva su guardia `dataset.tribeBound`. Wishlist tiene dos recorridos idempotentes de sincronización visual, pero sus mutadores son excluyentes: el handler global sale en PLP y el handler PLP solo actúa dentro del grid. La carga directa de `plp-firestore.js` en `camisetas-punto-hombre.html` es redundante en red pero inerte para el renderer JSON. No se hizo limpieza preventiva.

## 7. Archivos modificados

En esta microfase:

- `public/assets/css/plp-hero-spacing.css`.
- `reports/codex-final-responsive-report.md`.
- `reports/codex-final-microphase-1365-1366.md`.
- Evidencias PNG en `reports/responsive-microphase-shots/`.

No se modificó JavaScript, HTML, header, filtros, grid, cards, footer, carrito, cuenta, checkout ni autenticación.

## 8. Validaciones

- Barrido aislado de los 13 anchos solicitados: correcto, sin errores de consola ni overflow horizontal.
- Comparación exacta 1366×768 y 1920×1080: delta geométrico cero y PNG antes/después con SHA-256 idéntico.
- Preservación a 1365 de las otras siete PLP: delta cero.
- JavaScript del working tree: 16 archivos modificados, sintaxis correcta; esta microfase no cambió JavaScript.
- `git diff --check`: correcto; solo avisos informativos LF/CRLF.
- `node scripts\\validate-mobile-parity.js`: 47 documentos, 26 rutas, 15 resoluciones obligatorias y 15 anchuras intermedias.
- `node scripts\\validate-checkout-gate.js`: cuatro endpoints protegidos, acceso directo cerrado y cero pedidos creados.
- Checkout continúa bloqueado. No hubo commit, push ni despliegue.

## 9. Pendientes reales

La única deuda de esta microfase es la validación Wishlist autenticada, que requiere que exista una sesión real utilizable en el navegador. Permanecen además las observaciones manuales ya declaradas del movimiento normal del menú y del hover físico del carrusel. No quedan saltos geométricos en la frontera 1365/1366 de la ruta bloqueante.
