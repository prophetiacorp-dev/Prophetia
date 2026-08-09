# Registro de eventos de seguridad de PROPHETIA

## Propósito y alcance

El backend registra señales HTTP que alcanzan la aplicación y que pueden requerir revisión. Un evento representa una anomalía, una entrada rechazada o actividad potencialmente sospechosa; por sí solo no demuestra un ataque ni identifica a una persona.

Este sistema no puede detectar:

- cambios hechos directamente en GitHub, Render o el repositorio;
- una cuenta de GitHub, Render, Firebase o Stripe comprometida;
- tráfico detenido por Cloudflare o Render antes de llegar a Node.js;
- la identidad real detrás de una VPN, proxy, NAT, red corporativa o botnet;
- intentos de inicio o recuperación de contraseña gestionados enteramente por Firebase en el navegador.

Los eventos deben correlacionarse con los registros HTTP, métricas, cambios de código y evidencia del proveedor antes de declarar un incidente confirmado.

## Arquitectura

`lib/security-logger.js` concentra cinco responsabilidades:

1. asignar un identificador estable durante el ciclo de cada petición;
2. resolver la dirección de origen dentro de una frontera de proxy explícita;
3. seudonimizar y enmascarar esa dirección;
4. construir registros JSON a partir de un esquema cerrado y saneado;
5. limitar, agregar y resumir eventos repetidos para proteger memoria y salida.

El middleware de contexto se instala antes de los puntos que necesitan registrar rechazos. Los controladores llaman al mismo logger; no escriben bodies, cabeceras de autenticación ni errores completos. El logger falla de forma segura: un problema al formatear o escribir un evento no debe detener la petición ni el proceso.

No se crea una página pública de logs, un endpoint de consulta ni archivos de crecimiento ilimitado. El destino operativo es la salida estándar del proceso:

- `stdout`: severidades `info` y `notice`;
- `stderr`: severidades `warning`, `error` y `critical`.

## Esquema

Cada línea es un objeto JSON y contiene `"type":"security_event"`. El esquema base es:

```json
{
  "timestamp": "2026-08-03T10:15:30.000Z",
  "type": "security_event",
  "event": "INPUT_VALIDATION_FAILURE",
  "severity": "warning",
  "confidence": "medium",
  "requestId": "request-id",
  "method": "POST",
  "path": "/api/example",
  "status": 400,
  "sourceId": "hmac:…",
  "sourceAddressMasked": "198.51.100.xxx",
  "sourceAddressFamily": "ipv4",
  "sourceConfidence": "medium",
  "userId": null,
  "message": "Payload rejected",
  "actionTaken": "request_rejected"
}
```

`path` no incluye query string ni segmentos dinámicos sin revisar. Las rutas API conocidas se conservan como nombres canónicos, los identificadores se sustituyen por plantillas (`:id`) y las rutas desconocidas o con posibles datos opacos se reducen a categorías como `/api/:unknown` o `/:path`. Así, un correo, token o identificador de sesión incluido —también de forma percent-encoded— no pasa al registro. Los mensajes proceden de valores controlados por el servidor, no del body ni de `error.message`. Los campos ausentes de forma fiable se registran como `null`, no se inventan.

## Eventos

