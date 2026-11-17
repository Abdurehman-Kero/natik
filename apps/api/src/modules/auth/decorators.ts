import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@natik/shared';
import type { Request } from 'express';

export const PUBLIC_KEY = 'natik:public';
export const ROLES_KEY = 'natik:roles';

/** Everything requires sign-in by default; mark open endpoints with @Public(). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Restrict an endpoint to some roles. Record-level rules (own records, assigned courses) live in AccessPolicy. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface SessionUser {
  id: string;
  fullName: string;
  role: Role;
  isOwner: boolean;
  phone: string | null;
  phoneVerified: boolean;
}

export type AuthedRequest = Request & {
  user?: SessionUser;
  sessionId?: string;
  id?: string;
};

/** The signed-in user (undefined on @Public routes when nobody is signed in). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
