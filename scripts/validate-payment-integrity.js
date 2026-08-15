'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prophetia-payment-integrity-'));

process.env.NODE_ENV = 'test';
process.env.SITE_URL = 'http://127.0.0.1';
process.env.SALES_ENABLED = 'true';
process.env.CHECKOUT_ENABLED = 'false';
process.env.DATA_DIR = testDataDir;
process.env.FIREBASE_ADMIN_CREDENTIALS = path.join(testDataDir, 'missing-firebase-admin.json');
process.env.STRIPE_SECRET_KEY = 'sk_test_payment_integrity_validation';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_payment_integrity_validation';
process.env.RESEND_API_KEY = 're_payment_integrity_validation';

const { app, CHECKOUT_ENABLED, __test } = require('../server');

async function run() {
  assert.strictEqual(CHECKOUT_ENABLED, false, 'La validación debe ejecutarse con checkout bloqueado.');
  assert.strictEqual(__test.isStripeSessionPaid({ payment_status: 'paid' }), true);
  assert.strictEqual(__test.isStripeSessionPaid({ payment_status: 'PAID' }), true);
  assert.strictEqual(__test.isStripeSessionPaid({ payment_status: 'unpaid', status: 'complete' }), false);
  assert.strictEqual(__test.isStripeSessionPaid({ payment_status: 'processing', status: 'complete' }), false);
  assert.strictEqual(__test.isStripeSessionPaid({ status: 'complete' }), false);
  assert.strictEqual(__test.isStripeSessionPaid({}), false);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const protectedChecks = [
      ['/api/my-orders', 'POST', 500],
      ['/api/tribe/me', 'GET', 500]
    ];

    for (const [pathname, method, expectedStatus] of protectedChecks) {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: { Accept: 'application/json' }
      });
      assert.strictEqual(response.status, expectedStatus, `${pathname} debe cerrarse si el verificador de identidad no está disponible.`);
    }

    const blockedResponse = await fetch(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [] })
    });
    assert.strictEqual(blockedResponse.status, 503, 'No debe iniciarse Stripe con checkout bloqueado.');
    assert.strictEqual(fs.existsSync(path.join(testDataDir, 'orders.json')), false, 'No debe persistirse ningún pedido.');

    console.log('Integridad de pago verificada: estado Stripe estricto, APIs privadas cerradas y 0 pedidos creados.');
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
