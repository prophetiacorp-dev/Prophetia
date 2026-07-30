'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prophetia-checkout-gate-'));

process.env.NODE_ENV = 'test';
process.env.SITE_URL = 'http://127.0.0.1';
process.env.SALES_ENABLED = 'true';
process.env.CHECKOUT_ENABLED = 'false';
process.env.DATA_DIR = testDataDir;
process.env.FIREBASE_ADMIN_CREDENTIALS = path.join(testDataDir, 'missing-firebase-admin.json');
process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_gate_validation';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_checkout_gate_validation';
process.env.RESEND_API_KEY = 're_checkout_gate_validation';

const { app, CHECKOUT_ENABLED } = require('../server');

const expectedPayload = {
  ok: false,
  code: 'CHECKOUT_DISABLED',
  message: 'La compra todavía no está disponible.'
};

async function run() {
  assert.strictEqual(CHECKOUT_ENABLED, false, 'El checkout debe arrancar bloqueado.');

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const protectedRequests = [
      ['/api/create-checkout-session', { method: 'POST', body: '{}' }],
      ['/api/stripe-webhook', { method: 'POST', body: '{}' }],
      ['/api/order-by-session?session_id=cs_test_blocked', { method: 'GET' }],
      ['/api/guest-order-account-intent', { method: 'POST', body: '{}' }]
    ];

    for (const [pathname, options] of protectedRequests) {
      const response = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(response.status, 503, `${pathname} debe devolver 503.`);
      assert.deepStrictEqual(await response.json(), expectedPayload, `${pathname} debe usar el JSON estable.`);
    }

    const storefrontResponse = await fetch(`${baseUrl}/api/storefront-config`);
    assert.strictEqual(storefrontResponse.status, 200);
    const storefront = await storefrontResponse.json();
    assert.strictEqual(storefront.salesEnabled, true, 'La cesta debe permanecer operativa.');
    assert.strictEqual(storefront.checkoutEnabled, false, 'El checkout público debe aparecer bloqueado.');

    for (const pathname of ['/checkout', '/checkout.html']) {
      const response = await fetch(`${baseUrl}${pathname}`);
      const html = await response.text();
      assert.strictEqual(response.status, 503, `${pathname} debe devolver el estado editorial bloqueado.`);
      assert.match(html, /Compra temporalmente no disponible/);
      assert.match(html, /tarifas reales de envío/);
      assert.doesNotMatch(html, /id="ckPaymentForm"/);
    }

    assert.strictEqual(
      fs.existsSync(path.join(testDataDir, 'orders.json')),
      false,
      'El bloqueo no debe crear ningún pedido.'
    );

    console.log('Checkout bloqueado verificado: 4 endpoints protegidos, acceso directo cerrado y 0 pedidos creados.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });
