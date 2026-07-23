# PROPHETIA — preparación para producción

## Estado del primer drop

La fuente única del inventario de lanzamiento es `data/launch-stock.json`.
Solo están activas estas variantes de Atlas oversize:

- Beige: M (8), L (3)
- Blanco: M (4), L (2)

Después de cambiar cualquier cantidad, ejecutar:

```text
npm run sync:stock
npm run check
```

El primer comando sincroniza el catálogo público y el inventario privado. El
segundo impide publicar si detecta assets rotos, JavaScript/JSON inválido,
stock desincronizado o marcadores pendientes.

## Bloqueo legal antes de publicar

Hay que sustituir en `public/aviso-legal.html` y `public/privacy.html` los datos
provisionales del titular por:

- nombre completo o razón social;
- NIF/CIF;
- domicilio fiscal o profesional;
- datos de contacto definitivos.

`npm run check` seguirá fallando de forma intencionada hasta completar estos
datos. Para verificar solo la parte técnica mientras tanto puede usarse
`npm run check:technical`.

## Activación del backend

1. Desplegar la aplicación completa con Node.js 22 o superior (`server.js`
   sirve web y API).
2. Crear un volumen persistente y asignar su ruta a `DATA_DIR`.
3. Configurar todas las variables de `.env.example` como secretos del host.
4. Verificar el dominio remitente de Resend y configurar
   `ORDER_INTERNAL_EMAIL` con el buzón que recibirá los avisos.
5. Registrar en Stripe el webhook `https://prophetia.es/api/stripe-webhook`.
6. Montar el service account de Firebase fuera del repositorio y asignar su
   ruta a `FIREBASE_ADMIN_CREDENTIALS`.
7. Comprobar `https://prophetia.es/api/health`: todos los servicios deben
   aparecer activos y `persistentData` debe ser `true`.

Sin el backend online la tienda puede mostrar el catálogo y las tallas, pero
no debe confirmar un aviso de stock: el formulario mostrará un error real y
conservará el correo en pantalla para volver a intentarlo. Cuando el backend
esté activo, cada aviso se guarda en Firestore y se envía al correo interno.

## Demanda y reposiciones

Cada aviso de stock se registra por la combinación `email + SKU`, por lo que
un mismo cliente no aumenta dos veces la demanda de la misma variante. Una
persona sí puede solicitar varias tallas o colores, porque cada variante es
una intención distinta.

El correo enviado a `ORDER_INTERNAL_EMAIL` incluye:

- producto y variante exacta (corte, color y talla);
- demanda única acumulada de esa variante;
- demanda total del producto;
- clasificación de las variantes más solicitadas para orientar la siguiente
  reposición o drop.

En Firestore se guardan las solicitudes privadas en `stockWaitlist` y el
resumen agregado por producto en `stockDemandProducts`. Si el correo falla o
Resend todavía no está configurado, la solicitud permanece guardada con el
envío interno pendiente y puede reintentarse sin duplicar la demanda.

## Comprobaciones operativas

- Realizar una compra Stripe de prueba y confirmar el webhook.
- Confirmar que el pedido descuenta stock una sola vez.
- Enviar un aviso de una talla agotada y comprobar Firestore y el correo.
- Confirmar que una M/L disponible de Atlas no admite aviso y sí checkout.
- Probar inicio de sesión, carrito, checkout y confirmación en móvil y escritorio.

## Dependencias

La aplicación exige Node.js 22 o superior porque Firebase Admin 14 ya no
soporta versiones anteriores. La auditoría de npm no detecta vulnerabilidades
críticas ni altas. Mantiene seis avisos moderados transitivos del cliente
oficial de Google Cloud Storage; no se han forzado versiones internas
incompatibles y deben revisarse cuando Google publique una resolución segura.
