'use strict';

const crypto = require('crypto');
const net = require('net');

const SECURITY_CONTEXT = Symbol('prophetiaSecurityContext');
const SECURITY_MIDDLEWARE_SEEN = Symbol('prophetiaSecurityMiddlewareSeen');

const SEVERITY_RANK = Object.freeze({
  info: 10,
  notice: 20,
  warning: 30,
  error: 40,
  critical: 50
});

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high']);

const EVENT_DEFAULTS = Object.freeze({
  AUTH_FAILURE: ['warning', 'medium', 'Authentication could not be verified', 'request_rejected'],
  ACCESS_DENIED: ['notice', 'medium', 'Access was denied', 'request_rejected'],
  RATE_LIMIT_EXCEEDED: ['warning', 'medium', 'Request rate limit exceeded', 'request_rejected'],
  INPUT_VALIDATION_FAILURE: ['notice', 'low', 'Input validation failed', 'request_rejected'],
  MALFORMED_JSON: ['warning', 'medium', 'Malformed JSON was rejected', 'request_rejected'],
  PAYLOAD_TOO_LARGE: ['warning', 'medium', 'Payload exceeded the configured limit', 'request_rejected'],
  INVALID_CONTENT_TYPE: ['notice', 'medium', 'Unsupported content type was rejected', 'request_rejected'],
  METHOD_NOT_ALLOWED: ['notice', 'low', 'HTTP method is not allowed for this path', 'request_rejected'],
  PATH_TRAVERSAL_ATTEMPT: ['warning', 'high', 'Path traversal pattern was rejected', 'request_rejected'],
  SENSITIVE_PATH_PROBE: ['notice', 'medium', 'Sensitive path probe observed', 'not_found_response'],
  AUTOMATED_SCAN_PATTERN: ['warning', 'medium', 'Automated scan pattern observed', 'not_found_response'],
  CHECKOUT_DISABLED_ACCESS: ['notice', 'high', 'Disabled checkout endpoint was requested', 'request_rejected'],
  PRICE_TAMPERING_ATTEMPT: ['warning', 'high', 'Client supplied non-canonical price data', 'request_rejected'],
  INVALID_SKU: ['notice', 'medium', 'Unknown SKU was rejected', 'request_rejected'],
  INVALID_VARIANT: ['notice', 'medium', 'Invalid product variant was rejected', 'request_rejected'],
  INVALID_QUANTITY: ['notice', 'medium', 'Invalid item quantity was rejected', 'request_rejected'],
  WEBHOOK_SIGNATURE_FAILURE: ['warning', 'high', 'Webhook signature verification failed', 'request_rejected'],
  SECURITY_EVENTS_SUPPRESSED: ['notice', 'high', 'Repeated security events were suppressed', 'events_aggregated'],
  INTERNAL_SECURITY_ERROR: ['error', 'high', 'Security logging encountered an internal error', 'logging_degraded']
});

const EVENT_NAMES = Object.freeze(Object.keys(EVENT_DEFAULTS));
const EVENT_NAME_SET = new Set(EVENT_NAMES);

const SAFE_EVENT_PATHS = new Set([
  '/',
  '/health',
  '/api/health',
  '/api/storefront-config',
  '/api/stripe-webhook',
  '/api/tribe/subscribe',
  '/api/reservations/notify',
  '/api/discount/validate',
  '/api/shipping-options',
  '/api/cart-summary',
  '/api/order-by-session',
  '/api/guest-order-account-intent',
  '/api/tribe/me',
  '/api/tribe/mission/check',
  '/api/drops/private',
  '/api/private-drops',
  '/api/my-orders',
  '/api/create-checkout-session',
  '/checkout',
  '/checkout.html',
  '/.env',
  '/.git',
  '/.git/config',
  '/wp-admin',
  '/wp-login.php',
  '/phpmyadmin',
  '/admin',
  '/server-status',
  '/config.php',
  '/favicon.ico'
]);

const FIELD_LIMITS = Object.freeze({
  requestId: 160,
  method: 16,
  path: 512,
  message: 320,
  actionTaken: 80,
  userId: 80
});

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;
  if (/^(1|true|yes|on)$/i.test(String(value).trim())) return true;
  if (/^(0|false|no|off)$/i.test(String(value).trim())) return false;
  return fallback;
}

