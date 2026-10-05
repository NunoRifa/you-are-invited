/**
 * Cloudflare Turnstile server-side verification.
 *
 * SECURITY: This module must only ever run on the server. It reads
 * TURNSTILE_SECRET_KEY and must never be imported from anything bundled for the
 * browser. The secret is never logged, returned, or echoed to a client.
 */
import type { TurnstileAction } from './turnstile-types.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's published test keys (always-pass). Used only outside production
// so local development works without a real account.
const TEST_SITE_KEY = '1x00000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

const VERIFY_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 2; // one attempt + a single retry

// Cloudflare test keys are prefixed 1x/2x/3x followed by all zeroes.
const TEST_KEY_PATTERN = /^[123]x0{10,}/i;

export interface TurnstileConfig {
  /** Whether Turnstile verification is enforced. */
  enabled: boolean;
  /** Public site key — safe to expose to the browser. */
  siteKey: string;
  /** Secret key — server only. */
  secretKey: string;
  isProduction: boolean;
}

export interface TurnstileOutcome {
  /** Verification succeeded and the action matched. */
  ok: boolean;
  /** The guest may simply retry (token expired or was already used). */
  retryable: boolean;
  /** Cloudflare was unreachable or errored — a server-side problem, not the guest's fault. */
  unavailable: boolean;
  /** Raw error codes from Cloudflare, for server logs only. */
  errorCodes: string[];
}

/**
 * Resolve Turnstile configuration from the environment.
 * Outside production, missing keys fall back to Cloudflare's always-pass test
 * keys so local development needs no setup.
 */
export function resolveTurnstileConfig(): TurnstileConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredSiteKey = (process.env.TURNSTILE_SITE_KEY || '').trim();
  const configuredSecretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();

  let siteKey = configuredSiteKey;
  let secretKey = configuredSecretKey;
  if (!isProduction && (!siteKey || !secretKey)) {
    siteKey = siteKey || TEST_SITE_KEY;
    secretKey = secretKey || TEST_SECRET_KEY;
  }

  // Explicit TURNSTILE_ENABLED=false is an operator kill-switch. Otherwise the
  // gate is active whenever a secret is available.
  const enabled = process.env.TURNSTILE_ENABLED === 'false' ? false : Boolean(secretKey);

  return { enabled, siteKey, secretKey, isProduction };
}

/** Public config safe to hand to the browser (no secret). */
export function publicTurnstileConfig(): { enabled: boolean; siteKey: string } {
  const { enabled, siteKey } = resolveTurnstileConfig();
  return { enabled, siteKey: enabled ? siteKey : '' };
}

/**
 * Fail fast in production when the secret is missing or is a Cloudflare test
 * key — silently accepting every submission would be a worse outcome.
 */
export function assertProductionTurnstileConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const enabled = process.env.TURNSTILE_ENABLED !== 'false';
  if (!isProduction || !enabled) return;

  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  const siteKey = (process.env.TURNSTILE_SITE_KEY || '').trim();

  if (!secretKey || !siteKey || TEST_KEY_PATTERN.test(secretKey) || TEST_KEY_PATTERN.test(siteKey)) {
    console.error(
      '[turnstile] FATAL: TURNSTILE_SECRET_KEY/TURNSTILE_SITE_KEY are missing or set to a ' +
      'Cloudflare test key while NODE_ENV=production. Refusing to start. ' +
      'Set real keys, or set TURNSTILE_ENABLED=false to explicitly disable the gate.',
    );
    process.exit(1);
  }
}

/** Extract the client IP from the proxy chain (nginx sets X-Forwarded-For). */
export function clientIpFromHeaders(forwardedFor: string | undefined | null): string | undefined {
  if (!forwardedFor) return undefined;
  const first = forwardedFor.split(',')[0]?.trim();
  return first && first.length <= 45 ? first : undefined;
}

