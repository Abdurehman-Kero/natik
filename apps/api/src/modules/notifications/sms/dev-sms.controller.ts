import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../auth/decorators';

/** Local development only: the "phone" that shows the SMS codes. Hidden in staging/production. */
@ApiTags('Development')
@Controller('dev/sms')
export class DevSmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  async latest(@Query('to') to?: string) {
    if (!this.config.isLocal && this.config.get('APP_ENV') !== 'test') {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const items = await this.prisma.smsMessage.findMany({
      where: to ? { to } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, to: true, body: true, status: true, createdAt: true },
    });
    return { items };
  }
}

/** The sample accounts from `pnpm db:seed`, so the sign-in screen's quick-pick can fill in the email. */
const SAMPLE_PHONES = ['+251911000000', '+251911000001', '+251911000002'];

/** Local development only. Hidden in staging/production, like the SMS inbox above. */
@ApiTags('Development')
@Controller('dev/accounts')
export class DevAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  async sample() {
    if (!this.config.isLocal) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const items = await this.prisma.user.findMany({
      where: { phone: { in: SAMPLE_PHONES } },
      select: { phone: true, email: true },
    });
    return { items };
  }
}
