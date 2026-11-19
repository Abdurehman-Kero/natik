import { HttpStatus, Injectable } from '@nestjs/common';
import { formatPhone, normalizePhone, type Role, type UserStatus } from '@natik/shared';
import { createId } from '../../common/security/ids';
import { AppException } from '../../common/errors/app.exception';
import { ImageService } from '../../common/storage/image.service';
import { StorageService } from '../../common/storage/storage.service';
import { hashPassword, verifyPassword } from '../../common/security/password-hasher';
import { Prisma, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import type { SessionUser } from '../auth/decorators';
import { SessionService } from '../auth/session.service';

export interface UserView {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: Role;
  isOwner: boolean;
  status: UserStatus;
  phoneVerified: boolean;
  photoUrl: string | null;
  bio: string | null;
  showOnWebsite: boolean;
  gender: 'MALE' | 'FEMALE' | null;
  /** Two-letter country code, e.g. ET. */
  country: string | null;
  city: string | null;
  lastSignInAt: Date | null;
  erased: boolean;
  createdAt: Date;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: formatPhone(user.phone),
    email: user.email,
    role: user.role,
    isOwner: user.isOwner,
    status: user.status,
    phoneVerified: user.phoneVerifiedAt !== null,
    photoUrl: user.photoFileId ? `/api/v1/files/${user.photoFileId}` : null,
    bio: user.bio,
    showOnWebsite: user.showOnWebsite,
    gender: user.gender,
    country: user.country,
    city: user.city,
    lastSignInAt: user.lastSignInAt,
    erased: user.anonymisedAt !== null,
    createdAt: user.createdAt,
  };
}

interface ListQuery {
  q?: string;
  country?: string;
  role?: Role;
  status?: UserStatus;
  page: number;
  pageSize: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  // ── The signed-in user ─────────────────────────────────────────────────

  async me(id: string): Promise<UserView> {
    return toUserView(await this.get(id));
  }

  async updateProfile(
    id: string,
    input: {
      fullName: string;
      email?: string;
      gender?: 'MALE' | 'FEMALE' | null;
      country?: string | null;
      city?: string | null;
    },
  ): Promise<UserView> {
    const user = await this.onEmailConflict(() =>
      this.prisma.user.update({
        where: { id },
        data: {
          fullName: input.fullName.trim(),
          // The email is what people sign in with, so it can be changed but not taken away.
          ...(input.email ? { email: input.email } : {}),
          // Left out of the request = left as it was; null or empty = cleared.
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
        },
      }),
    );
    return toUserView(user);
  }

