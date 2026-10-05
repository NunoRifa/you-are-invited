import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  guardTurnstile,
  resolveTurnstileConfig,
  verifyTurnstile,
  clientIpFromHeaders,
} from './turnstile.js';

const TEST_SECRET = '1x0000000000000000000000000000000AA';
const ORIGINAL_ENV = { ...process.env };

function mockSiteverify(payload: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? 200;
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('resolveTurnstileConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('falls back to Cloudflare test keys outside production when unset', () => {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'development';
    const cfg = resolveTurnstileConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.siteKey).toBe('1x00000000000000000000AA');
  });

  it('disables the gate when TURNSTILE_ENABLED=false', () => {
    process.env.TURNSTILE_SECRET_KEY = 'real-secret';
    process.env.TURNSTILE_ENABLED = 'false';
    expect(resolveTurnstileConfig().enabled).toBe(false);
  });

  it('does not fall back to test keys in production', () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'production';
    expect(resolveTurnstileConfig().enabled).toBe(false);
  });
});

describe('clientIpFromHeaders', () => {
  it('takes the first hop of X-Forwarded-For', () => {
    expect(clientIpFromHeaders('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7');
  });
  it('returns undefined for empty input', () => {
    expect(clientIpFromHeaders(undefined)).toBeUndefined();
    expect(clientIpFromHeaders('')).toBeUndefined();
  });
});

describe('verifyTurnstile', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts a valid token whose action matches', async () => {
    mockSiteverify({ success: true, action: 'wishes' });
    const outcome = await verifyTurnstile('valid-token', 'wishes');
    expect(outcome.ok).toBe(true);
  });

  it('rejects a valid token whose action does NOT match (cross-surface replay)', async () => {
    mockSiteverify({ success: true, action: 'admin-login' });
    const outcome = await verifyTurnstile('token-for-login', 'wishes');
    expect(outcome.ok).toBe(false);
    expect(outcome.errorCodes).toContain('action-mismatch');
  });

  it('rejects a missing token without calling Cloudflare', async () => {
    const fetchMock = mockSiteverify({ success: true });
    const outcome = await verifyTurnstile('', 'wishes');
    expect(outcome.ok).toBe(false);
    expect(outcome.errorCodes).toContain('missing-input-response');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed and reports unavailable when Cloudflare cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const outcome = await verifyTurnstile('token', 'wishes');
    expect(outcome.ok).toBe(false);
    expect(outcome.unavailable).toBe(true);
  });

  it('flags an expired/reused token as retryable', async () => {
    mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    const outcome = await verifyTurnstile('stale-token', 'wishes');
    expect(outcome.ok).toBe(false);
    expect(outcome.retryable).toBe(true);
    expect(outcome.unavailable).toBe(false);
  });

  it('treats a rejected secret as a non-retryable server misconfiguration', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-secret'] });
    const outcome = await verifyTurnstile('token', 'wishes');
    expect(outcome.ok).toBe(false);
    expect(outcome.retryable).toBe(false);
    expect(outcome.unavailable).toBe(false);
  });
});

describe('guardTurnstile (HTTP mapping)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes (null) when the gate is disabled', async () => {
    process.env.TURNSTILE_ENABLED = 'false';
    expect(await guardTurnstile({ token: undefined, action: 'wishes', endpoint: 'x' })).toBeNull();
  });

  it('maps a missing token to 400', async () => {
    const result = await guardTurnstile({ token: '', action: 'wishes', endpoint: 'x' });
    expect(result?.status).toBe(400);
  });

  it('maps a forged token to 403 with a generic message', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const result = await guardTurnstile({ token: 'forged', action: 'wishes', endpoint: 'x' });
    expect(result?.status).toBe(403);
    // Must not leak the raw Cloudflare error code.
    expect(result?.message).not.toContain('invalid-input-response');
  });

  it('maps an unavailable Cloudflare to 503 (fail-closed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await guardTurnstile({ token: 'token', action: 'wishes', endpoint: 'x' });
    expect(result?.status).toBe(503);
  });

  it('passes (null) when the token is valid', async () => {
    mockSiteverify({ success: true, action: 'admin-login' });
    expect(await guardTurnstile({ token: 'ok', action: 'admin-login', endpoint: 'x' })).toBeNull();
  });
});
