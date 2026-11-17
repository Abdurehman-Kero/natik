import { HttpStatus, Injectable } from '@nestjs/common';
import type { OtpPurpose } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { RateLimiter } from '../../common/security/rate-limiter';
import { hashOtp, newOtpCode, safeEqual } from '../../common/security/tokens';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../notifications/sms/sms.service';

export const OTP_TTL_MS = 10 * 60_000;
const MAX_CODES_PER_PHONE_PER_HOUR = 5;
const MAX_CODES_PER_IP_PER_HOUR = 20;
const MAX_WRONG_TRIES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const TEMPLATE = { VERIFY_PHONE: 'otp.verify', RESET_PASSWORD: 'otp.reset' } as const;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly limiter: RateLimiter,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Sends a new code. Limits are keyed on the phone number alone (not on whether an account exists),
   * so the answer is identical for known and unknown numbers (no account enumeration, FR-AUTH-004).
   * Pass `send: false` for an unknown number: limits apply, nothing is sent.
   */
  async issue(phone: string, purpose: OtpPurpose, ip: string | null, send = true): Promise<void> {
    if (!(await this.limiter.hit(`otp-cooldown:${purpose}:${phone}`, 1, RESEND_COOLDOWN_SECONDS))) {
      throw new AppException('OTP_TOO_SOON', HttpStatus.TOO_MANY_REQUESTS, {
        params: { seconds: RESEND_COOLDOWN_SECONDS },
      });
    }
    await this.limiter.assert(`otp-phone:${phone}`, MAX_CODES_PER_PHONE_PER_HOUR, 3600);
    if (ip) await this.limiter.assert(`otp-ip:${ip}`, MAX_CODES_PER_IP_PER_HOUR, 3600);
    if (!send) return;

    // A new code replaces any earlier unused one.
    await this.prisma.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = newOtpCode();
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: hashOtp(this.config.get('OTP_PEPPER'), phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.sms.send(phone, TEMPLATE[purpose], { code });
  }

  /** Checks a code. It is single use: success consumes it, and 5 wrong tries cancel it. */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const invalid = () => new AppException('OTP_INVALID', HttpStatus.BAD_REQUEST);
    const record = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw invalid();

    const matches = safeEqual(record.codeHash, hashOtp(this.config.get('OTP_PEPPER'), phone, code));
    if (!matches) {
      const wrongTries = record.wrongTries + 1;
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { wrongTries, ...(wrongTries >= MAX_WRONG_TRIES ? { consumedAt: new Date() } : {}) },
      });
      throw invalid();
    }
    // Atomic: two simultaneous requests can't both use the same code.
    const used = await this.prisma.otpCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (used.count !== 1) throw invalid();
  }
}