  /** Current password required; every other device is signed out. */
  async changePassword(
    actor: SessionUser,
    sessionId: string | undefined,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.get(actor.id);
    const ok = user.passwordHash
      ? await verifyPassword(user.passwordHash, input.currentPassword)
      : false;
    if (!ok) {
      throw new AppException('CURRENT_PASSWORD_WRONG', HttpStatus.BAD_REQUEST, {
        fields: { currentPassword: ['Your current password is incorrect.'] },
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.sessions.revokeAll(user.id, sessionId);
    await this.audit.record({
      actorId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
    });
  }

  async setPhoto(userId: string, file: Buffer): Promise<UserView> {
    const webp = await this.images.toAvatar(file);
    const key = `avatars/${userId}/${createId()}.webp`;
    await this.storage.put(key, webp, 'image/webp');

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { photo: true },
    });
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: 'AVATAR',
        storageKey: key,
        mime: 'image/webp',
        sizeBytes: webp.length,
        originalName: 'avatar.webp',
        uploadedById: userId,
      },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { photoFileId: asset.id },
    });
    if (previous?.photo) {
      await this.prisma.fileAsset
        .delete({ where: { id: previous.photo.id } })
        .catch(() => undefined);
      await this.storage.remove(previous.photo.storageKey).catch(() => undefined);
    }
    return toUserView(user);
  }

  // ── Admin: manage users ────────────────────────────────────────────────

  async list(query: ListQuery) {
    const where: Prisma.UserWhereInput = { anonymisedAt: null };
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.country) where.country = query.country;
    if (query.q) {
      const digits = query.q
        .replace(/\D/g, '')
        .replace(/^(00)?251/, '')
        .replace(/^0/, '');
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toUserView), total, page: query.page, pageSize: query.pageSize };
  }

  /** An email belongs to one account: a second account asking for it gets a clear message. */
  private async onEmailConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta ?? {}).includes('email')
      ) {
        throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
          fields: { email: ['This email already has an account.'] },
        });
      }
      throw error;
    }
  }

  async getForAdmin(id: string): Promise<UserView> {
    return toUserView(await this.get(id));
  }

  async create(
    actor: SessionUser,
    input: { fullName: string; phone: string; email: string; role: Role },
  ): Promise<UserView> {
    if (input.role === 'ADMIN' && !actor.isOwner) {
      throw new AppException('OWNER_REQUIRED', HttpStatus.FORBIDDEN);
    }
    const phone = normalizePhone(input.phone)!;
    if (await this.prisma.user.findUnique({ where: { phone } })) {
      throw new AppException('PHONE_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
        fields: { phone: ['This number already has an account.'] },
      });
    }
    const branch = await this.prisma.branch.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
    const user = await this.onEmailConflict(() =>
      this.prisma.user.create({
        data: {
          branchId: branch.id,
          fullName: input.fullName.trim(),
          phone,
          email: input.email ?? null,
          role: input.role,
          // They set their own password from the SMS link, which also verifies the phone.
          termsAcceptedAt: null,
        },
      }),
    );
    await this.auth.sendPasswordLink(user, 'account.created');
    await this.audit.record({
      actorId: actor.id,
      action: input.role === 'ADMIN' ? 'ADMIN_CREATED' : 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      details: { role: input.role },
    });
    return toUserView(user);
  }

  async update(
    actor: SessionUser,
    id: string,
    input: { fullName: string; email?: string; role?: Role; bio?: string; showOnWebsite?: boolean },
  ): Promise<UserView> {
    const target = await this.get(id);
    this.assertCanManage(actor, target);

    const data: Prisma.UserUpdateInput = {
      fullName: input.fullName.trim(),
      ...(input.email ? { email: input.email } : {}),
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(input.showOnWebsite !== undefined ? { showOnWebsite: input.showOnWebsite } : {}),
    };

    if (input.role && input.role !== target.role) {
      if (actor.id === target.id) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, {
          message: "You can't change your own role.",
        });
      }
      if ((input.role === 'ADMIN' || target.role === 'ADMIN') && !actor.isOwner) {
        throw new AppException('OWNER_REQUIRED', HttpStatus.FORBIDDEN);
      }
      if (target.isOwner) {
        await this.assertNotLastOwner(target.id);
        data.isOwner = false;
      }
      data.role = input.role;
    }

    const user = await this.onEmailConflict(() => this.prisma.user.update({ where: { id }, data }));
    if (data.role) {
      await this.audit.record({
        actorId: actor.id,
        action: 'ROLE_CHANGED',
        entityType: 'User',
        entityId: id,
        details: { from: target.role, to: input.role! },
      });
      // A changed role must not keep old permissions alive.
      await this.sessions.revokeAll(id);
    }
    return toUserView(user);
  }

  async setStatus(actor: SessionUser, id: string, status: UserStatus): Promise<UserView> {
    const target = await this.get(id);
    this.assertCanManage(actor, target);
    if (status === 'DISABLED') {
      if (actor.id === target.id) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, {
          message: "You can't disable your own account.",
        });
      }
      if (target.isOwner) await this.assertNotLastOwner(target.id);
    }
    const user = await this.prisma.user.update({ where: { id }, data: { status } });
    if (status === 'DISABLED') await this.sessions.revokeAll(id);
    await this.audit.record({
      actorId: actor.id,
      action: status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
      entityType: 'User',
      entityId: id,
    });
    return toUserView(user);
  }

  async sendPasswordLink(actor: SessionUser, id: string): Promise<void> {
    const target = await this.get(id);
    this.assertCanManage(actor, target);
    await this.auth.sendPasswordLink(target, 'password.link');
    await this.audit.record({
      actorId: actor.id,
      action: 'PASSWORD_LINK_SENT',
      entityType: 'User',
      entityId: id,
    });
  }

  // ── Rules ──────────────────────────────────────────────────────────────

  private async get(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return user;
  }

  /** Only the Owner manages other admin accounts (BR-ROLE-004). Anyone may act on their own record. */
  private assertCanManage(actor: SessionUser, target: User): void {
    if (target.role === 'ADMIN' && target.id !== actor.id && !actor.isOwner) {
      throw new AppException('OWNER_REQUIRED', HttpStatus.FORBIDDEN);
    }
  }

  /** The last active Owner can't be demoted or disabled (BR-ROLE-004). */
  private async assertNotLastOwner(ownerId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: { isOwner: true, status: 'ACTIVE', id: { not: ownerId } },
    });
    if (others === 0) throw new AppException('LAST_OWNER', HttpStatus.CONFLICT);
  }
}
