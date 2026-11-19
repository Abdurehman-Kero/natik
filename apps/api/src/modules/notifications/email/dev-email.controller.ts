import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config/app-config.service';
import { Public } from '../../auth/decorators';
import { EmailService } from './email.service';

/** Local development and tests only: the "mailbox" that shows the emails nothing really sent. */
@ApiTags('Development')
@Controller('dev/email')
export class DevEmailController {
  constructor(
    private readonly email: EmailService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  latest(@Query('to') to?: string) {
    if (!this.config.isLocal && this.config.get('APP_ENV') !== 'test') {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const items = this.email
      .recentMessages()
      .filter((message) => !to || message.to === to.toLowerCase())
      .slice(0, 20);
    return { items };
  }
}