function sanitizeText(value, maxLength = 256) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol') return '';

  const limit = clampInteger(maxLength, 256, 1, 4096);
  let clean = String(value)
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Defense in depth. Callers must still use constant messages and the field
  // allowlist below; these substitutions prevent common credentials and email
  // addresses from leaking when a caller makes a mistake.
  clean = clean
    .replace(/\b(?:set-cookie|cookie|authorization)\b\s*[:=]\s*.*/gi, (match) => {
      const separator = match.search(/[:=]/);
      return `${match.slice(0, separator).trim()}=[redacted]`;
    })
    .replace(/\b(?:password|passwd|pwd|token|secret|api[_-]?key|x-api-key|stripe-signature)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, (match) => {
      const separator = match.search(/[:=]/);
      return `${match.slice(0, separator).trim()}=[redacted]`;
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/gi, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/g, '[redacted-token]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]');

  return clean.slice(0, limit);
}

function canonicalizeAddress(value) {
  if (typeof value !== 'string') return null;
  let address = value.trim();
  if (!address || address.includes(',') || /[\r\n\u0000]/.test(address)) return null;

  if (address.startsWith('[') && address.endsWith(']')) {
    address = address.slice(1, -1);
  }

  if (/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.test(address)) {
    address = address.slice(7);
  }

  const family = net.isIP(address);
  if (!family) return null;

  if (family === 4) {
    const octets = address.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    return octets.join('.');
  }

  try {
    const hostname = new URL(`http://[${address}]/`).hostname;
    return hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return address.toLowerCase();
  }
}

function addressFamily(address) {
  const family = net.isIP(address);
  return family === 4 ? 'ipv4' : family === 6 ? 'ipv6' : null;
}

function expandIpv6(address) {
  const canonical = canonicalizeAddress(address);
  if (!canonical || net.isIP(canonical) !== 6) return null;

  const halves = canonical.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;

  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  return [...left, ...Array(missing).fill('0'), ...right]
    .map((part) => part.padStart(4, '0').toLowerCase());
}

function maskAddress(value) {
  const address = canonicalizeAddress(value);
  if (!address) return null;

  const family = addressFamily(address);
  if (family === 'ipv4') {
    const octets = address.split('.');
    return {
      masked: `${octets[0]}.${octets[1]}.${octets[2]}.xxx`,
      family
    };
  }

  const expanded = expandIpv6(address);
  if (!expanded) return null;
  return {
    masked: `${expanded.slice(0, 4).join(':')}:xxxx:xxxx:xxxx:xxxx`,
    family
  };
}

function validHashKey(hashKey) {
  if (Buffer.isBuffer(hashKey)) return hashKey.length >= 16;
  if (typeof hashKey !== 'string') return false;
  const clean = hashKey.trim();
  return clean.length >= 16 && !/^REPLACE_ME$/i.test(clean);
}

function createSourceId(addressValue, hashKey, options = {}) {
  const address = canonicalizeAddress(addressValue);
  if (!address || !validHashKey(hashKey)) return null;

  const namespace = sanitizeText(options.namespace || 'source', 32) || 'source';
  try {
    const digest = crypto
      .createHmac('sha256', hashKey)
      .update(`${namespace}\u0000${address}`, 'utf8')
      .digest('hex');
    return `hmac:${digest}`;
  } catch {
    return null;
  }
}

function readSingleHeader(req, name) {
  const headers = req && typeof req === 'object' ? req.headers : null;
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[String(name).toLowerCase()];
  if (Array.isArray(value) || value === null || value === undefined) return '';
  const clean = String(value).trim();
  if (!clean || /[\r\n\u0000]/.test(clean)) return '';
  return clean;
}

function validRenderRequestId(value) {
  return typeof value === 'string' &&
    value.length >= 6 &&
    value.length <= FIELD_LIMITS.requestId &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function validCfRay(value) {
  return typeof value === 'string' &&
    value.length <= 96 &&
    /^[A-Fa-f0-9]{8,64}(?:-[A-Za-z0-9]{2,16})?$/.test(value);
}

function isPrivateOrLocalAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224;
  }

  if (family === 6) {
    const clean = address.toLowerCase();
    return clean === '::' ||
      clean === '::1' ||
      clean.startsWith('fc') ||
      clean.startsWith('fd') ||
      /^fe[89ab]/.test(clean) ||
      clean.startsWith('ff');
  }

  return true;
}

