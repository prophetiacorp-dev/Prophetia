'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  determineDestinationZone,
  loadShippingConfig,
  calculateShipping
} = require('../lib/shipping');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'assets', 'data', 'catalog.json'), 'utf8')
);
const shippingConfig = loadShippingConfig(
  path.join(ROOT, 'config', 'shipping-rates.json')
);

function product(id) {
  const match = catalog.find((item) => item.id === id);
  assert(match, `Producto no encontrado: ${id}`);
  return match;
}

const atlas = product('atlas-seal');
assert.strictEqual(atlas.price, 39.99);
assert.deepStrictEqual([...new Set(atlas.versions.map((version) => version.price))], [39.99]);
assert.deepStrictEqual([...new Set(atlas.variants.map((variant) => variant.cut))].sort(), ['classic', 'oversize']);

assert.strictEqual(product('prophetia-basic-bordada').price, 29.99);

const sweatshirts = catalog.filter((item) => item.active !== false && item.section === 'sudaderas-punto');
assert(sweatshirts.length > 0, 'No se han encontrado sudaderas publicadas.');
sweatshirts.forEach((item) => assert.strictEqual(item.price, 44.99, `Precio incorrecto: ${item.id}`));

assert.strictEqual(shippingConfig.currency, 'EUR');
assert.strictEqual(shippingConfig.freeShippingThresholdCents, null);
assert.strictEqual(shippingConfig.pickupPointEnabled, false);
assert.deepStrictEqual(shippingConfig.rates, []);
assert(shippingConfig.zones.every((zone) => zone.active === false));

const zoneCases = [
  [{ country: 'ES', postalCode: '28001' }, 'es-peninsula'],
  [{ country: 'ES', postalCode: '07001' }, 'es-balearic'],
  [{ country: 'ES', postalCode: '35001' }, 'es-canary'],
  [{ country: 'ES', postalCode: '51001' }, 'es-ceuta-melilla'],
  [{ country: 'FR', postalCode: '75001' }, 'eu'],
  [{ country: 'US', postalCode: '10001' }, 'international']
];
zoneCases.forEach(([address, expected]) => {
  assert.strictEqual(determineDestinationZone(address).zoneId, expected);
});

const pending = calculateShipping({
  config: shippingConfig,
  shippingDetails: null,
  subtotalCents: 3999,
  requiresShipping: true
});
assert.strictEqual(pending.status, 'address_required');
assert.strictEqual(pending.amountCents, null);

const unavailable = calculateShipping({
  config: shippingConfig,
  shippingDetails: { country: 'ES', postalCode: '28001' },
  subtotalCents: 3999,
  requiresShipping: true
});
assert.strictEqual(unavailable.status, 'unavailable');
assert.strictEqual(unavailable.amountCents, null);
assert.deepStrictEqual(unavailable.shippingOptions, []);

assert.throws(() => calculateShipping({
  config: shippingConfig,
  shippingDetails: {
    country: 'ES',
    postalCode: '28001',
    shippingRateId: 'browser-manipulated-rate'
  },
  subtotalCents: 3999,
  requiresShipping: true,
  requireSelection: true
}), /No hay opciones de envío disponibles/);

console.log(
  `Comercio verificado: ${catalog.length} productos, ${sweatshirts.length} sudaderas, ` +
  `${shippingConfig.zones.length} zonas preparadas y 0 tarifas activas.`
);