| Evento | Significado operativo habitual |
|---|---|
| `AUTH_FAILURE` | Credencial ausente, caducada o no verificable en una ruta protegida. |
| `ACCESS_DENIED` | Identidad válida sin autorización para la operación solicitada. |
| `RATE_LIMIT_EXCEEDED` | Un límite existente rechazó solicitudes repetidas. |
| `INPUT_VALIDATION_FAILURE` | La entrada no cumplió el contrato del endpoint. |
| `MALFORMED_JSON` | El parser rechazó JSON inválido. |
| `PAYLOAD_TOO_LARGE` | El body superó el máximo configurado. |
| `INVALID_CONTENT_TYPE` | El tipo de contenido no era válido para la ruta. |
| `METHOD_NOT_ALLOWED` | Método no admitido en una ruta pública conocida. |
| `PATH_TRAVERSAL_ATTEMPT` | La ruta contiene una forma literal o codificada de traversal. |
| `SENSITIVE_PATH_PROBE` | Petición a una ruta sensible o característica de escáneres. |
| `AUTOMATED_SCAN_PATTERN` | Acumulación de probes distintos compatible con automatización. |
| `CHECKOUT_DISABLED_ACCESS` | Acceso rechazado por la política de checkout cerrado. No implica intención maliciosa. |
| `PRICE_TAMPERING_ATTEMPT` | Un precio proporcionado por cliente no coincide con el catálogo autoritativo. |
| `INVALID_SKU` | SKU inexistente o incompatible con el producto. |
| `INVALID_VARIANT` | Variante, versión, corte, color o talla incompatibles. |
| `INVALID_QUANTITY` | Cantidad fuera del contrato admitido. |
| `WEBHOOK_SIGNATURE_FAILURE` | Stripe no pudo verificar la firma del webhook. |
| `SECURITY_EVENTS_SUPPRESSED` | Resumen de eventos omitidos por deduplicación o límites. |
| `INTERNAL_SECURITY_ERROR` | El propio subsistema no pudo completar una operación. |

Un nombre como `PRICE_TAMPERING_ATTEMPT` describe la señal técnica observada. No atribuye autoría ni confirma fraude.

## Severidad

La severidad expresa impacto operativo, no certeza:

- `info`: información contextual de muy bajo impacto;
- `notice`: comportamiento que merece trazabilidad, pero puede ser normal;
- `warning`: rechazo o patrón que requiere revisión si se repite;
- `error`: fallo importante de un control o integración;
- `critical`: riesgo inmediato y excepcional que requiere atención urgente.

`SECURITY_LOG_LEVEL` establece el mínimo emitido. No debe elevarse para ocultar fallos durante una investigación.

## Confianza

`confidence` expresa cuánto respalda la evidencia la clasificación del evento:

- `low`: señal ambigua o compatible con navegación legítima;
- `medium`: la aplicación observó y rechazó una condición concreta;
- `high`: varias comprobaciones técnicas coherentes respaldan la clasificación.

`sourceConfidence` es independiente: evalúa la fiabilidad de la dirección de origen. Una clasificación de evento alta no convierte una dirección en identidad personal ni demuestra quién originó la petición.

## Identificador de petición

Render proporciona un `requestID` y lo envía a la aplicación mediante `Rndr-Id`. El middleware reutiliza ese valor cuando está presente y es válido; en los demás casos usa `crypto.randomUUID()`. El mismo identificador acompaña todos los eventos de la petición y se devuelve como `X-Request-Id` cuando las cabeceras aún pueden modificarse.

