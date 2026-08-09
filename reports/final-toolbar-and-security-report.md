# Informe final — toolbar PLP responsive y registro de eventos de seguridad

Estado comprobado sobre el working tree existente de `codex/render-production`, HEAD `7bc82a512ea1ba2d899417500b8ef3a5f3f52121`. La fase se ejecutó sin cambiar de rama y preservando los cambios válidos anteriores.

## 1. Causa raíz de la toolbar en dos filas

La toolbar no tenía una única autoridad de layout. La capa compartida anterior convertía `.pp-filters.container` en Grid (`minmax(0, 1fr) max-content`) solo dentro de parte del rango móvil, mientras varias hojas de ruta volvían a imponer `flex-direction: column`, `align-items: flex-start` y un `.pp-filter-right` con `align-self: flex-end` a anchuras pequeñas. A la vez, `plp-ui-universal.css` permitía `flex-wrap: wrap !important` dentro de ambos grupos. La combinación de alcance incompleto, especificidad de ruta y tamaños intrínsecos hacía que Camisetas pudiera conservar una fila y Sudaderas apilara los grupos en la misma anchura. No era un fallo de datos ni de HTML.

## 2. Selector ganador antes de la corrección

En `/sudaderas-punto-mujer`, el ganador que producía el apilado era `body.women-page.sud-women-page .pp-filters.container` dentro de `@media (max-width: 640px)` de `public/assets/css/sud-mujer.css`, con `flex-direction: column`, `align-items: flex-start` y `gap: 8px`; su regla compañera `body.women-page.sud-women-page .pp-filter-right` imponía `align-self: flex-end`. El mismo patrón existía en `camisetas.css`, `hoodies.css`, `streetwear.css` y `sud-hombre.css`. Además, el selector compartido `body:is(.men-page, .women-page) #main .pp-filters.container` de `mobile-shell.css` ganaba con `display: grid !important` y `grid-template-columns: minmax(0, 1fr) max-content !important` solo en su rango anterior, y `plp-ui-universal.css` añadía el wrap interno. La divergencia era, por tanto, una cascada demostrada, no una estimación visual.

## 3. Archivos CSS corregidos

- `public/assets/css/mobile-shell.css`: autoridad canónica compartida.
- `public/assets/css/plp-ui-universal.css`: retirada de wrap universal contradictorio.
- `public/assets/css/camisetas.css`: retirada del layout móvil por ruta.
- `public/assets/css/hoodies.css`: retirada del layout móvil por ruta.
- `public/assets/css/streetwear.css`: retirada del layout móvil por ruta.
- `public/assets/css/sud-hombre.css`: retirada del layout móvil por ruta.
- `public/assets/css/sud-mujer.css`: retirada del layout móvil por ruta.

No se creó una regla visual nueva por URL.

## 4. Reglas eliminadas o neutralizadas

Se eliminaron los bloques de ruta que forzaban columna, `align-items: flex-start`, gaps manuales y `align-self: flex-end`; también el `flex-wrap: wrap !important` universal de los grupos. La antigua construcción Grid de `.pp-filters` dejó de ser la autoridad responsive y las propiedades contradictorias se concentran ahora en una sola capa compartida. Se conservaron las reglas de tema, grid de productos, cards, header, footer, filtros, carrito y cuenta. No se añadieron offsets, posiciones absolutas para construir la fila ni transformaciones de corrección estática.

## 5. Regla canónica final

En `mobile-shell.css`, `@media (max-width: 1365px)` aplica a `.pp-filters.container` y a las toolbars equivalentes: `display:flex`, `width:100%`, `min-width:0`, fila, `flex-wrap:nowrap`, centrado vertical, `justify-content:space-between` y `gap:clamp(6px, 1.5vw, 18px)`. Los grupos son Flex en fila, sin wrap, con `min-width:0`, `gap:clamp(5px, 1.2vw, 16px)` y texto sin salto. El izquierdo usa `flex:1 1 auto`; el derecho usa `flex:0 0 auto`, `width/min-width:max-content`, `margin-inline-start:auto` y `justify-content:flex-end`. Tipografía, padding y controles mantienen los `clamp()` compartidos ya consolidados. La media query termina en 1365 px: desde 1366 no modifica la geometría visual aprobada.

