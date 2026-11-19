import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DevGoogleOAuthClient,
  DisabledGoogleOAuthClient,
  GoogleExchangeError,
  RealGoogleOAuthClient,
  randomUrlToken,
  s256Challenge,
} from './google-oauth.client';
import { safeNextPath } from './google-auth.service';

describe('PKCE helpers', () => {
  it('the challenge is the URL-safe SHA-256 of the verifier (RFC 7636 example)', () => {
    // The example from RFC 7636, appendix B.
    expect(s256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    const verifier = randomUrlToken(48);
    expect(s256Challenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('random tokens are long, URL-safe and never repeat', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomUrlToken()));
    expect(seen.size).toBe(50);
    for (const token of seen) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('the real Google client', () => {
  const client = new RealGoogleOAuthClient('id.apps.googleusercontent.com', 'secret');

  it('asks for the basic profile only, with PKCE, a state and a nonce, and always lets the person pick the account', () => {
    const url = new URL(
      client.authorizationUrl({
        state: 'S',
        nonce: 'N',
        challenge: 'C',
        redirectUri: 'https://natik.example/api/v1/auth/google/callback',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const q = url.searchParams;
    expect(q.get('client_id')).toBe('id.apps.googleusercontent.com');
    expect(q.get('response_type')).toBe('code');
    expect(q.get('scope')).toBe('openid email profile');
    expect(q.get('state')).toBe('S');
    expect(q.get('nonce')).toBe('N');
    expect(q.get('code_challenge')).toBe('C');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('prompt')).toBe('select_account');
    expect(q.get('redirect_uri')).toBe('https://natik.example/api/v1/auth/google/callback');
    // The secret never goes to the browser.
    expect(url.toString()).not.toContain('secret');
  });
});

describe('no Google configured', () => {
  it('is disabled and refuses everything', async () => {
    const client = new DisabledGoogleOAuthClient();
    expect(client.enabled).toBe(false);
    expect(() => client.authorizationUrl()).toThrow(GoogleExchangeError);
    await expect(client.exchange()).rejects.toBeInstanceOf(GoogleExchangeError);
  });
});

describe('the pretend Google (development and tests)', () => {
  const client = new DevGoogleOAuthClient();
  const redirectUri = 'http://localhost:3000/api/v1/auth/google/callback';

  async function signInAs(hint?: string) {
    const url = new URL(client.authorizationUrl({ state: 'abc', redirectUri, loginHint: hint }));
    expect(url.searchParams.get('state')).toBe('abc');
    return client.exchange({ code: url.searchParams.get('code')! });
  }

  it('signs in whoever the login hint names, with a readable name', async () => {
    expect(await signInAs('Hana.Alemu@Example.com')).toMatchObject({
      email: 'hana.alemu@example.com',
      emailVerified: true,
      name: 'Hana Alemu',
    });
  });

  it('plays a Google account whose email is not verified', async () => {
    expect((await signInAs('unverified.person@example.com')).emailVerified).toBe(false);
  });

  it('gives the same person the same id every time, and different people different ids', async () => {
    const a = await signInAs('a@example.com');
    expect((await signInAs('a@example.com')).sub).toBe(a.sub);
    expect((await signInAs('b@example.com')).sub).not.toBe(a.sub);
  });

  it('refuses a code it did not make', async () => {
    await expect(client.exchange({ code: 'dev.%%%not-json' })).rejects.toBeInstanceOf(
      GoogleExchangeError,
    );
  });
});

describe('safeNextPath', () => {
  it('keeps pages of this site', () => {
    expect(safeNextPath('/courses/everyday-english?x=1')).toBe('/courses/everyday-english?x=1');
  });

  it('drops anything that could leave the site', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      undefined,
      null,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});
