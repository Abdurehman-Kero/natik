import { DiscoveryService, Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_KEY, ROLES_KEY } from '../modules/auth/decorators';
import { createHarness, type Harness } from './harness';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
interface RouteInfo {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  url: string;
  roles: Role[] | undefined;
  isPublic: boolean;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
// Nest stores the HTTP verb as a number: GET 0, POST 1, PUT 2, DELETE 3, PATCH 4.
const VERB: Record<number, RouteInfo['method']> = {
  0: 'get',
  1: 'post',
  2: 'put',
  3: 'delete',
  4: 'patch',
};

/**
 * The permission matrix (NFR-SEC-003, SRS §3): every route of the API, asked by a visitor, a student,
 * a teacher and an admin, compared with the roles the route declares. Nothing may answer 5xx, a visitor
 * is always told to sign in, and a role that is not allowed always gets 403.
 */
describe('permission matrix', () => {
  let h: Harness;
  let routes: RouteInfo[] = [];

  beforeAll(async () => {
    h = await createHarness();
    const reflector = h.app.get(Reflector);
    const found: RouteInfo[] = [];
    for (const wrapper of h.app.get(DiscoveryService).getControllers()) {
      const type = wrapper.metatype;
      if (!type?.prototype) continue;
      const prefix = String(Reflect.getMetadata('path', type) ?? '').replace(/^\/|\/$/g, '');
      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = type.prototype[name] as (...a: unknown[]) => unknown;
        if (typeof handler !== 'function') continue;
        const verb = Reflect.getMetadata('method', handler) as number | undefined;
        if (verb === undefined || !(verb in VERB)) continue;
        const sub = String(Reflect.getMetadata('path', handler) ?? '').replace(/^\/|\/$/g, '');
        const path = [prefix, sub]
          .filter(Boolean)
          .join('/')
          .replace(/:[A-Za-z]+/g, 'x');
        found.push({
          method: VERB[verb]!,
          url: `/api/v1/${path}`,
          roles: reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [handler, type]),
          isPublic: reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [handler, type]) === true,
        });
      }
    }
    // Sign-in and sign-out routes change the session itself; development-only routes don't exist in production.
    routes = found.filter((r) => !r.url.includes('/auth/') && !r.url.includes('/dev/'));
  });
  afterAll(async () => {
    await h?.close();
  });

  it('finds the whole API', () => {
    expect(routes.length).toBeGreaterThan(150);
    expect(routes.some((r) => r.url.endsWith('/admin/payments/x/confirm'))).toBe(true);
    expect(METHODS.length).toBe(5);
  });

  it('every route answers each kind of person correctly, and none crashes', async () => {
    const make = async (role: Role) => {
      const u = await h.makeUser({ role });
      return h.signIn(u.phone, u.password);
    };
    const people: { label: string; role: Role | null; agent: ReturnType<Harness['client']> }[] = [
      { label: 'visitor', role: null, agent: h.client() },
      { label: 'student', role: 'STUDENT', agent: await make('STUDENT') },
      { label: 'teacher', role: 'TEACHER', agent: await make('TEACHER') },
      { label: 'admin', role: 'ADMIN', agent: await make('ADMIN') },
    ];

    const surprises: string[] = [];
    let count = 0;
    for (const route of routes) {
      for (const person of people) {
        if (++count % 80 === 0) await h.resetLimits();
        const res = await person.agent[route.method](route.url).send({});
        const status = res.status;
        const tag = `${person.label} ${route.method.toUpperCase()} ${route.url} → ${status}`;
        if (status >= 500) surprises.push(`${tag} (server error)`);
        else if (person.role === null) {
          if (!route.isPublic && status !== 401) surprises.push(`${tag} (visitor should get 401)`);
        } else if (route.roles && !route.roles.includes(person.role)) {
          if (status !== 403) surprises.push(`${tag} (role not allowed, should get 403)`);
        } else if (status === 401) {
          surprises.push(`${tag} (signed in, should not get 401)`);
        } else if (route.roles && status === 403 && !route.url.includes('/x')) {
          // With an id in the address, 403 can be the right answer: "not your course".
          surprises.push(`${tag} (role allowed, should not get 403)`);
        }
      }
    }
    expect(surprises, surprises.slice(0, 25).join('\n')).toEqual([]);
  }, 600_000);
});
