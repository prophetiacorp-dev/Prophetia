'use strict';

const fs = require('fs');

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK'
]);

function normalizeCountryCode(value = '') {
  const clean = String(value || '').trim().toLowerCase();
  const aliases = {
    es: 'ES', espana: 'ES', 'españa': 'ES', spain: 'ES',
    pt: 'PT', portugal: 'PT',
    fr: 'FR', france: 'FR', francia: 'FR'
  };
  return aliases[clean] || clean.toUpperCase();
}

function normalizePostalCode(value = '') {
  return String(value || '').toUpperCase().replace(/\s+/g, '').trim();
}

function determineDestinationZone(shippingDetails = {}) {
  const details = shippingDetails || {};
  const country = normalizeCountryCode(details.country);
  const postalCode = normalizePostalCode(details.postalCode);

  if (!country || !postalCode) {
    return { status: 'address_required', country, postalCode, zoneId: null };
  }

  if (country === 'ES') {
    if (!/^\d{5}$/.test(postalCode)) {
      return { status: 'invalid_address', country, postalCode, zoneId: null };
    }

    const prefix = postalCode.slice(0, 2);
    if (prefix === '07') return { status: 'resolved', country, postalCode, zoneId: 'es-balearic' };
    if (prefix === '35' || prefix === '38') return { status: 'resolved', country, postalCode, zoneId: 'es-canary' };
    if (prefix === '51' || prefix === '52') return { status: 'resolved', country, postalCode, zoneId: 'es-ceuta-melilla' };
    return { status: 'resolved', country, postalCode, zoneId: 'es-peninsula' };
  }

  return {
    status: 'resolved',
    country,
    postalCode,
    zoneId: EU_COUNTRY_CODES.has(country) ? 'eu' : 'international'
  };
}

function loadShippingConfig(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('No existe la configuración canónica de envíos.');
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');

  if (!config || typeof config !== 'object' || !Array.isArray(config.rates)) {
    throw new Error('La configuración canónica de envíos no es válida.');
  }

  const rateIds = new Set();
  for (const rate of config.rates) {
    const id = String(rate?.id || '').trim();
    if (!id) throw new Error('Existe una tarifa sin id interno.');
    if (rateIds.has(id)) throw new Error(`Tarifa de envío duplicada: ${id}`);
    rateIds.add(id);

    if (rate.active === true) {
      if (!Number.isInteger(rate.priceCents) || rate.priceCents < 0) {
        throw new Error(`La tarifa activa ${id} no tiene un precio válido en céntimos.`);
      }
      if (String(rate.currency || config.currency || '').toUpperCase() !== 'EUR') {
        throw new Error(`La tarifa activa ${id} no está configurada en EUR.`);
      }
    }
  }

  return config;
}

function matchesPostalGroup(postalCode, groups) {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  return groups.some((group) => {
    const prefixes = Array.isArray(group?.prefixes) ? group.prefixes : [];
    return prefixes.some((prefix) => postalCode.startsWith(String(prefix || '').toUpperCase()));
  });
}

function createPublicOption(rate, config, destination, subtotalCents) {
  const configuredThreshold = Number.isInteger(rate.freeShippingThresholdCents)
    ? rate.freeShippingThresholdCents
    : (Number.isInteger(config.freeShippingThresholdCents) ? config.freeShippingThresholdCents : null);
  const freeShippingApplied = configuredThreshold !== null && subtotalCents >= configuredThreshold;
  const amountCents = freeShippingApplied ? 0 : rate.priceCents;
  const estimate = rate.deliveryEstimate || {};

  return {
    id: String(rate.id),
    displayName: String(rate.displayName || rate.serviceLevel || 'Envío'),
    serviceLevel: String(rate.serviceLevel || 'standard'),
    amountCents,
    currency: String(rate.currency || config.currency || 'EUR').toUpperCase(),
    deliveryEstimate: {
      minBusinessDays: Number.isInteger(estimate.minBusinessDays) ? estimate.minBusinessDays : null,
      maxBusinessDays: Number.isInteger(estimate.maxBusinessDays) ? estimate.maxBusinessDays : null,
      label: String(estimate.label || '').trim()
    },
    destinationZone: destination.zoneId,
    freeShippingApplied,
    freeShippingThresholdCents: configuredThreshold
  };
}