## 6. Rutas comprobadas

Se midieron individualmente `/mujer`, `/hombre`, `/camisetas-punto-mujer`, `/sudaderas-punto-mujer`, `/streetwear-mujer`, `/hoodies-mujer`, `/camisetas-punto-hombre`, `/sudaderas-punto-hombre`, `/streetwear-hombre` y `/hoodies`. La búsqueda de estructuras equivalentes no reveló otra PLP pública fuera de estas diez que exigiera una variante adicional.

## 7. Resoluciones comprobadas

La matriz principal cubrió las 23 resoluciones exigidas: `320×568`, `344×700`, `360×800`, `375×667`, `384×854`, `390×844`, `393×873`, `412×915`, `430×932`, `480×900`, `600×960`, `679×900`, `768×1024`, `820×1180`, `912×1368`, `960×1280`, `1024×1366`, `1025×1366`, `1040×1200`, `1280×800`, `1365×768`, `1366×768` y `1920×1080`: 230 registros reales.

El barrido adicional de las dos rutas de referencia cubrió 28 anchos: `336`, `352`, `368`, `376`, `388`, `400`, `421`, `456`, `512`, `560`, `640`, `720`, `834`, `900`, `1000`, `1016`, `1023`, `1026`, `1060`, `1120`, `1180`, `1240`, `1320`, `1360`, `1364`, `1367`, `1440` y `1600` px: 56 registros más. Todas las mediciones se hicieron tras el render dinámico en sesiones aisladas.

## 8. Mediciones top/left/right/height

DOMRects representativos de `/camisetas-punto-mujer` y `/sudaderas-punto-mujer` —ambas produjeron los mismos valores—, en el orden `top / left / right / height`:

| Viewport | Toolbar | Grupo izquierdo | Grupo derecho |
|---|---:|---:|---:|
| `320×568` | `273.31 / 0 / 305 / 59` | `280.31 / 12 / 196.06 / 44` | `280.31 / 202.06 / 293 / 44` |
| `1024×1366` | `399.69 / 0 / 1009 / 59` | `406.69 / 28 / 832.86 / 44` | `406.69 / 848.22 / 981 / 44` |
| `1365×768` | `583.94 / 0 / 1335 / 39.59` | `593.94 / 40 / 1154.23 / 19.59` | `593.94 / 1172.23 / 1295 / 19.59` |
| `1366×768` | `584 / 0 / 1336 / 39.59` | `594 / 40 / 174.09 / 19.59` | `594 / 1167.23 / 1296 / 19.59` |
| `1920×1080` | `718.72 / 0 / 1905 / 39.59` | `728.72 / 40 / 174.09 / 19.59` | `728.72 / 1736.23 / 1865 / 19.59` |

En toda la matriz, el delta máximo entre los `top` de ambos grupos fue `0 px`; el gap mínimo fue `6 px` y ningún rect salió de la toolbar.

## 9. Comprobación de una sola línea

Las diez rutas pasaron sin wrap, overflow horizontal, solapamiento ni texto cortado. En las ocho PLP de categoría permanecen visibles `Filtros`, `Ordenar por`, `En stock` y `Vista` en una sola fila. `/mujer` y `/hombre` conservan su marcado original: usan select nativo y no contienen un control `Vista`; no se inventó uno. El validador comprueba `left.right < right.left`, límites del contenedor, alineación con tolerancia de 2 px y altura justificada. Resultado global: delta vertical máximo `0 px`, gap mínimo `6 px`, cortes `0`, overflows `0` y errores de consola `0`.

## 10. Comportamiento de Ordenar por

