import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** A random value that is safe in a URL. */
export const randomUrlToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** PKCE: the challenge Google keeps until the app proves it started the sign-in (the verifier). */
export const s256Challenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');

/** Who Google says the person is. Only used once Google has confirmed the email. */
export interface GoogleProfile {
  /** Google's stable id for the person (it never changes, even if they change their email). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export class GoogleExchangeError extends Error {}

/** Talks to Google. One real implementation, one fake for local development and tests. */
export abstract class GoogleOAuthClient {
  abstract readonly enabled: boolean;
  abstract authorizationUrl(input: {
    state: string;
    nonce: string;
    challenge: string;
    redirectUri: string;
    loginHint?: string;
  }): string;
  /** Trades the one-time `code` for the person's verified profile. Throws GoogleExchangeError. */
  abstract exchange(input: {
    code: string;
    verifier: string;
    redirectUri: string;
    nonce: string;
  }): Promise<GoogleProfile>;
}

/** No Google configured: the button is hidden and every route says so. */
export class DisabledGoogleOAuthClient extends GoogleOAuthClient {
  readonly enabled = false;
  authorizationUrl(): string {
    throw new GoogleExchangeError('Google sign-in is not set up.');
  }
  exchange(): Promise<GoogleProfile> {
    return Promise.reject(new GoogleExchangeError('Google sign-in is not set up.'));
  }
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** The real thing: Google's OpenID Connect "authorization code" flow with PKCE. */
export class RealGoogleOAuthClient extends GoogleOAuthClient {
  readonly enabled = true;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {
    super();
  }

  authorizationUrl(input: {
    state: string;
    nonce: string;
    challenge: string;
    redirectUri: string;
    loginHint?: string;
  }): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.challenge,
      code_challenge_method: 'S256',
      // Always let the person choose the account (a shared computer may be signed in to another one).
      prompt: 'select_account',
    });
    if (input.loginHint) params.set('login_hint', input.loginHint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchange(input: {
    code: string;
    verifier: string;
    redirectUri: string;
    nonce: string;
  }): Promise<GoogleProfile> {
    let idToken: string;
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: input.code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: input.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new GoogleExchangeError(`Google answered ${response.status}.`);
      const body = (await response.json()) as { id_token?: string };
      if (!body.id_token) throw new GoogleExchangeError('Google sent no id_token.');
      idToken = body.id_token;
    } catch (error) {
      if (error instanceof GoogleExchangeError) throw error;
      throw new GoogleExchangeError('Could not reach Google.');
    }
    try {
      // Checks the signature against Google's published keys, who issued it, who it is for and that it
      // has not expired; then that it belongs to THIS sign-in (nonce).
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.clientId,
      });
      if (payload.nonce !== input.nonce) throw new GoogleExchangeError('Wrong nonce.');
      const email = typeof payload.email === 'string' ? payload.email : '';
      if (!payload.sub || !email) throw new GoogleExchangeError('Google sent no email.');
      return {
        sub: payload.sub,
        email,
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === 'string' && payload.name.trim() ? payload.name : email,
      };
    } catch (error) {
      if (error instanceof GoogleExchangeError) throw error;
      throw new GoogleExchangeError('The Google token was not valid.');
    }
  }
}

/**
 * Local development and tests only (GOOGLE_CLIENT_ID=dev): pretends to be Google, so the whole flow can
 * be tried without an account. The "login hint" is the email that signs in. A hint that starts with
 * `unverified` plays a Google account whose email is not verified.
 */
export class DevGoogleOAuthClient extends GoogleOAuthClient {
  readonly enabled = true;

  authorizationUrl(input: { state: string; redirectUri: string; loginHint?: string }): string {
    const email = (input.loginHint ?? 'dev.user@example.com').toLowerCase();
    const code = Buffer.from(JSON.stringify({ email })).toString('base64url');
    return `${input.redirectUri}?code=dev.${code}&state=${input.state}`;
  }

  exchange(input: { code: string }): Promise<GoogleProfile> {
    try {
      const { email } = JSON.parse(
        Buffer.from(input.code.replace(/^dev\./, ''), 'base64url').toString('utf8'),
      ) as { email: string };
      const local = email.split('@')[0] ?? 'dev';
      return Promise.resolve({
        sub: `dev-${email}`,
        email,
        emailVerified: !local.startsWith('unverified'),
        name: local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    } catch {
      return Promise.reject(new GoogleExchangeError('Bad dev code.'));
    }
  }
}
