'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CAPTURE_LIMIT_BYTES = 4 * 1024 * 1024;
const RESPONSE_LIMIT_BYTES = 256 * 1024;
const TEST_HASH_KEY = 'prophetia-security-validation-key-not-a-secret-2026';
const TEST_STRIPE_KEY = 'SECURITY_VALIDATION_STRIPE_PLACEHOLDER';
const SENTINELS = Object.freeze({
  password: 'VALIDATION_PASSWORD_SENTINEL_DO_NOT_LOG',
  token: 'VALIDATION_TOKEN_SENTINEL_DO_NOT_LOG',
  cookie: 'VALIDATION_COOKIE_SENTINEL_DO_NOT_LOG',
  email: 'security-logging-validation@example.invalid',
  forwardedAddress: '198.51.100.77'
});

function encodeEveryPathByte(value) {
  return [...Buffer.from(String(value), 'utf8')]
    .map((byte) => `%${byte.toString(16).padStart(2, '0').toUpperCase()}`)
    .join('');
}

const ENCODED_SENTINELS = Object.freeze({
  password: encodeEveryPathByte(SENTINELS.password),
  token: encodeEveryPathByte(SENTINELS.token),
  cookie: encodeEveryPathByte(SENTINELS.cookie),
  email: encodeEveryPathByte(SENTINELS.email)
});

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prophetia-security-logging-'));

Object.assign(process.env, {
  NODE_ENV: 'test',
  SITE_URL: 'http://127.0.0.1',
  SALES_ENABLED: 'false',
  CHECKOUT_ENABLED: 'false',
  DATA_DIR: testDataDir,
  FIREBASE_ADMIN_CREDENTIALS: path.join(testDataDir, 'missing-firebase-admin.json'),
  STRIPE_SECRET_KEY: TEST_STRIPE_KEY,
  STRIPE_WEBHOOK_SECRET: 'SECURITY_VALIDATION_WEBHOOK_PLACEHOLDER',
  RESEND_API_KEY: 'SECURITY_VALIDATION_EMAIL_PROVIDER_PLACEHOLDER',
  SECURITY_LOG_ENABLED: 'true',
  SECURITY_LOG_HASH_KEY: TEST_HASH_KEY,
  SECURITY_LOG_RAW_IP: 'false',
  SECURITY_LOG_LEVEL: 'notice'
});

// A local validation must never opt into the Render proxy trust boundary.
delete process.env.RENDER_SERVICE_ID;
delete process.env.RENDER;

function createBoundedCapture(limitBytes) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;

  return {
    append(value, encoding) {
      const chunk = Buffer.isBuffer(value)
        ? value
        : Buffer.from(String(value), typeof encoding === 'string' ? encoding : 'utf8');
      const available = Math.max(0, limitBytes - bytes);
      if (chunk.length > available) truncated = true;
      if (available > 0) {
        const stored = chunk.subarray(0, available);
        chunks.push(stored);
        bytes += stored.length;
      }
    },
    text() {
      return Buffer.concat(chunks, bytes).toString('utf8');
    },
    isTruncated() {
      return truncated;
    }
  };
}

function captureStream(stream, capture) {
  const originalWrite = stream.write;

  stream.write = function capturedWrite(chunk, encoding, callback) {
    capture.append(chunk, encoding);
    const done = typeof encoding === 'function'
      ? encoding
      : typeof callback === 'function'
        ? callback
        : null;
    if (done) queueMicrotask(done);
    return true;
  };

  return () => {
    stream.write = originalWrite;
  };
}

function securityEventsFrom(text) {
  const events = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean.startsWith('{') || !clean.endsWith('}')) continue;
    try {
      const parsed = JSON.parse(clean);
      if (parsed && parsed.type === 'security_event') events.push(parsed);
    } catch {
      // Operational output can contain non-JSON lines; never echo them here.
    }
  }
  return events;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

function waitForLogging() {
  return new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
}

function localRequest(baseUrl, pathname, options = {}) {
  const base = new URL(baseUrl);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body === undefined || options.body === null
    ? null
    : Buffer.from(String(options.body), 'utf8');
  const headers = { ...(options.headers || {}) };
  if (body && headers['Content-Length'] === undefined && headers['content-length'] === undefined) {
    headers['Content-Length'] = String(body.length);
  }

  return new Promise((resolve, reject) => {
    const request = http.request({
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: Number(base.port),
      method,
      path: pathname,
      headers,
      agent: false
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        const available = Math.max(0, RESPONSE_LIMIT_BYTES - bytes);
        if (available <= 0) return;
        const stored = Buffer.from(chunk).subarray(0, available);
        chunks.push(stored);
        bytes += stored.length;
      });
      response.on('end', () => {
        resolve({
          status: Number(response.statusCode || 0),
          headers: response.headers,
          body: Buffer.concat(chunks, bytes).toString('utf8')
        });
      });
    });

    request.setTimeout(5_000, () => request.destroy(new Error('request_timeout')));
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function requestLike(pathname = '/unit/security', headers = {}, remoteAddress = '127.0.0.1') {
  return {
    method: 'GET',
    originalUrl: pathname,
    url: pathname,
    path: pathname,
    headers,
    socket: { remoteAddress },
    connection: { remoteAddress },
    app: { get: () => false }
  };
}

function findCartFixture() {
  const catalog = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'public', 'assets', 'data', 'catalog.json'),
    'utf8'
  ));

  for (const product of catalog) {
    if (!product || product.active === false || !Array.isArray(product.variants)) continue;
    const variant = product.variants.find((candidate) => {
      return candidate && String(candidate.sku || '').trim() && Number(candidate.stock || 0) > 0;
    });
    if (!variant) continue;

    const versions = Array.isArray(product.versions) ? product.versions : [];
    const version = versions.find((candidate) => {
      const versionCut = String(candidate?.cut || '').trim().toLowerCase();
      const variantCut = String(variant.cut || '').trim().toLowerCase();
      return !versionCut || !variantCut || versionCut === variantCut;
    }) || versions[0] || null;
    const canonicalPrice = Number(version?.price ?? product.price);
    if (!Number.isFinite(canonicalPrice) || canonicalPrice <= 0) continue;

    return {
      id: String(product.id || '').trim(),
      slug: String(product.slug || '').trim(),
      sku: String(variant.sku || '').trim(),
      cut: variant.cut ? String(variant.cut).trim() : null,
      version: version?.id ? String(version.id).trim() : null,
      color: variant.color ? String(variant.color).trim() : '',
      size: variant.size ? String(variant.size).trim() : '',
      qty: 1,
      canonicalPrice
    };
  }

  throw new Error('cart_fixture_unavailable');
}

function makeWriter(records, options = {}) {
  return (line, destination, record) => {
    if (options.throwOnWrite) throw new Error('synthetic_writer_failure');
    if (record && typeof record === 'object') {
      records.push({ ...record, destination });
      return;
    }
    try {
      const parsed = JSON.parse(String(line).trim());
      records.push({ ...parsed, destination });
    } catch {
      throw new Error('writer_received_non_json');
    }
  };
}