function unresolvedAddress(source = 'unresolved') {
  return {
    address: null,
    confidence: 'low',
    family: null,
    source
  };
}

function isRenderEnvironment(env) {
  return Boolean(env && env.RENDER_SERVICE_ID) ||
    /^(1|true|yes|on)$/i.test(String(env?.RENDER || '').trim());
}

function resolveClientAddress(req, options = {}) {
  const env = options.env && typeof options.env === 'object' ? options.env : process.env;
  const renderRuntime = isRenderEnvironment(env) && options.isRender !== false;

  if (!renderRuntime) {
    const socketAddress = canonicalizeAddress(
      req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
    );
    if (!socketAddress) return unresolvedAddress('socket_unresolved');
    return {
      address: socketAddress,
      confidence: 'high',
      family: addressFamily(socketAddress),
      source: 'socket'
    };
  }

  const requestId = readSingleHeader(req, 'rndr-id');
  const cfRay = readSingleHeader(req, 'cf-ray');
  const cfAddressRaw = readSingleHeader(req, 'cf-connecting-ip');
  const forwardedRaw = readSingleHeader(req, 'x-forwarded-for');

  if (!validRenderRequestId(requestId) || !validCfRay(cfRay) || !cfAddressRaw || !forwardedRaw) {
    return unresolvedAddress('render_headers_unverified');
  }

  const firstForwarded = canonicalizeAddress(forwardedRaw.split(',')[0].trim());
  const cfAddress = canonicalizeAddress(cfAddressRaw);

  if (!firstForwarded || !cfAddress || firstForwarded !== cfAddress) {
    return unresolvedAddress('render_address_mismatch');
  }

  if (isPrivateOrLocalAddress(cfAddress) && options.allowLocal !== true) {
    return unresolvedAddress('render_non_public_address');
  }

  return {
    address: cfAddress,
    confidence: 'medium',
    family: addressFamily(cfAddress),
    source: 'render_verified_headers'
  };
}

