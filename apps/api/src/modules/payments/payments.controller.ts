import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  cashPaymentSchema,
  listAdminPaymentsQuerySchema,
  paymentAccountInputSchema,
  paymentSubmitSchema,
  reorderSchema,
  rejectPaymentSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { zodFieldErrors } from '../../common/errors/to-error-response';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { PaymentAccountsService } from './payment-accounts.service';
import { PaymentsService } from './payments.service';

class CashDto extends createZodDto(cashPaymentSchema) {}
class RejectDto extends createZodDto(rejectPaymentSchema) {}
class ListQuery extends createZodDto(listAdminPaymentsQuerySchema) {}
class AccountDto extends createZodDto(paymentAccountInputSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

/** Students pay for a course and see their payments. Only their own records are reachable. */
@ApiTags('Payments')
@Roles('STUDENT')
@Controller()
export class StudentPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('enrolments/:id/payment')
  info(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.payments.info(user, id);
  }

  /** Multipart form: the details plus an optional receipt photo or PDF (FR-PAY-002). */
  @Post('enrolments/:id/payments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: 6 * 1024 * 1024, files: 1 } }))
  submit(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() receipt: Express.Multer.File | undefined,
  ) {
    const parsed = paymentSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: zodFieldErrors(parsed.error),
      });
    }
    return this.payments.submit(user, id, parsed.data, receipt);
  }

  @Get('me/payments')
  mine(@CurrentUser() user: SessionUser) {
    return this.payments.mine(user);
  }
}

/** The payment queue: oldest first, with one-tap confirm or reject (FR-PAY-004…007). */
@ApiTags('Admin · Payments')
@Roles('ADMIN')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: ListQuery) {
    return this.payments.adminList(query);
  }

  @Get('count')
  count() {
    return this.payments.pendingCount();
  }

  @Post('cash')
  cash(@CurrentUser() admin: SessionUser, @Body() dto: CashDto) {
    return this.payments.cash(admin, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() admin: SessionUser, @Param('id') id: string) {
    return this.payments.confirm(admin, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.payments.reject(admin, id, dto.reason);
  }
}

/** Natik's bank and wallet accounts shown to students (FR-PAY-001). */
@ApiTags('Admin · Payment accounts')
@Roles('ADMIN')
@Controller('admin/payment-accounts')
export class PaymentAccountsController {
  constructor(private readonly accounts: PaymentAccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: AccountDto) {
    return this.accounts.create(actor, dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderDto) {
    return this.accounts.reorder(dto.ids);
  }

  @Put(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: AccountDto) {
    return this.accounts.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    await this.accounts.remove(actor, id);
  }
}