function getShippingOptions({ config, shippingDetails, subtotalCents = 0, weightGrams = null } = {}) {
  const destination = determineDestinationZone(shippingDetails);
  if (destination.status !== 'resolved') {
    return { status: destination.status, destination, options: [] };
  }

  const destinationZone = (config.zones || []).find((zone) => String(zone.id) === destination.zoneId);
  if (!destinationZone || destinationZone.active !== true) {
    return { status: 'unavailable', destination, options: [] };
  }

  const levels = new Map((config.serviceLevels || []).map((level) => [String(level.id), level]));
  const options = config.rates
    .filter((rate) => rate?.active === true)
    .filter((rate) => {
      const level = levels.get(String(rate.serviceLevel || ''));
      return !level || level.active !== false;
    })
    .filter((rate) => {
      if (rate.pickupPointEnabled === true && config.pickupPointEnabled !== true) return false;
      const countries = Array.isArray(rate.countries) ? rate.countries.map(normalizeCountryCode) : [];
      return countries.length === 0 || countries.includes(destination.country);
    })
    .filter((rate) => {
      const zones = Array.isArray(rate.destinationZones) ? rate.destinationZones.map(String) : [];
      return zones.length === 0 || zones.includes(destination.zoneId);
    })
    .filter((rate) => matchesPostalGroup(destination.postalCode, rate.postalCodeGroups))
    .filter((rate) => {
      const hasWeightBounds = Number.isFinite(rate.weightMinGrams) || Number.isFinite(rate.weightMaxGrams);
      if (hasWeightBounds && !Number.isFinite(weightGrams)) return false;
      if (Number.isFinite(rate.weightMinGrams) && weightGrams < rate.weightMinGrams) return false;
      if (Number.isFinite(rate.weightMaxGrams) && weightGrams > rate.weightMaxGrams) return false;
      return true;
    })
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map((rate) => createPublicOption(rate, config, destination, subtotalCents));

  return {
    status: options.length ? 'selection_required' : 'unavailable',
    destination,
    options
  };
}

function calculateShipping({
  config,
  shippingDetails,
  subtotalCents = 0,
  weightGrams = null,
  requiresShipping = true,
  requireSelection = false,
  calculatedAt = new Date().toISOString()
} = {}) {
  if (!requiresShipping) {
    return {
      status: 'not_required',
      amountCents: 0,
      shippingRate: null,
      shippingOptions: [],
      destinationZone: null
    };
  }

  const result = getShippingOptions({ config, shippingDetails, subtotalCents, weightGrams });
  const selectedId = String(shippingDetails?.shippingRateId || '').trim();
  const selected = result.options.find((option) => option.id === selectedId) || null;

  if (!selected) {
    if (requireSelection) {
      const messages = {
        address_required: 'Introduce una dirección para calcular el envío.',
        invalid_address: 'La dirección de envío no es válida.',
        unavailable: 'No hay opciones de envío disponibles para esta dirección.',
        selection_required: 'Selecciona una opción de envío válida.'
      };
      throw new Error(messages[result.status] || messages.selection_required);
    }

    return {
      status: result.status,
      amountCents: null,
      shippingRate: null,
      shippingOptions: result.options,
      destinationZone: result.destination.zoneId
    };
  }

  const privateRate = config.rates.find((rate) => String(rate.id) === selected.id) || {};
  const shippingRate = {
    shippingRateId: selected.id,
    id: selected.id,
    displayName: selected.displayName,
    label: selected.displayName,
    serviceLevel: selected.serviceLevel,
    carrier: privateRate.carrier ? String(privateRate.carrier) : null,
    shippingAmount: selected.amountCents / 100,
    shippingAmountCents: selected.amountCents,
    currency: selected.currency,
    deliveryEstimate: selected.deliveryEstimate,
    destinationZone: selected.destinationZone,
    calculatedAt,
    freeShippingApplied: selected.freeShippingApplied,
    freeShippingThresholdCents: selected.freeShippingThresholdCents
  };

  return {
    status: 'selected',
    amountCents: selected.amountCents,
    shippingRate,
    shippingOptions: result.options,
    destinationZone: selected.destinationZone
  };
}

module.exports = {
  EU_COUNTRY_CODES,
  normalizeCountryCode,
  normalizePostalCode,
  determineDestinationZone,
  loadShippingConfig,
  getShippingOptions,
  calculateShipping
};