La documentación oficial de Render explica la correlación entre `requestID` y [`Rndr-Id`](https://render.com/docs/logging#tracing-with-requestid-and-rndr-id). El identificador sirve para búsqueda y diagnóstico; no se utiliza como identidad de origen ni como autorización.

## Resolución de la dirección de origen

`resolveClientAddress(req)` es el único punto que interpreta una dirección.

### Local y pruebas

Sin la frontera de Render, se utiliza la dirección de `req.socket.remoteAddress`. Se ignoran `X-Forwarded-For`, `CF-Connecting-IP`, `True-Client-IP` y cabeceras equivalentes que un cliente local puede falsificar.

### Render público

Render documenta que el tráfico público atraviesa Cloudflare y que la dirección real se obtiene desde `X-Forwarded-For`; también reenvía `CF-Ray`. Véase [How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks). Cloudflare documenta que [`CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip) contiene una única dirección añadida en el tránsito edge-origen.

La resolución adopta una política conservadora:

- solo activa esta rama cuando el entorno identifica una instancia Render;
- exige los marcadores de petición de Render/Cloudflare previstos por la integración;
- normaliza el primer valor válido de `X-Forwarded-For`;
- exige que coincida con el valor único y válido de `CF-Connecting-IP`;
- rechaza discrepancias, listas malformadas y direcciones no válidas;
- devuelve dirección `null` y `sourceConfidence:"low"` cuando no puede establecerse una fuente fiable.

No se confía ciegamente en una cabecera proporcionada por el cliente. Express advierte que `X-Forwarded-*` es falsificable si `trust proxy` no refleja exactamente la topología real; véase [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html). La configuración debe revisarse si cambia la arquitectura de red.

## Seudonimización y enmascarado

`sourceId` se genera mediante HMAC-SHA256 con `SECURITY_LOG_HASH_KEY`. La clave vive únicamente en la configuración secreta del servicio y nunca en el repositorio ni en los logs. Un HMAC permite correlacionar eventos durante su periodo de estabilidad sin publicar la dirección original.

El HMAC es seudonimización, no anonimización. Sigue siendo un dato de seguridad potencialmente relacionable y debe tener acceso y retención limitados.

Por defecto se conserva además una forma enmascarada:

- IPv4: se oculta el último octeto, por ejemplo `198.51.100.xxx`;
- IPv6: se conserva solo un prefijo reducido y se oculta el resto;
- familia: `ipv4`, `ipv6` o `null`.

`SECURITY_LOG_RAW_IP=false` es el valor seguro. Si un responsable autoriza temporalmente `true`, la dirección completa solo puede aparecer en eventos `error` o `critical`, nunca en tráfico normal, y no puede combinarse con correo, nombre, teléfono o dirección postal. Esta excepción exige retención especialmente corta y acceso restringido.

## Datos excluidos

Nunca se registran:

- contraseñas;
- `Authorization`, tokens Firebase o secretos Stripe;
- firmas completas de webhooks;
- cookies, session IDs o API keys;
- bodies completos;
- correos, nombres, teléfonos o direcciones postales completos;
- datos bancarios o números de tarjeta;
- contenido de `.env`, `secrets/` o service accounts;
- stacks completos con rutas internas sensibles.

El esquema cerrado es la primera defensa. La sanitización de caracteres de control, el truncado y la redacción de patrones son defensas adicionales, no una licencia para pasar objetos arbitrarios al logger.

## Protección contra saturación

El logger mantiene ventanas y contadores acotados:

- deduplicación por evento, fuente seudónima y ruta normalizada;
- límite por clave, por origen y global;
- longitud máxima por campo y por línea JSON;
- número máximo de buckets en memoria;
- expiración y limpieza periódica con temporizador que no mantiene vivo el proceso;
- resumen agregado `SECURITY_EVENTS_SUPPRESSED` en vez de una línea por repetición;
- fallo seguro si el writer no está disponible.

El resumen contiene cantidades y duración de ventana, no bodies ni listas de direcciones. `/api/health`, `/health`, favicon, CSS, JavaScript, imágenes, fuentes, vídeo y navegación correcta no generan alertas por sí mismos.

## Rate limiting

Los límites reutilizan los middlewares existentes de Express. La clave combina el ámbito del endpoint con una fuente seudónima fiable y, cuando ya existe una identidad autenticada verificada, un identificador de usuario también seudonimizado. Una fuente desconocida no debe agrupar a todos los usuarios en una única clave que los bloquee colectivamente.

Los límites previos a autenticación usan una fuente estable y un ámbito fijo, nunca el pathname completo ni un bearer no verificado. Después de verificar Firebase, los endpoints privados aplican además una clave seudónima por UID. Si la fuente no puede resolverse y todavía no existe una identidad verificada, ese limitador se omite de forma segura en vez de crear un bucket compartido o una clave aleatoria por petición. Las sondas fuertes tienen un límite propio y se rechazan antes de `express.static`; `/admin`, que es una ruta real, solo se observa con confianza baja y continúa normalmente.

Los límites en memoria son por proceso. Si el servicio pasa a varias instancias, los contadores no serán globales: deberá evaluarse un almacén distribuido autorizado. No se añade esa dependencia en esta fase.

Los flujos de login y recuperación de contraseña de Firebase se ejecutan en el cliente y no atraviesan estos endpoints Express. Sus límites y alertas deben configurarse y revisarse en Firebase; el logger del backend no puede sustituirlos.

## Variables de entorno

```dotenv
SECURITY_LOG_ENABLED=true
SECURITY_LOG_HASH_KEY=REPLACE_ME
SECURITY_LOG_RAW_IP=false
SECURITY_LOG_LEVEL=notice
```

- `SECURITY_LOG_ENABLED`: activa la emisión centralizada.
- `SECURITY_LOG_HASH_KEY`: clave aleatoria de alta entropía gestionada como secreto. `REPLACE_ME` no es válida.
- `SECURITY_LOG_RAW_IP`: permanece en `false` salvo autorización temporal documentada.
- `SECURITY_LOG_LEVEL`: umbral mínimo de severidad.

Una clave ausente o inválida no autoriza un hash simple de la dirección. El logger conserva, cuando puede resolverla de forma fiable, la dirección enmascarada y su nivel de confianza, pero deja `sourceId` en `null`: la correlación seudónima queda deshabilitada y se emite un error interno agregado sin detener la aplicación.

## Uso en Render

Render recoge stdout y stderr del proceso. Los registros estructurados pueden localizarse en el explorador y correlacionarse mediante `requestId`. La guía de [logs de Render](https://render.com/docs/logging) explica búsqueda, live tail y logs HTTP según el plan.

El repositorio no presupone almacenamiento persistente ni una duración concreta del proveedor. El responsable del servicio debe:

1. restringir el acceso a quienes atienden seguridad y operaciones;
2. configurar la retención mínima compatible con investigación y obligaciones legales;
3. revisar y eliminar exportaciones temporales;
4. acortar todavía más la retención si se autoriza IP completa;
5. documentar cualquier envío a otro sistema antes de activarlo.

## Respuesta básica ante incidentes

1. Conservar el `requestId`, intervalo temporal y tipos de evento relevantes.
2. Comparar con logs HTTP de Render, `CF-Ray`, métricas y despliegues.
3. Determinar si se trata de una anomalía aislada, actividad sospechosa repetida o un control realmente vulnerado.
4. Comprobar falsos positivos, usuarios tras NAT y automatizaciones legítimas.
5. Contener con el control más estrecho posible: endpoint, cuenta verificada, regla temporal o límite proporcionado.
6. No bloquear una red completa únicamente por compartir dirección.
7. Rotar credenciales solo cuando exista indicio de exposición; nunca copiarlas al informe.
8. Documentar evidencia, decisiones, alcance y momento de cierre.
9. Declarar incidente confirmado únicamente cuando la evidencia sea suficiente.

Si la actividad fue bloqueada antes de llegar al servicio, debe investigarse en Render o Cloudflare. Si el indicio afecta repositorio, despliegues o cuentas de proveedor, debe revisarse la auditoría de ese proveedor.

## Falsos positivos

Pueden producir eventos legítimos por marcadores rotos, clientes antiguos, extensiones, crawlers, herramientas de disponibilidad, errores de red o administradores abriendo `/admin`. `CHECKOUT_DISABLED_ACCESS` también puede proceder de una navegación normal mientras la compra permanece cerrada.

Antes de endurecer un límite se revisan frecuencia, diversidad de rutas, estado autenticado, resultados de la petición y efectos en usuarios que comparten red. Una sola dirección o un solo evento no basta para atribuir un ataque.

## Validación local

```powershell
node scripts\validate-security-logging.js
```

El validador inicia exclusivamente un servidor efímero en `127.0.0.1`, usa un directorio de datos temporal y conserva `CHECKOUT_ENABLED=false`. Captura stdout/stderr de forma acotada, inspecciona únicamente eventos JSON y restaura las salidas antes de informar. No imprime los registros capturados ni los valores de prueba sensibles.

La prueba comprueba rutas normales y sospechosas, parser y payload, métodos, rate limiting, checkout, precio/SKU, exclusión de datos, HMAC, cabeceras falsificadas, agregación, memoria y fallo seguro. También confirma que no se crea ningún pedido y que no se utiliza Stripe live.

No se envía tráfico ofensivo a servicios externos.