El menú existente queda fuera del flujo mediante `.pp-sort-menu` fijo, dimensionado por variables calculadas desde el trigger; abrirlo no cambia la altura de la toolbar, el hero ni el top documental del grid. `script.js` lo recoloca al hacer scroll en lugar de cerrar o reinsertar contenido. Se ejecutaron 32 recorridos en ocho rutas y en 320, 1024, 1365 y 1366 px: apertura, selección, Escape, click exterior y devolución de foco. El desplazamiento máximo aceptado del grid fue 1 px y el observado quedó dentro de ese límite. Los 20 recorridos adicionales de controles confirmaron filtros, checkbox, Vista/select y teclado sin errores.

## 11. Riesgo para escritorio

La autoridad de fila termina en 1365 px. La franja aprobada de `1366×768` conservó exactamente el SHA-256 `3ebc08b5c38ed65fcb106e18a78c35a3bd55de9c129e7bfecfe22e8a7e8c4ebc` antes y después; `1920×1080` conservó `95fba46752f6bc0890792ae9c018f8e9b733e4dcc61f564a696a6c1674e85a6b`. Rects de comparación: `0/584/1351×58` y `0/718/1905×58`, respectivamente, idénticos. El riesgo residual de escritorio queda limitado al comportamiento intencional del popover durante interacción, también probado; no hubo rediseño ni cambio pixel a pixel en reposo.

## 12. Arquitectura del logger

`lib/security-logger.js` centraliza middleware, emisión, resolución de origen, request ID, saneado, normalización privada de rutas, HMAC, deduplicación y memoria acotada. Expone `middleware`, `event`, `flush`, `close` y estadísticas, además de funciones puras comprobables. Cada línea es JSON con `type:"security_event"`; `info/notice` va a stdout y `warning/error/critical` a stderr. `server.js` instala el contexto antes de webhook/body parsers, mantiene `app.set('trust proxy', false)`, añade validaciones y usa un handler final genérico. `Rndr-Id` válido se reutiliza como request ID; de lo contrario se genera `crypto.randomUUID()`, se conserva durante la petición y se devuelve como `X-Request-Id` cuando es seguro. No hay endpoint público ni archivos de log persistentes.

Archivos de la fase B: `.env.example`, `lib/security-logger.js`, `server.js`, `scripts/validate-security-logging.js` y `docs/SECURITY_LOGGING.md`.

## 13. Eventos implementados

Se implementaron los 19 eventos requeridos: `AUTH_FAILURE`, `ACCESS_DENIED`, `RATE_LIMIT_EXCEEDED`, `INPUT_VALIDATION_FAILURE`, `MALFORMED_JSON`, `PAYLOAD_TOO_LARGE`, `INVALID_CONTENT_TYPE`, `METHOD_NOT_ALLOWED`, `PATH_TRAVERSAL_ATTEMPT`, `SENSITIVE_PATH_PROBE`, `AUTOMATED_SCAN_PATTERN`, `CHECKOUT_DISABLED_ACCESS`, `PRICE_TAMPERING_ATTEMPT`, `INVALID_SKU`, `INVALID_VARIANT`, `INVALID_QUANTITY`, `WEBHOOK_SIGNATURE_FAILURE`, `SECURITY_EVENTS_SUPPRESSED` e `INTERNAL_SECURITY_ERROR`. Son señales técnicas; ningún nombre de evento atribuye identidad ni confirma por sí solo un ataque.

## 14. Resolución de dirección de origen

`resolveClientAddress(req)` es el único intérprete. En local toma exclusivamente `req.socket.remoteAddress` e ignora cabeceras reenviadas. En una instancia identificada como Render exige marcadores coherentes (`Rndr-Id` y `CF-Ray`), una dirección única válida en `CF-Connecting-IP` y que coincida con el primer valor normalizado de `X-Forwarded-For`. Si falta coherencia devuelve dirección y máscara `null` con `sourceConfidence:"low"`; nunca inventa una fuente. Registra familia IPv4/IPv6 y, por defecto, solo máscara más `sourceId`.

## 15. Protección contra headers falsificados