async function run() {
  const stdoutCapture = createBoundedCapture(CAPTURE_LIMIT_BYTES);
  const stderrCapture = createBoundedCapture(CAPTURE_LIMIT_BYTES);
  const restoreStdout = captureStream(process.stdout, stdoutCapture);
  const restoreStderr = captureStream(process.stderr, stderrCapture);
  const failures = [];
  const passed = new Set();
  const standaloneLoggers = [];
  let appServer = null;

  const expect = (condition, code) => {
    if (!condition) throw new Error(String(code || 'expectation_failed'));
  };

  const verify = async (number, label, callback) => {
    try {
      await callback();
      passed.add(number);
    } catch (error) {
      const safeCode = /^[a-z0-9_.:-]{1,100}$/i.test(String(error?.message || ''))
        ? error.message
        : 'unexpected_failure';
      failures.push(`${number}:${label}:${safeCode}`);
    }
  };

  const capturedText = () => `${stdoutCapture.text()}\n${stderrCapture.text()}`;
  const events = () => securityEventsFrom(capturedText());
  const countEvent = (name) => events().filter((entry) => entry.event === name).length;
  const latestEvent = (name) => events().filter((entry) => entry.event === name).at(-1) || null;
  const noNewEvents = async (callback) => {
    const before = events().length;
    const result = await callback();
    await waitForLogging();
    expect(events().length === before, 'unexpected_security_event');
    return result;
  };
  const expectHttpEvent = async (eventName, callback) => {
    const before = countEvent(eventName);
    const response = await callback();
    await waitForLogging();
    expect(countEvent(eventName) > before, `missing_${eventName.toLowerCase()}`);
    return { response, event: latestEvent(eventName) };
  };

  try {
    const {
      createSecurityLogger,
      resolveClientAddress,
      maskAddress,
      createSourceId,
      sanitizeText,
      classifyPath
    } = require('../lib/security-logger');
    const { app, CHECKOUT_ENABLED } = require('../server');

    expect(typeof createSecurityLogger === 'function', 'missing_create_security_logger');
    expect(typeof resolveClientAddress === 'function', 'missing_resolve_client_address');
    expect(typeof maskAddress === 'function', 'missing_mask_address');
    expect(typeof createSourceId === 'function', 'missing_create_source_id');
    expect(typeof sanitizeText === 'function', 'missing_sanitize_text');
    expect(typeof classifyPath === 'function', 'missing_classify_path');

    appServer = app.listen(0, '127.0.0.1');
    await listen(appServer);
    const address = appServer.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await waitForLogging();

    let baselineSourceId = null;

    await verify(1, 'normal_request_has_no_alert', async () => {
      const response = await noNewEvents(() => localRequest(baseUrl, '/api/storefront-config'));
      expect(response.status === 200, 'normal_request_status');
      expect(typeof response.headers['x-request-id'] === 'string', 'missing_response_request_id');
    });

    await verify(2, 'health_has_no_alert', async () => {
      const canonical = await noNewEvents(() => localRequest(baseUrl, '/api/health'));
      expect(canonical.status === 200, 'canonical_health_status');
      const compatibility = await noNewEvents(() => localRequest(baseUrl, '/health'));
      expect(compatibility.status === 200 || compatibility.status === 404, 'health_status');
    });

    await verify(3, 'env_probe', async () => {
      const classified = classifyPath('/.env');
      expect(classified?.event === 'SENSITIVE_PATH_PROBE', 'env_classification');
      expect(classified?.block === true, 'env_probe_not_blocked');
      const realAdmin = classifyPath('/admin');
      expect(realAdmin?.block === false && realAdmin?.status === null, 'real_admin_misclassified');
      const result = await expectHttpEvent('SENSITIVE_PATH_PROBE', () => {
        return localRequest(baseUrl, '/.env');
      });
      expect(result.response.status === 404, 'env_probe_status');
      baselineSourceId = result.event?.sourceId || null;
    });

    await verify(4, 'git_probe', async () => {
      const classified = classifyPath('/.git/config');
      expect(classified?.event === 'SENSITIVE_PATH_PROBE', 'git_classification');
      expect(classified?.block === true, 'git_probe_not_blocked');
      const result = await expectHttpEvent('SENSITIVE_PATH_PROBE', () => {
        return localRequest(baseUrl, '/.git/config');
      });
      expect(result.response.status === 404, 'git_probe_status');
    });

    await verify(5, 'path_traversal', async () => {
      const rawPath = '/%252e%252e%252fetc%252fpasswd';
      const classified = classifyPath(rawPath);
      expect(classified?.event === 'PATH_TRAVERSAL_ATTEMPT', 'traversal_classification');
      const result = await expectHttpEvent('PATH_TRAVERSAL_ATTEMPT', () => {
        return localRequest(baseUrl, rawPath);
      });
      expect(result.response.status >= 400 && result.response.status < 500, 'traversal_status');
    });

    await verify(6, 'malformed_json', async () => {
      const invalidContentType = await expectHttpEvent('INVALID_CONTENT_TYPE', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: '{}'
        });
      });
      expect(invalidContentType.response.status === 415, 'invalid_content_type_status');

      const unsupportedCharset = await expectHttpEvent('INVALID_CONTENT_TYPE', () => {
        return localRequest(baseUrl, '/api/shipping-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=iso-8859-1' },
          body: '{}'
        });
      });
      expect(unsupportedCharset.response.status === 415, 'unsupported_charset_status');

      const malformed = `{"password":"${SENTINELS.password}",`;
      const result = await expectHttpEvent('MALFORMED_JSON', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: malformed
        });
      });
      expect(result.response.status === 400, 'malformed_json_status');
    });

    await verify(7, 'payload_too_large', async () => {
      const oversized = JSON.stringify({
        blob: 'x'.repeat(90 * 1024),
        token: SENTINELS.token
      });
      const result = await expectHttpEvent('PAYLOAD_TOO_LARGE', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: oversized
        });
      });
      expect(result.response.status === 413, 'payload_too_large_status');
    });

    await verify(8, 'method_not_allowed', async () => {
      const result = await expectHttpEvent('METHOD_NOT_ALLOWED', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
      });
      expect(result.response.status === 405, 'method_not_allowed_status');
    });

    await verify(9, 'rate_limit_exceeded', async () => {
      const before = countEvent('RATE_LIMIT_EXCEEDED');
      let lastStatus = 0;
      for (let index = 0; index < 9; index += 1) {
        const response = await localRequest(baseUrl, '/api/tribe/subscribe');
        lastStatus = response.status;
      }
      await waitForLogging();
      expect(lastStatus === 429, 'rate_limit_status');
      expect(countEvent('RATE_LIMIT_EXCEEDED') > before, 'missing_rate_limit_event');

      let probeStatus = 0;
      for (let index = 0; index < 61; index += 1) {
        const response = await localRequest(baseUrl, '/wp-admin/probe-limit');
        probeStatus = response.status;
      }
      await waitForLogging();
      expect(probeStatus === 429, 'probe_rate_limit_status');
    });

    let checkoutResponse = null;
    await verify(10, 'checkout_disabled_access', async () => {
      const result = await expectHttpEvent('CHECKOUT_DISABLED_ACCESS', () => {
        return localRequest(baseUrl, '/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
      });
      checkoutResponse = result.response;
      expect(result.response.status === 503, 'checkout_disabled_status');
    });

    const fixture = findCartFixture();
    const sensitiveHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SENTINELS.token}`,
      Cookie: `session=${SENTINELS.cookie}`,
      'X-Forwarded-For': SENTINELS.forwardedAddress,
      'CF-Connecting-IP': SENTINELS.forwardedAddress,
      'True-Client-IP': SENTINELS.forwardedAddress
    };

    await verify(11, 'price_tampering', async () => {
      const body = JSON.stringify({
        cart: [{
          ...fixture,
          price: fixture.canonicalPrice + 123.45,
          unitPrice: fixture.canonicalPrice + 123.45
        }],
        email: SENTINELS.email,
        password: SENTINELS.password,
        shippingDetails: null
      });
      const result = await expectHttpEvent('PRICE_TAMPERING_ATTEMPT', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: sensitiveHeaders,
          body
        });
      });
      expect(result.response.status === 200, 'price_tampering_safe_status');
      const responseBody = JSON.parse(result.response.body || '{}');
      const serverPrice = Number(responseBody?.items?.[0]?.unitPrice);
      expect(Number.isFinite(serverPrice), 'missing_canonical_price');
      expect(Math.abs(serverPrice - fixture.canonicalPrice) < 0.001, 'client_price_was_used');
    });

    await verify(12, 'invalid_sku', async () => {
      const body = JSON.stringify({
        cart: [{ ...fixture, sku: 'SECURITY-VALIDATION-INVALID-SKU' }],
        email: SENTINELS.email,
        password: SENTINELS.password,
        shippingDetails: null
      });
      const result = await expectHttpEvent('INVALID_SKU', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: sensitiveHeaders,
          body
        });
      });
      expect(result.response.status === 400, 'invalid_sku_status');

      const invalidQuantity = await expectHttpEvent('INVALID_QUANTITY', () => {
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: [{ ...fixture, qty: 11 }] })
        });
      });
      expect(invalidQuantity.response.status === 400, 'invalid_quantity_status');

      const invalidVariant = await expectHttpEvent('INVALID_VARIANT', () => {
        const item = {
          ...fixture,
          sku: '',
          color: 'SECURITY-VALIDATION-INVALID-COLOR',
          size: 'SECURITY-VALIDATION-INVALID-SIZE'
        };
        return localRequest(baseUrl, '/api/cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: [item] })
        });
      });
      expect(invalidVariant.response.status === 400, 'invalid_variant_status');
    });

    await verify(13, 'passwords_are_not_logged', async () => {
      await localRequest(
        baseUrl,
        `/wp-admin/${SENTINELS.password}/${SENTINELS.token}`
      );
      await localRequest(
        baseUrl,
        `/phpmyadmin/${ENCODED_SENTINELS.email}/${ENCODED_SENTINELS.cookie}/${ENCODED_SENTINELS.password}/${ENCODED_SENTINELS.token}`
      );
      await waitForLogging();
      expect(!capturedText().includes(SENTINELS.password), 'password_leaked');
      expect(
        !capturedText().includes(ENCODED_SENTINELS.password),
        'encoded_password_leaked'
      );
    });

    await verify(14, 'tokens_are_not_logged', async () => {
      expect(!capturedText().includes(SENTINELS.token), 'token_leaked');
      expect(!capturedText().includes(ENCODED_SENTINELS.token), 'encoded_token_leaked');
    });

    await verify(15, 'cookies_are_not_logged', async () => {
      expect(!capturedText().includes(SENTINELS.cookie), 'cookie_leaked');
      expect(!capturedText().includes(ENCODED_SENTINELS.cookie), 'encoded_cookie_leaked');
    });

    await verify(16, 'emails_are_not_logged', async () => {
      expect(!capturedText().includes(SENTINELS.email), 'email_leaked');
      expect(!capturedText().includes(ENCODED_SENTINELS.email), 'encoded_email_leaked');
    });

    await verify(17, 'raw_ip_is_not_logged', async () => {
      const masked = maskAddress('198.51.100.77');
      expect(masked?.masked === '198.51.100.xxx', 'ipv4_mask');
      const serializedEvents = JSON.stringify(events());
      expect(!serializedEvents.includes('127.0.0.1'), 'local_raw_ip_leaked');
      expect(!serializedEvents.includes(SENTINELS.forwardedAddress), 'forwarded_raw_ip_leaked');
      expect(!events().some((entry) => Object.hasOwn(entry, 'sourceAddressRaw')), 'raw_ip_field_present');
    });

    await verify(18, 'source_id_is_stable', async () => {
      const first = createSourceId('127.0.0.1', TEST_HASH_KEY);
      const second = createSourceId('127.0.0.1', TEST_HASH_KEY);
      expect(typeof first === 'string' && first.startsWith('hmac:'), 'source_id_format');
      expect(first === second, 'source_id_not_stable');
      expect(!baselineSourceId || baselineSourceId === first, 'http_source_id_not_stable');
    });

    await verify(19, 'source_id_is_one_way', async () => {
      const addressValue = '198.51.100.77';
      const sourceId = createSourceId(addressValue, TEST_HASH_KEY);
      const otherKeyId = createSourceId(addressValue, `${TEST_HASH_KEY}-rotated`);
      const plainHash = crypto.createHash('sha256').update(addressValue).digest('hex');
      expect(typeof sourceId === 'string' && !sourceId.includes(addressValue), 'source_id_contains_address');
      expect(sourceId !== `hmac:${plainHash}` && sourceId !== plainHash, 'source_id_is_plain_hash');
      expect(sourceId !== otherKeyId, 'source_id_ignores_key');
    });

    await verify(20, 'crlf_is_sanitized', async () => {
      const clean = sanitizeText('line one\r\nline two\u0000tail', 80);
      expect(!/[\r\n\u0000]/.test(clean), 'control_character_remained');
      expect(clean.includes('line one') && clean.includes('line two'), 'sanitized_text_lost');
    });

    await verify(21, 'long_fields_are_truncated', async () => {
      const clean = sanitizeText('x'.repeat(5_000), 64);
      expect(clean.length === 64, 'sanitize_length_limit');

      const records = [];
      const logger = createSecurityLogger({
        enabled: true,
        hashKey: TEST_HASH_KEY,
        level: 'notice',
        writer: makeWriter(records)
      });
      standaloneLoggers.push(logger);
      logger.event(requestLike('/unit/long-field'), 'INPUT_VALIDATION_FAILURE', {
        message: 'm'.repeat(5_000),
        actionTaken: 'a'.repeat(5_000)
      });
      expect(records.length === 1, 'long_field_event_missing');
      expect(records[0].message.length <= 320, 'message_not_truncated');
      expect(records[0].actionTaken.length <= 80, 'action_not_truncated');
    });

    await verify(22, 'spoofed_headers_are_ignored', async () => {
      const fakeHeaders = {
        'x-forwarded-for': SENTINELS.forwardedAddress,
        'cf-connecting-ip': SENTINELS.forwardedAddress,
        'true-client-ip': SENTINELS.forwardedAddress,
        'rndr-id': 'req-spoofed-validation',
        'cf-ray': '1234567890abcdef-MAD'
      };
      const resolved = resolveClientAddress(
        requestLike('/unit/spoof', fakeHeaders, '127.0.0.1'),
        { env: { NODE_ENV: 'test' } }
      );
      expect(resolved.address === '127.0.0.1', 'spoof_overrode_socket');
      expect(resolved.source === 'socket', 'local_source_not_socket');

      const renderEnv = { RENDER_SERVICE_ID: 'srv-security-validation' };
      const missingRenderMarkers = resolveClientAddress(
        requestLike('/unit/render-missing', {}, '10.0.0.4'),
        { env: renderEnv }
      );
      expect(missingRenderMarkers.address === null, 'render_missing_markers_trusted');
      expect(missingRenderMarkers.confidence === 'low', 'render_missing_markers_confidence');

      const coherentHeaders = {
        'rndr-id': 'req-security-validation',
        'cf-ray': '1234567890abcdef-MAD',
        'cf-connecting-ip': SENTINELS.forwardedAddress,
        'x-forwarded-for': SENTINELS.forwardedAddress
      };
      const coherentRender = resolveClientAddress(
        requestLike('/unit/render-valid', coherentHeaders, '10.0.0.4'),
        { env: renderEnv }
      );
      expect(coherentRender.address === SENTINELS.forwardedAddress, 'render_coherent_headers_rejected');
      expect(coherentRender.confidence === 'medium', 'render_coherent_confidence');

      const mismatchedRender = resolveClientAddress(
        requestLike('/unit/render-mismatch', {
          ...coherentHeaders,
          'x-forwarded-for': '203.0.113.18'
        }, '10.0.0.4'),
        { env: renderEnv }
      );
      expect(mismatchedRender.address === null, 'render_mismatch_trusted');

      const injectedList = resolveClientAddress(
        requestLike('/unit/render-list', {
          ...coherentHeaders,
          'x-forwarded-for': `203.0.113.18, ${SENTINELS.forwardedAddress}`
        }, '10.0.0.4'),
        { env: renderEnv }
      );
      expect(injectedList.address === null, 'render_forwarded_list_injection_trusted');

      const result = await expectHttpEvent('SENSITIVE_PATH_PROBE', () => {
        return localRequest(baseUrl, '/admin', { headers: fakeHeaders });
      });
      expect(result.response.status === 200, 'spoof_probe_status');
      expect(!baselineSourceId || result.event?.sourceId === baselineSourceId, 'spoof_changed_http_source');
    });

    await verify(23, 'events_are_aggregated', async () => {
      const records = [];
      const logger = createSecurityLogger({
        enabled: true,
        hashKey: TEST_HASH_KEY,
        level: 'notice',
        windowMs: 60_000,
        dedupeMs: 60_000,
        limits: { perSource: 1_000, global: 1_000 },
        writer: makeWriter(records),
        now: () => 1_750_000_000_000
      });
      standaloneLoggers.push(logger);
      const req = requestLike('/unit/repeated');
      for (let index = 0; index < 25; index += 1) {
        logger.event(req, 'SENSITIVE_PATH_PROBE');
      }
      const suppressed = logger.flush();
      const summary = records.find((entry) => entry.event === 'SECURITY_EVENTS_SUPPRESSED');
      expect(records.filter((entry) => entry.event === 'SENSITIVE_PATH_PROBE').length === 1, 'dedupe_failed');
      expect(Number(suppressed) >= 24, 'suppressed_count');
      expect(Number(summary?.count) >= 24, 'suppression_summary_missing');

      const scanRecords = [];
      const scanLogger = createSecurityLogger({
        enabled: true,
        hashKey: TEST_HASH_KEY,
        level: 'notice',
        writer: makeWriter(scanRecords)
      });
      standaloneLoggers.push(scanLogger);
      const scanMiddleware = scanLogger.middleware();
      for (const pathname of ['/wp-admin/probe-a', '/phpmyadmin/probe-b', '/.env/probe-c']) {
        scanMiddleware(requestLike(pathname), { setHeader() {} }, () => {});
      }
      expect(
        scanRecords.some((entry) => entry.event === 'AUTOMATED_SCAN_PATTERN'),
        'automated_scan_aggregation_missing'
      );
    });

    await verify(24, 'logger_memory_is_bounded', async () => {
      let clock = 1_750_000_000_000;
      const logger = createSecurityLogger({
        enabled: true,
        hashKey: TEST_HASH_KEY,
        level: 'notice',
        maxEntries: 16,
        dedupeMs: 0,
        limits: { perSource: 100_000, global: 100_000 },
        writer: () => {},
        now: () => clock++
      });
      standaloneLoggers.push(logger);
      const memoryMiddleware = logger.middleware();
      for (let index = 0; index < 5_000; index += 1) {
        const req = requestLike(
          `/wp-admin/probe-${index}`,
          {},
          `2001:db8::${(index + 1).toString(16)}`
        );
        memoryMiddleware(req, { setHeader() {} }, () => {});
      }
      const stats = logger.stats();
      expect(stats.groups <= 16, 'event_groups_unbounded');
      expect(stats.sourceBuckets <= 16, 'source_buckets_unbounded');
      expect(stats.scanBuckets <= 16, 'scan_buckets_unbounded');
      expect(stats.maxEntries === 16, 'max_entries_not_applied');
    });

    await verify(25, 'logger_failure_does_not_stop_app', async () => {
      const failingLogger = createSecurityLogger({
        enabled: true,
        hashKey: TEST_HASH_KEY,
        level: 'notice',
        writer: makeWriter([], { throwOnWrite: true }),
        stderr: { write: () => true }
      });
      standaloneLoggers.push(failingLogger);

      const localServer = http.createServer((req, res) => {
        try {
          failingLogger.event(req, 'PATH_TRAVERSAL_ATTEMPT', { status: 404 });
          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 500;
          res.end();
        }
      });
      localServer.listen(0, '127.0.0.1');
      await listen(localServer);
      try {
        const localAddress = localServer.address();
        const response = await localRequest(
          `http://127.0.0.1:${localAddress.port}`,
          '/unit/failing-writer'
        );
        expect(response.status === 204, 'writer_failure_broke_request');
        expect(failingLogger.stats().writeFailures >= 1, 'writer_failure_not_recorded');
      } finally {
        await closeServer(localServer);
      }
    });

    await verify(26, 'checkout_remains_disabled', async () => {
      expect(CHECKOUT_ENABLED === false, 'checkout_export_enabled');
      expect(process.env.CHECKOUT_ENABLED === 'false', 'checkout_env_enabled');
      expect(checkoutResponse?.status === 503, 'checkout_gate_not_preserved');
    });

    await verify(27, 'no_order_is_created', async () => {
      expect(
        !fs.existsSync(path.join(testDataDir, 'orders.json')),
        'orders_file_created'
      );
    });

    await verify(28, 'stripe_live_is_inactive', async () => {
      expect(process.env.STRIPE_SECRET_KEY === TEST_STRIPE_KEY, 'unexpected_stripe_key');
      expect(!/live/i.test(process.env.STRIPE_SECRET_KEY), 'stripe_live_key_active');
      expect(CHECKOUT_ENABLED === false && checkoutResponse?.status === 503, 'stripe_route_reachable');
    });

    if (stdoutCapture.isTruncated() || stderrCapture.isTruncated()) {
      failures.push('capture:bounded_output:output_exceeded_capture_limit');
    }
  } catch (error) {
    const safeCode = /^[a-z0-9_.:\/-]{1,120}$/i.test(String(error?.message || ''))
      ? error.message
      : 'setup_failure';
    failures.push(`setup:${safeCode}`);
  } finally {
    for (const logger of standaloneLoggers) {
      try {
        logger.close();
      } catch {
        // Cleanup must not hide the validation result.
      }
    }
    await closeServer(appServer);
    restoreStdout();
    restoreStderr();

    const resolvedTemp = path.resolve(testDataDir);
    const resolvedOsTemp = path.resolve(os.tmpdir());
    if (resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`)) {
      fs.rmSync(resolvedTemp, { recursive: true, force: true });
    }
  }

  if (failures.length) {
    throw new Error(`Validación de seguridad fallida: ${failures.join(', ')}`);
  }

  if (passed.size !== 28) {
    throw new Error(`Validación de seguridad incompleta: ${passed.size}/28 comprobaciones.`);
  }

  console.log('Registro de seguridad verificado: 28 comprobaciones locales, checkout bloqueado y 0 pedidos creados.');
}

run().catch((error) => {
  console.error(String(error?.message || 'Validación de seguridad fallida.'));
  process.exitCode = 1;
});