/**
 * Verify a Turnstile token against Cloudflare.
 *
 * Fails CLOSED: any ambiguity (network failure, non-200, malformed response,
 * Cloudflare internal error) yields `ok: false`. The only difference between
 * outcomes is the `unavailable`/`retryable` hints used to pick a status code.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  action: TurnstileAction,
  remoteIp?: string,
): Promise<TurnstileOutcome> {
  const { secretKey } = resolveTurnstileConfig();

  if (!token || !token.trim()) {
    return { ok: false, retryable: false, unavailable: false, errorCodes: ['missing-input-response'] };
  }

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  let lastErrorCodes: string[] = ['internal-error'];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });

      // A non-2xx response is a Cloudflare-side problem; retry once, then give up.
      if (!response.ok) {
        lastErrorCodes = [`http-${response.status}`];
        continue;
      }

      const result = (await response.json()) as {
        success?: boolean;
        action?: string;
        'error-codes'?: string[];
      };
      const errorCodes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];

      // Cloudflare itself errored — treat as unavailable rather than as a bad token.
      if (errorCodes.includes('internal-error')) {
        lastErrorCodes = errorCodes;
        continue;
      }

      // Server misconfiguration: the secret we sent is wrong. Fail closed, log loudly.
      if (errorCodes.includes('invalid-input-secret')) {
        console.error('[turnstile] configuration error: invalid-input-secret (the server secret key is rejected by Cloudflare)');
        return { ok: false, retryable: false, unavailable: false, errorCodes };
      }

      // Token expired or was already redeemed — the guest can retry with a fresh one.
      const retryable = errorCodes.includes('timeout-or-duplicate');

      if (result.success === true && result.action === action) {
        return { ok: true, retryable: false, unavailable: false, errorCodes: [] };
      }

      return { ok: false, retryable, unavailable: false, errorCodes: errorCodes.length ? errorCodes : ['action-mismatch'] };
    } catch {
      // Network failure or timeout — retry, then report unavailable.
      lastErrorCodes = ['network-error'];
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn('[turnstile] verification unavailable after retry', sanitizeForLog({ errorCodes: lastErrorCodes }));
  return { ok: false, retryable: false, unavailable: true, errorCodes: lastErrorCodes };
}

/**
 * Whitelist-only log payload. Tokens, secrets and IPs are never included here
 * beyond the short-lived request context we explicitly allow.
 */
export function sanitizeForLog(fields: {
  endpoint?: string;
  errorCodes?: string[];
  action?: string;
  ip?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { at: new Date().toISOString() };
  if (fields.endpoint) out.endpoint = fields.endpoint;
  if (fields.action) out.action = fields.action;
  if (fields.ip) out.ip = fields.ip;
  if (fields.errorCodes?.length) out.errorCodes = fields.errorCodes;
  return out;
}

/** Log a rejected submission without ever touching the token or secret. */
export function logTurnstileRejection(fields: {
  endpoint: string;
  action: TurnstileAction;
  ip?: string;
  outcome: TurnstileOutcome;
}): void {
  console.warn('[turnstile] rejected', sanitizeForLog({
    endpoint: fields.endpoint,
    action: fields.action,
    ip: fields.ip,
    errorCodes: fields.outcome.errorCodes,
  }));
}

/**
 * The user-facing message is intentionally uniform. Distinct per-code messages
 * would let an attacker fingerprint "missing" vs "forged" vs "bad secret", and
 * Cloudflare error codes are operational detail that belongs in the server log,
 * not the HTTP response.
 */
const GENERIC_FAILURE_MESSAGE = 'Verifikasi keamanan gagal. Silakan muat ulang halaman dan coba lagi.';
const RETRY_MESSAGE = 'Sesi verifikasi keamanan Anda telah berakhir. Silakan coba lagi.';
const UNAVAILABLE_MESSAGE = 'Layanan verifikasi keamanan sedang tidak tersedia. Silakan coba beberapa saat lagi.';

/**
 * Verify the token and translate the outcome into an HTTP status.
 * Returns `null` when the request may proceed, otherwise a `{ status, message }`
 * the caller turns into a JSON error response.
 */
export async function guardTurnstile(params: {
  token: string | undefined | null;
  action: TurnstileAction;
  endpoint: string;
  remoteIp?: string;
}): Promise<{ status: 400 | 403 | 503; message: string } | null> {
  const config = resolveTurnstileConfig();
  if (!config.enabled) return null;

  const outcome = await verifyTurnstile(params.token, params.action, params.remoteIp);
  if (outcome.ok) return null;

  logTurnstileRejection({
    endpoint: params.endpoint,
    action: params.action,
    ip: params.remoteIp,
    outcome,
  });

  if (outcome.unavailable) return { status: 503, message: UNAVAILABLE_MESSAGE };
  if (outcome.retryable) return { status: 403, message: RETRY_MESSAGE };
  if (outcome.errorCodes.includes('missing-input-response')) {
    return { status: 400, message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: 403, message: GENERIC_FAILURE_MESSAGE };
}

