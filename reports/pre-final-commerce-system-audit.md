# PROPHETIA — Checkpoint previo de auditoría integral de comercio

Fecha de captura: 2026-08-15 (Europe/Madrid)
Repositorio: `C:\Users\moise\Desktop\Prophetia_Web INDEX FULL`
Rama existente: `codex/render-production`
HEAD inicial: `7300204` (`feat: actualiza catalogo mujer y animacion Tribe`)
Remoto configurado: `origin` → repositorio Prophetia en GitHub

## Restricciones activas

- La auditoría se realiza sobre el *working tree* existente, sin crear rama.
- No se realizará commit, push ni despliegue.
- No se modificarán `.env`, credenciales, claves, precios, stock, Stripe, envíos, fiscalidad ni autenticación salvo que exista un defecto local reproducible y una corrección de bajo riesgo.
- `CHECKOUT_ENABLED=false` debe mantenerse durante toda la auditoría.
- No se crearán usuarios, pedidos ni pagos reales.
- Las integraciones que requieran sesión Firebase real, correo real, Firestore remoto o Stripe Test se marcarán como `NOT VERIFIED` si no pueden probarse de forma aislada y segura.

## Estado del working tree antes de la auditoría

Cambios preexistentes que deben preservarse:

- Modificado: `AGENTS.override.md`.
- No rastreados: informes/checkpoints previos de toolbar, navegación, producción y sus parches asociados.
- El único diff rastreado inicial corresponde a `AGENTS.override.md` (2 inserciones y 2 eliminaciones).

Este informe es el primer archivo creado por la presente auditoría. Ningún archivo de aplicación había sido modificado aún.

## Estado operativo inicial

Servidor local consultado en `http://127.0.0.1:4242`:

- `/api/health`: `ok=true`, modo `development`.
- Estado anunciado por el servidor: Stripe, correo y Firebase Admin configurados; persistencia local no configurada.
- `/api/storefront-config`: `checkoutEnabled=false`.
- Mensaje público de bloqueo: “Estamos configurando los métodos y tarifas de envío. La compra se habilitará próximamente.”

No se registran ni se reproducen secretos en este documento.

## Validadores iniciales

| Comprobación | Resultado inicial |
| --- | --- |
| `node scripts\\validate-security-logging.js` | PASS — 28 comprobaciones, checkout bloqueado, 0 pedidos |
| `node scripts\\validate-checkout-gate.js` | PASS — 4 endpoints protegidos, acceso directo cerrado, 0 pedidos |
| `node scripts\\validate-commerce.js` | PASS — 14 productos, 3 sudaderas, 6 zonas preparadas, 0 tarifas activas |
| `node scripts\\validate-mobile-parity.js` | PASS — 47 documentos, 18 rutas, 23 resoluciones obligatorias y 28 anchuras intermedias |
| `node --experimental-vm-modules scripts\\validate-production.js --allow-legal-placeholder` | PASS — 469 archivos públicos y 146 SKUs |

## Arquitectura y superficies a auditar

### Backend y controles de confianza

- `server.js`: configuración, rutas públicas, autenticación Firebase, Tribe/misiones/Legacy Points, catálogo/stock, cálculo seguro, checkout, Stripe webhook, pedidos y finalización idempotente.
- `lib/security-logger.js`: registro estructurado, redacción y controles de datos sensibles.
- `lib/shipping.js` y datos de transporte: zonas, disponibilidad y bloqueo operativo.
- `data/launch-stock.json`, catálogo y ficheros operativos locales: fuente canónica, sin alterarlos durante la auditoría.

### Cliente y experiencia

- Firebase y acceso: `firebase-init.js`, `firebase-auth.js`.
- Cuenta: `account-page.js`, `account-content.js`, direcciones y pedidos.
- Wishlist y cesta: `wishlist.js`, `cart.js`, `quick-add.js`.
- Tribe: `popup.js`, `vault.js`, `tribe-xp-toast.js`.
- Catálogo/PDP: grids compartidos y `product-page.js`.
- Checkout/resultado: `checkout.js`, `checkout-success.js`, `pedidos-page.js`.
- HTML/CSS/partials asociados, además de navegación, responsive, accesibilidad, privacidad y estados de carga/error/vacío.

## Invariantes de la auditoría

1. Un pedido no puede existir sin confirmación de pago; con checkout bloqueado no debe crearse ningún pedido.
2. El cliente no es fuente de verdad para precio, stock, descuento, envío, identidad, rango, misiones o puntos.
3. Cada compra, misión, recompensa, correo y evento de finalización debe ser idempotente.
4. Invitado y usuario autenticado deben mantener aislamiento de carrito, cuenta, pedidos, Tribe y puntos.
5. La navegación de retorno y las recargas no deben repetir efectos irreversibles.
6. No debe exponerse PII, token, secreto o detalle interno en consola, respuesta pública o informe.

## Alcance de evidencia

Se combinarán:

- inspección estática de HTML, CSS, JavaScript y cascada efectiva;
- ejecución de validadores y pruebas aisladas sin servicios reales;
- comprobación en navegador real de las rutas y resoluciones solicitadas;
- inspección de consola y red cuando sea posible;
- clasificación explícita como `PASS`, `FAIL`, `NOT VERIFIED` o `BLOCKED BY CONFIGURATION`.

Las conclusiones finales y cualquier corrección aplicada quedarán registradas en `reports/final-global-customer-experience-audit.md`.