function decodePathCandidates(rawPath) {
  const candidates = [];
  let current = rawPath;

  for (let index = 0; index < 3; index += 1) {
    if (!candidates.includes(current)) candidates.push(current);
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return candidates;
}

function privacySafePath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath) return '/';
  const withoutQuery = rawPath.split(/[?#]/, 1)[0] || '/';
  const candidates = decodePathCandidates(withoutQuery);
  const decoded = String(candidates[candidates.length - 1] || '/')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/');

  if (classifyPath(withoutQuery)?.event === 'PATH_TRAVERSAL_ATTEMPT') {
    return '/:path-traversal';
  }

  const normalized = `/${decoded.replace(/^\/+|\/+$/g, '')}`.toLowerCase();
  if (SAFE_EVENT_PATHS.has(normalized)) return normalized;
  if (/^\/api\/private-drops\/[^/]+$/.test(normalized)) {
    return '/api/private-drops/:id';
  }
  if (/^\/(?:\.git|\.env|wp-admin|wp-login\.php|phpmyadmin|server-status|admin)(?:\/|$)/.test(normalized)) {
    const root = normalized.split('/')[1];
    return `/${root}/:segment`;
  }
  if (/\.(?:bak|backup|old|orig|save|swp|sql|dump|zip|tar|tgz|gz)(?:\.[a-z0-9_-]+)?$/i.test(normalized)) {
    return '/:backup-file';
  }
  if (normalized.startsWith('/api/')) return '/api/:unknown';
  if (normalized.startsWith('/assets/')) return '/assets/:resource';
  return '/:path';
}

function classification(event, pathValue, overrides = {}) {
  const defaults = EVENT_DEFAULTS[event];
  const status = Object.prototype.hasOwnProperty.call(overrides, 'status')
    ? overrides.status
    : 404;
  return {
    suspicious: true,
    event,
    path: sanitizeText(pathValue, FIELD_LIMITS.path) || '/',
    severity: overrides.severity || defaults[0],
    confidence: overrides.confidence || defaults[1],
    status,
    message: overrides.message || defaults[2],
    actionTaken: overrides.actionTaken || defaults[3],
    block: overrides.block === true,
    scanCandidate: overrides.scanCandidate === true
  };
}

function classifyPath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath) return null;
  const withoutQuery = rawPath.split(/[?#]/, 1)[0] || '/';
  const candidates = decodePathCandidates(withoutQuery);

  const traversal = candidates.some((candidate) => {
    const slashed = candidate.replace(/\\/g, '/');
    return /(?:^|\/)\.\.(?:\/|$)/.test(slashed) ||
      /%(?:25)*(?:2e)(?:%(?:25)*2e|\.)(?:%(?:25)*(?:2f|5c)|[\/\\])/i.test(candidate);
  });

  if (traversal) {
    return classification('PATH_TRAVERSAL_ATTEMPT', withoutQuery, {
      block: true,
      status: 404
    });
  }

  const decodedPath = candidates[candidates.length - 1]
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();

  if (/^\/admin\/?$/.test(decodedPath)) {
    return classification('SENSITIVE_PATH_PROBE', withoutQuery, {
      severity: 'notice',
      confidence: 'low',
      status: null,
      actionTaken: 'request_observed',
      block: false,
      scanCandidate: false
    });
  }

  if (/(?:^|\/)(?:wp-admin|wp-login\.php|wordpress|phpmyadmin|pma|server-status|cgi-bin|vendor\/phpunit|actuator)(?:\/|$)/i.test(decodedPath)) {
    return classification('SENSITIVE_PATH_PROBE', withoutQuery, {
      severity: 'notice',
      confidence: 'medium',
      message: 'Common scanner path probe observed',
      actionTaken: 'not_found_response',
      block: true,
      scanCandidate: true
    });
  }

  const sensitivePath = /(?:^|\/)\.(?:env|git)(?:[/.]|$)/i.test(decodedPath) ||
    /(?:^|\/)(?:secrets?|config)(?:\/|$)/i.test(decodedPath) ||
    /(?:^|\/)(?:web\.config|appsettings(?:\.[^.\/]+)?\.json|config\.php|configuration\.php|composer\.(?:json|lock)|package(?:-lock)?\.json|firebase\.json|render\.ya?ml|docker-compose\.ya?ml)(?:\/|$)/i.test(decodedPath) ||
    /\.(?:bak|backup|old|orig|save|swp|sql|dump|zip|tar|tgz|gz)(?:\.[a-z0-9_-]+)?(?:\/|$)/i.test(decodedPath);

  if (sensitivePath) {
    return classification('SENSITIVE_PATH_PROBE', withoutQuery, {
      block: true,
      scanCandidate: true
    });
  }

  return null;
}

function createSecurityLogger(config = {}) {
  const env = config.env && typeof config.env === 'object' ? config.env : process.env;
  const enabled = parseBoolean(
    config.enabled !== undefined ? config.enabled : env.SECURITY_LOG_ENABLED,
    false
  );
  const hashKey = config.hashKey !== undefined ? config.hashKey : env.SECURITY_LOG_HASH_KEY;
  const rawIp = parseBoolean(
    config.rawIp !== undefined ? config.rawIp : env.SECURITY_LOG_RAW_IP,
    false
  );
  const configuredLevel = String(config.level || env.SECURITY_LOG_LEVEL || 'notice').toLowerCase();
  const minimumLevel = SEVERITY_RANK[configuredLevel] ? configuredLevel : 'notice';
  const windowMs = clampInteger(config.windowMs, 60_000, 100, 3_600_000);
  const dedupeMs = clampInteger(config.dedupeMs, 5_000, 0, windowMs);
  const ttlMs = clampInteger(config.ttlMs, Math.max(windowMs * 2, 120_000), windowMs, 86_400_000);
  const maxEntries = clampInteger(config.maxEntries, 1_024, 4, 100_000);
  const cleanupIntervalMs = clampInteger(
    config.cleanupIntervalMs,
    Math.min(Math.max(Math.floor(windowMs / 2), 1_000), 30_000),
    100,
    60_000
  );
  const perSourceLimit = clampInteger(
    config.limits?.perSource ?? config.limits?.perOrigin ?? config.perSourceLimit,
    40,
    1,
    100_000
  );
  const globalLimit = clampInteger(
    config.limits?.global ?? config.globalLimit,
    200,
    1,
    1_000_000
  );
  const automatedScanThreshold = clampInteger(config.automatedScanThreshold, 3, 2, 20);
  const maxScanPathsPerSource = clampInteger(
    config.maxScanPathsPerSource,
    16,
    automatedScanThreshold,
    100
  );

  const groups = new Map();
  const sourceWindows = new Map();
  const scanWindows = new Map();
  const requestContexts = new WeakMap();
  const counters = {
    emitted: 0,
    suppressed: 0,
    writeFailures: 0,
    internalErrors: 0,
    pendingSuppressed: 0
  };

  let globalWindow = { startedAt: 0, count: 0 };
  let internalErrorEmitted = false;
  let closed = false;
  let timer = null;

  const nowMs = () => {
    try {
      const value = typeof config.now === 'function' ? config.now() : Date.now();
      if (value instanceof Date) return value.getTime();
      const number = Number(value);
      return Number.isFinite(number) ? number : Date.now();
    } catch {
      return Date.now();
    }
  };

  const safeTimestamp = (milliseconds) => {
    try {
      return new Date(milliseconds).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  const chooseStream = (severity) => {
    return SEVERITY_RANK[severity] >= SEVERITY_RANK.warning ? 'stderr' : 'stdout';
  };

  const writeToTarget = (target, line) => {
    if (typeof target === 'function') {
      target(line);
      return;
    }
    if (target && typeof target.write === 'function') {
      target.write(line);
      return;
    }
    throw new Error('Security log target is unavailable');
  };

  const fallbackInternalError = () => {
    if (internalErrorEmitted || !enabled) return;
    internalErrorEmitted = true;
    counters.internalErrors += 1;

    const record = {
      timestamp: safeTimestamp(nowMs()),
      type: 'security_event',
      event: 'INTERNAL_SECURITY_ERROR',
      severity: 'error',
      confidence: 'high',
      requestId: crypto.randomUUID(),
      method: null,
      path: null,
      status: null,
      sourceId: null,
      sourceAddressMasked: null,
      sourceAddressFamily: null,
      sourceConfidence: 'low',
      userId: null,
      message: EVENT_DEFAULTS.INTERNAL_SECURITY_ERROR[2],
      actionTaken: EVENT_DEFAULTS.INTERNAL_SECURITY_ERROR[3]
    };

    const line = `${JSON.stringify(record)}\n`;
    try {
      if (typeof config.writer === 'function') {
        config.writer(line, 'stderr', record);
      } else if (config.writer && typeof config.writer === 'object') {
        writeToTarget(config.writer.stderr || config.writer, line);
      } else {
        writeToTarget(config.stderr || process.stderr, line);
      }
      counters.emitted += 1;
      return;
    } catch {
      // A custom writer may itself be the failing component. Make one bounded
      // attempt against stderr, then fail open without recursion.
    }

    try {
      writeToTarget(config.stderr || process.stderr, line);
      counters.emitted += 1;
    } catch {
      // Fail open: logging must never interrupt request handling.
    }
  };

  const writeRecord = (record) => {
    if (!enabled || closed) return false;
    const line = `${JSON.stringify(record)}\n`;
    const destination = chooseStream(record.severity);

    try {
      if (typeof config.writer === 'function') {
        config.writer(line, destination, record);
      } else if (config.writer && typeof config.writer === 'object') {
        writeToTarget(config.writer[destination] || config.writer, line);
      } else {
        const target = destination === 'stderr'
          ? (config.stderr || process.stderr)
          : (config.stdout || process.stdout);
        writeToTarget(target, line);
      }
      counters.emitted += 1;
      return true;
    } catch {
      counters.writeFailures += 1;
      fallbackInternalError();
      return false;
    }
  };

  const pruneMap = (map, timestamp, timestampField) => {
    for (const [key, entry] of map) {
      const reference = Number(entry?.[timestampField] || 0);
      if (!reference || timestamp - reference > ttlMs) map.delete(key);
    }
    while (map.size > maxEntries) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  };

  const cleanup = (timestamp = nowMs()) => {
    pruneMap(groups, timestamp, 'lastAt');
    pruneMap(sourceWindows, timestamp, 'startedAt');
    pruneMap(scanWindows, timestamp, 'startedAt');
  };

  const buildSuppressionRecord = (count, timestamp) => ({
    timestamp: safeTimestamp(timestamp),
    type: 'security_event',
    event: 'SECURITY_EVENTS_SUPPRESSED',
    severity: EVENT_DEFAULTS.SECURITY_EVENTS_SUPPRESSED[0],
    confidence: EVENT_DEFAULTS.SECURITY_EVENTS_SUPPRESSED[1],
    requestId: crypto.randomUUID(),
    method: null,
    path: null,
    status: null,
    sourceId: null,
    sourceAddressMasked: null,
    sourceAddressFamily: null,
    sourceConfidence: 'low',
    userId: null,
    message: EVENT_DEFAULTS.SECURITY_EVENTS_SUPPRESSED[2],
    actionTaken: EVENT_DEFAULTS.SECURITY_EVENTS_SUPPRESSED[3],
    count,
    windowSeconds: Math.max(1, Math.ceil(windowMs / 1_000))
  });

  const flush = () => {
    if (!enabled || closed) return 0;
    const count = counters.pendingSuppressed;
    if (!count) {
      cleanup();
      return 0;
    }
    counters.pendingSuppressed = 0;
    const record = buildSuppressionRecord(count, nowMs());
    return writeRecord(record) ? count : 0;
  };

  const markSuppressed = () => {
    counters.suppressed += 1;
    counters.pendingSuppressed += 1;
  };

  const allowByVolume = (sourceKey, timestamp) => {
    if (!globalWindow.startedAt || timestamp - globalWindow.startedAt >= windowMs) {
      if (counters.pendingSuppressed) flush();
      globalWindow = { startedAt: timestamp, count: 0 };
    }

    if (globalWindow.count >= globalLimit) return false;

    let bucket = sourceWindows.get(sourceKey);
    if (!bucket || timestamp - bucket.startedAt >= windowMs) {
      bucket = { startedAt: timestamp, count: 0 };
      sourceWindows.set(sourceKey, bucket);
      while (sourceWindows.size > maxEntries) {
        const oldestKey = sourceWindows.keys().next().value;
        if (oldestKey === undefined) break;
        sourceWindows.delete(oldestKey);
      }
    }

    if (bucket.count >= perSourceLimit) return false;
    globalWindow.count += 1;
    bucket.count += 1;
    return true;
  };

  const requestIdFor = (req) => {
    const trustedRenderId = isRenderEnvironment(env)
      ? readSingleHeader(req, 'rndr-id')
      : '';
    return validRenderRequestId(trustedRenderId)
      ? trustedRenderId
      : crypto.randomUUID();
  };

  const createContext = (req) => {
    if (req && typeof req === 'object') {
      const stored = requestContexts.get(req) || req[SECURITY_CONTEXT];
      if (stored) return stored;
    }

    const resolved = resolveClientAddress(req, { env });
    const masked = resolved.address ? maskAddress(resolved.address) : null;
    const context = Object.freeze({
      requestId: requestIdFor(req),
      address: resolved.address,
      sourceId: resolved.address ? createSourceId(resolved.address, hashKey) : null,
      sourceAddressMasked: masked?.masked || null,
      sourceAddressFamily: masked?.family || resolved.family || null,
      sourceConfidence: resolved.confidence || 'low',
      source: resolved.source || 'unresolved'
    });

    if (req && typeof req === 'object') {
      try {
        requestContexts.set(req, context);
        Object.defineProperty(req, SECURITY_CONTEXT, {
          configurable: false,
          enumerable: false,
          writable: false,
          value: context
        });
        if (!Object.prototype.hasOwnProperty.call(req, 'securityContext')) {
          Object.defineProperty(req, 'securityContext', {
            configurable: true,
            enumerable: false,
            writable: false,
            value: context
          });
        }
      } catch {
        // Frozen request-like test doubles still work through the local context.
      }
    }

    return context;
  };

  const safePathFromRequest = (req) => {
    const raw = typeof req?.originalUrl === 'string'
      ? req.originalUrl
      : typeof req?.url === 'string'
        ? req.url
        : typeof req?.path === 'string'
          ? req.path
          : '/';
    return sanitizeText(privacySafePath(raw), FIELD_LIMITS.path) || '/';
  };

  const pseudonymousUserId = (req, fields) => {
    const candidate = fields.userId ?? req?.firebaseUser?.uid ?? null;
    if (typeof candidate !== 'string' || !candidate.trim() || !validHashKey(hashKey)) return null;
    if (/^hmac:[a-f0-9]{64}$/i.test(candidate.trim())) return candidate.trim().toLowerCase();
    try {
      return `hmac:${crypto.createHmac('sha256', hashKey)
        .update(`user\u0000${candidate.trim()}`, 'utf8')
        .digest('hex')}`;
    } catch {
      return null;
    }
  };

  const buildRecord = (req, eventName, fields, timestamp) => {
    const defaults = EVENT_DEFAULTS[eventName];
    const context = createContext(req);
    const requestedSeverity = String(fields.severity || '').toLowerCase();
    const severity = SEVERITY_RANK[requestedSeverity] ? requestedSeverity : defaults[0];
    const requestedConfidence = String(fields.confidence || '').toLowerCase();
    const confidence = CONFIDENCE_VALUES.has(requestedConfidence) ? requestedConfidence : defaults[1];
    const statusNumber = Number(fields.status);

    const record = {
      timestamp: safeTimestamp(timestamp),
      type: 'security_event',
      event: eventName,
      severity,
      confidence,
      requestId: sanitizeText(context.requestId, FIELD_LIMITS.requestId),
      method: sanitizeText(req?.method || '', FIELD_LIMITS.method).toUpperCase() || null,
      path: safePathFromRequest(req),
      status: Number.isInteger(statusNumber) && statusNumber >= 100 && statusNumber <= 599
        ? statusNumber
        : null,
      sourceId: context.sourceId,
      sourceAddressMasked: context.sourceAddressMasked,
      sourceAddressFamily: context.sourceAddressFamily,
      sourceConfidence: context.sourceConfidence,
      userId: pseudonymousUserId(req, fields),
      message: sanitizeText(fields.message || defaults[2], FIELD_LIMITS.message),
      actionTaken: sanitizeText(fields.actionTaken || defaults[3], FIELD_LIMITS.actionTaken)
    };

    if (rawIp && (severity === 'error' || severity === 'critical') && context.address) {
      record.sourceAddressRaw = context.address;
    }

    return record;
  };

  const event = (req, eventName, fields = {}) => {
    if (!enabled || closed) return false;
    if (!EVENT_NAME_SET.has(eventName)) {
      fallbackInternalError();
      return false;
    }

    try {
      const safeFields = fields && typeof fields === 'object' && !(fields instanceof Error)
        ? fields
        : {};
      const timestamp = nowMs();
      cleanup(timestamp);
      const record = buildRecord(req, eventName, safeFields, timestamp);

      if (SEVERITY_RANK[record.severity] < SEVERITY_RANK[minimumLevel]) return false;

      const sourceKey = record.sourceId || record.sourceAddressMasked || 'unresolved';
      const groupKey = `${eventName}\u0000${sourceKey}\u0000${record.path || ''}`;
      const previous = groups.get(groupKey);

      if (previous && timestamp - previous.lastAt <= dedupeMs) {
        previous.lastAt = timestamp;
        previous.suppressed += 1;
        markSuppressed();
        return false;
      }

      if (!allowByVolume(sourceKey, timestamp)) {
        if (previous) previous.lastAt = timestamp;
        markSuppressed();
        return false;
      }

      groups.set(groupKey, {
        firstAt: previous?.firstAt || timestamp,
        lastAt: timestamp,
        suppressed: previous?.suppressed || 0
      });
      while (groups.size > maxEntries) {
        const oldestKey = groups.keys().next().value;
        if (oldestKey === undefined) break;
        groups.delete(oldestKey);
      }

      return writeRecord(record);
    } catch {
      fallbackInternalError();
      return false;
    }
  };

  const observeScanCandidate = (req, pathClassification) => {
    if (!pathClassification?.scanCandidate) return;

    const timestamp = nowMs();
    const context = createContext(req);
    if (!context.sourceId) return;
    const sourceKey = context.sourceId;
    let bucket = scanWindows.get(sourceKey);

    if (!bucket || timestamp - bucket.startedAt >= windowMs) {
      bucket = {
        startedAt: timestamp,
        paths: new Set(),
        automatedEventEmitted: false
      };
      scanWindows.set(sourceKey, bucket);
      while (scanWindows.size > maxEntries) {
        const oldestKey = scanWindows.keys().next().value;
        if (oldestKey === undefined) break;
        scanWindows.delete(oldestKey);
      }
    }

    const pathFingerprint = crypto
      .createHash('sha256')
      .update(pathClassification.path || '/', 'utf8')
      .digest('hex');

    if (bucket.paths.size < maxScanPathsPerSource) bucket.paths.add(pathFingerprint);
    if (bucket.automatedEventEmitted || bucket.paths.size < automatedScanThreshold) return;

    bucket.automatedEventEmitted = true;
    event(req, 'AUTOMATED_SCAN_PATTERN', {
      severity: 'warning',
      confidence: 'medium',
      status: pathClassification.status || 404,
      message: EVENT_DEFAULTS.AUTOMATED_SCAN_PATTERN[2],
      actionTaken: 'requests_grouped'
    });
  };

  const middleware = () => {
    return function securityLoggingMiddleware(req, res, next) {
      if (!enabled || closed) return next();
      if (req && req[SECURITY_MIDDLEWARE_SEEN]) return next();

      try {
        if (req && typeof req === 'object') {
          Object.defineProperty(req, SECURITY_MIDDLEWARE_SEEN, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: true
          });
        }

        const context = createContext(req);
        if (res && typeof res.setHeader === 'function') {
          res.setHeader('X-Request-Id', context.requestId);
          if (isRenderEnvironment(env) && validRenderRequestId(readSingleHeader(req, 'rndr-id'))) {
            res.setHeader('Rndr-Id', context.requestId);
          }
        }

        const pathClassification = classifyPath(req?.originalUrl || req?.url || req?.path || '');
        if (pathClassification) {
          event(req, pathClassification.event, pathClassification);
          observeScanCandidate(req, pathClassification);
          if (config.blockSuspiciousPaths === true && pathClassification.block && res && !res.headersSent) {
            if (typeof res.status === 'function' && typeof res.send === 'function') {
              return res.status(pathClassification.status || 404).send('Not Found');
            }
            res.statusCode = pathClassification.status || 404;
            if (typeof res.end === 'function') return res.end('Not Found');
          }
        }
      } catch {
        fallbackInternalError();
      }

      return next();
    };
  };

  const close = () => {
    if (closed) return 0;
    const flushed = flush();
    closed = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    groups.clear();
    sourceWindows.clear();
    scanWindows.clear();
    return flushed;
  };

  const stats = () => ({
    enabled: enabled ? 1 : 0,
    closed: closed ? 1 : 0,
    emitted: counters.emitted,
    suppressed: counters.suppressed,
    pendingSuppressed: counters.pendingSuppressed,
    writeFailures: counters.writeFailures,
    internalErrors: counters.internalErrors,
    groups: groups.size,
    sourceBuckets: sourceWindows.size,
    scanBuckets: scanWindows.size,
    globalCount: globalWindow.count,
    maxEntries,
    entryCount: groups.size,
    sourceCount: sourceWindows.size,
    suppressedCount: counters.suppressed
  });

  if (enabled) {
    timer = setInterval(() => {
      try {
        cleanup();
        if (counters.pendingSuppressed) flush();
      } catch {
        fallbackInternalError();
      }
    }, cleanupIntervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    if (!validHashKey(hashKey)) fallbackInternalError();
  }

  return Object.freeze({
    middleware,
    event,
    flush,
    close,
    stats
  });
}

module.exports = {
  EVENT_NAMES,
  createSecurityLogger,
  resolveClientAddress,
  maskAddress,
  createSourceId,
  sanitizeText,
  classifyPath
};
