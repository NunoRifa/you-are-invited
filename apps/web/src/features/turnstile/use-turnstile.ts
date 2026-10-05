import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hand-rolled Cloudflare Turnstile loader (no third-party React dependency).
 *
 * Invisible mode: the widget renders hidden and only surfaces a challenge when
 * Cloudflare decides one is needed. We fetch the public config from our own
 * backend (never the secret), then drive the widget programmatically:
 *   execute() → callback(token) → submit the token with the request.
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId?: string) => void;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Gagal memuat Turnstile')), { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export interface UseTurnstileResult {
  /** The backend has the gate enabled and the widget is rendered. */
  enabled: boolean;
  ready: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  /** Run the challenge and resolve with a fresh single-use token. */
  getToken: () => Promise<string>;
  /** Discard the current token so the next getToken() runs a fresh challenge. */
  reset: () => void;
}

export function useTurnstile(action: string): UseTurnstileResult {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const resolverRef = useRef<((token: string) => void) | null>(null);
  const rejecterRef = useRef<((error: Error) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let config: { enabled: boolean; siteKey: string };
      try {
        const response = await fetch('/api/config/turnstile');
        config = response.ok ? await response.json() : { enabled: false, siteKey: '' };
      } catch {
        config = { enabled: false, siteKey: '' };
      }
      if (cancelled || !config.enabled || !config.siteKey) return;

      setEnabled(true);
      try {
        await loadTurnstileScript();
      } catch {
        return; // Fail-safe: leave `enabled` true but `ready` false so submit is blocked visually.
      }
      if (cancelled || !containerRef.current || !window.turnstile) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: config.siteKey,
        action,
        callback: (token: string) => {
          tokenRef.current = token;
          resolverRef.current?.(token);
          resolverRef.current = null;
          rejecterRef.current = null;
        },
        'error-callback': () => {
          tokenRef.current = null;
          rejecterRef.current?.(new Error('Verifikasi keamanan gagal'));
          resolverRef.current = null;
          rejecterRef.current = null;
        },
        'expired-callback': () => {
          tokenRef.current = null;
        },
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
      widgetIdRef.current = null;
    };
  }, [action]);

  const getToken = useCallback((): Promise<string> => {
    if (!enabled) return Promise.resolve('');
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    if (!window.turnstile || !widgetIdRef.current) {
      return Promise.reject(new Error('Verifikasi keamanan belum siap'));
    }
    return new Promise<string>((resolve, reject) => {
      resolverRef.current = resolve;
      rejecterRef.current = reject;
      try {
        window.turnstile!.execute(widgetIdRef.current!);
      } catch {
        resolverRef.current = null;
        rejecterRef.current = null;
        reject(new Error('Verifikasi keamanan gagal'));
      }
    });
  }, [enabled]);

  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch { /* noop */ }
    }
  }, []);

  return { enabled, ready, containerRef, getToken, reset };
}
