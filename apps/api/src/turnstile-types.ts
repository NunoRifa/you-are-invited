/**
 * The Turnstile `action` values used to bind a token to the surface it was
 * solved on, so a token minted for one endpoint cannot be replayed on another.
 */
export type TurnstileAction = 'wishes' | 'admin-login';