`trust proxy` permanece desactivado y las claves no usan `req.ip`. Las pruebas demostraron que un cliente local no sustituye el socket con `X-Forwarded-For`, `CF-Connecting-IP` ni variantes; en modo Render, ausencia de marcadores, discrepancia entre cabeceras, lista inyectada o valor inválido degradan a origen no fiable. Solo el caso coherente completo se acepta. Esta validación reproduce la frontera documentada sin afirmar que localhost sea una prueba end-to-end de la red de Render/Cloudflare.

## 16. Seudonimización mediante HMAC

`sourceId` usa HMAC-SHA256 y `SECURITY_LOG_HASH_KEY`; no existe fallback a hash simple. El identificador es estable mientras dirección y clave se mantengan, pero no publica la dirección. IPv4 oculta el último octeto; IPv6 conserva solo un prefijo reducido. Con clave ausente o inválida, `sourceId` queda `null`, se emite un error interno agregado y, si la resolución de red sigue siendo fiable, se conservan solo máscara/familia/confianza. `SECURITY_LOG_RAW_IP=false` es el valor seguro; una IP completa solo podría emitirse con autorización explícita, variable `true` y severidad `error/critical`.

## 17. Datos excluidos

El esquema cerrado no admite passwords, `Authorization`, Firebase tokens, Stripe secrets, firmas completas, cookies, sesiones, API keys, bodies, correos completos, nombres, teléfonos, direcciones, datos bancarios, tarjetas, `.env`, `secrets/`, service accounts ni stacks públicos. Mensajes y acciones proceden de vocabulario controlado, no de `error.message`. Las rutas conocidas se canonizan; IDs privados pasan a `:id` y segmentos desconocidos, dinámicos, percent-encoded o de traversal se reducen a plantillas como `/api/:unknown`, `/:path` o `/:path-traversal`. CR/LF se sanea y los campos se truncan.

## 18. Protección contra log flooding

El logger aplica deduplicación temporal por evento/fuente/ruta, límites por clave, origen y global, resúmenes `SECURITY_EVENTS_SUPPRESSED`, expiración por TTL, limpieza periódica con timer no bloqueante, longitud máxima de campo/línea y máximo de buckets. El patrón automatizado requiere al menos tres rutas de scan distintas por fuente y ventana. La prueba de memoria introdujo 5000 fuentes IPv6 únicas y confirmó que los mapas permanecen acotados. Un writer defectuoso genera fallo seguro sin detener aplicación ni petición. Salud, favicon, assets y navegación correcta se excluyen del ruido.

## 19. Rate limits

Se reutiliza `express-rate-limit` con ámbitos fijos, nunca pathname completo ni bearer sin verificar. Límites: carrito y opciones de envío `180/15 min`; checkout `40/10 min`; aviso de reserva/stock `20/15 min`; suscripción Tribe `8/15 min`; descuento `60/10 min`; probes `60/10 min`; rutas privadas `300/10 min` pre-auth por fuente y `60/10 min` tras Firebase por UID verificado más fuente. Las claves internas usan HMAC efímero y no guardan la dirección. Si no hay fuente fiable ni identidad verificada, se omite el límite pre-auth en vez de agrupar usuarios en un bucket compartido o crear una clave aleatoria. Los probes fuertes se limitan y luego se bloquean antes de `express.static`; `/admin`, ruta real, solo se observa con confianza baja y continúa.

## 20. Pruebas de seguridad

`node scripts/validate-security-logging.js` superó las 28 comprobaciones en un servidor efímero de localhost: tráfico normal/health silencioso; probes y traversal; JSON, payload, content type/charset y método; rate limit; checkout; precio, SKU, variante y cantidad; exclusión de password/token/cookie/email incluso percent-encoded; IP/HMAC; CRLF/truncado; spoofing local y casos Render coherentes/incoherentes; agregación, 5000 fuentes, fallo seguro, 0 pedidos y ausencia de Stripe live. La repetición de un probe fuerte llegó a 429 y `/admin` conservó 200 con observación de baja confianza.

Validación final adicional:

- `node --check` pasó en los seis JavaScript modificados.
- `git diff --check` pasó; solo mostró avisos LF/CRLF del entorno.
- Paridad móvil: 47 documentos, 26 rutas, 23 resoluciones y 28 anchos intermedios.
- Toolbar: 10 rutas, 23 resoluciones y 32 pruebas de sort.
- Comercio: 14 productos, 3 sudaderas, 6 zonas preparadas y 0 tarifas activas.
- Checkout gate: 4 endpoints, acceso directo cerrado y 0 pedidos.
- Producción: 423 archivos públicos y 146 SKUs con `node --experimental-vm-modules scripts/validate-production.js --allow-legal-placeholder`; el comando literal sin la bandera de VM ya se comprobó y en este Node falla por `vm.SourceTextModule`, no por el proyecto.
- Smoke final en navegador recién servido: 10 rutas × 2 viewports, 20/20 sin error de consola, overflow, corte ni desalineación.
- Búsqueda de credenciales: 0 formas de alto riesgo. Las cuatro asignaciones genéricas detectadas están en las líneas 15, 16, 45 y 46 del validador y son sentinels sintéticos deliberados; las capturas de stdout/stderr verifican que no aparecen en logs.

## 21. Comportamiento en Render

Render recogerá cada JSON desde stdout/stderr y permitirá correlación por request ID. La rama de proxy solo se activa con entorno Render y cabeceras coherentes de Render/Cloudflare; cualquier inconsistencia reduce confianza. La configuración no asume disco persistente ni crea un visor público. La retención, permisos y alertas deben configurarse operativamente en Render. Como no se desplegó, la topología real y la visibilidad en el dashboard quedan pendientes de comprobación operacional, no se presentan como ya verificadas.

## 22. Variables manuales pendientes

En Render deben configurarse manualmente `SECURITY_LOG_ENABLED=true`, una `SECURITY_LOG_HASH_KEY` aleatoria de alta entropía gestionada como secreto, `SECURITY_LOG_RAW_IP=false` y `SECURITY_LOG_LEVEL=notice`. `REPLACE_ME` en `.env.example` es solo marcador y se rechaza como clave válida. No se abrió, modificó ni mostró el `.env` real. También quedan por decidir retención mínima, acceso restringido y alertas según el plan operativo.

## 23. Riesgos residuales

- Los contadores son por proceso; varias instancias requerirían, con autorización, un almacén distribuido.
- Login y recuperación de contraseña de Firebase ocurren en cliente/proveedor y no son observables por este logger Express.
- La firma real de webhook no puede ejercitarse sin habilitar un flujo que debe seguir cerrado; se validaron su integración y fallo seguro sin llamar a Stripe.
- Render/Cloudflare solo se simuló con entradas controladas locales; falta prueba end-to-end tras un despliegue autorizado.
- `sourceId` es seudónimo, no anónimo, y una dirección nunca demuestra identidad o autoría.
- La validación wishlist autenticada heredada sigue pendiente si no existe una sesión real reutilizable; no se inventaron credenciales.
- El validador de producción requiere la bandera experimental de VM con la versión local de Node.

No se instalaron dependencias ni se hicieron limpiezas preventivas fuera del alcance.

## 24. Confirmación del checkout bloqueado

`CHECKOUT_ENABLED` permaneció desactivado en todas las pruebas. El acceso directo y los cuatro endpoints protegidos devolvieron el gate esperado; el logger registró `CHECKOUT_DISABLED_ACCESS` sin alterar la precedencia de 503. `validate-checkout-gate.js` y el validador de seguridad confirmaron 0 pedidos. No se activó Stripe live, no se llamó al webhook y siguen existiendo 0 tarifas activas; el checkout continúa bloqueado.

## 25. Confirmación de que no hubo commit

No se creó ningún commit. HEAD continúa en `7bc82a512ea1ba2d899417500b8ef3a5f3f52121` y los cambios permanecen visibles en el working tree para revisión.

## 26. Confirmación de que no hubo push

No se ejecutó push ni se alteró ninguna referencia remota.

## 27. Confirmación de que no hubo despliegue

No se desplegó en Render ni en ningún otro servicio. Toda prueba ofensiva/sospechosa se limitó a localhost y el servidor local de validación se detuvo al finalizar.
