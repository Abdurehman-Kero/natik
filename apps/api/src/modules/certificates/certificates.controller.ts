import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  approveCertificateSchema,
  cancelCertificateSchema,
  certificateNameSchema,
  certificateSettingsSchema,
  listCertificateRequestsQuerySchema,
  listCertificatesQuerySchema,
  returnCertificateSchema,
} from '@natik/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { CertificatesService } from './certificates.service';

class CancelDto extends createZodDto(cancelCertificateSchema) {}
class SettingsDto extends createZodDto(certificateSettingsSchema) {}
class ListQuery extends createZodDto(listCertificatesQuerySchema) {}
class RequestsQuery extends createZodDto(listCertificateRequestsQuerySchema) {}
class NameDto extends createZodDto(certificateNameSchema) {}
class ApproveDto extends createZodDto(approveCertificateSchema) {}
class ReturnDto extends createZodDto(returnCertificateSchema) {}

function sendPdf(res: Response, file: { body: Buffer; name: string }): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.body);
}

/** A student's own certificates (FR-STU-003, FR-CERT-003). */
@ApiTags('Certificates')
@Roles('STUDENT')
@Controller('me/certificates')
export class MyCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.certificates.listMine(user);
  }

  /** The student writes (or changes) the name to print, before an admin approves it. */
  @Put('requests/:id/name')
  submitName(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: NameDto) {
    return this.certificates.submitName(user, id, dto.nameOnCertificate);
  }

  @Get(':id/pdf')
  async pdf(@CurrentUser() user: SessionUser, @Param('id') id: string, @Res() res: Response) {
    sendPdf(res, await this.certificates.pdfForStudent(user, id));
  }
}

/** Admin: search, open and cancel certificates, and the signatory shown on them (FR-CERT-005). */
@ApiTags('Admin · Certificates')
@Roles('ADMIN')
@Controller('admin')
export class AdminCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('certificates')
  list(@Query() query: ListQuery) {
    return this.certificates.adminList(query);
  }

  /** Certificates on their way: waiting for approval (default), for the student, sent back, issued. */
  @Get('certificate-requests')
  requests(@Query() query: RequestsQuery) {
    return this.certificates.adminRequests(query);
  }

  @Get('certificate-requests/count')
  pendingCount() {
    return this.certificates.pendingCount();
  }

  /** Numbers, prints and sends the certificate (the admin may correct the name first). */
  @Post('certificate-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: ApproveDto) {
    return this.certificates.approve(admin, id, dto.nameOnCertificate);
  }

  /** Sends it back to the student with a note, for example to write their full name. */
  @Post('certificate-requests/:id/return')
  @HttpCode(HttpStatus.OK)
  sendBack(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: ReturnDto) {
    return this.certificates.returnToStudent(admin, id, dto.note);
  }

  @Get('certificates/:id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    sendPdf(res, await this.certificates.pdf(id));
  }

  @Post('certificates/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.certificates.cancel(admin, id, dto.reason);
  }

  /** The certificate design with sample details and the current signatory (opens in the browser). */
  @Get('settings/certificate/preview')
  async preview(@Res() res: Response) {
    const file = await this.certificates.preview();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.body);
  }

  @Get('settings/certificate')
  settings() {
    return this.certificates.getSettings();
  }

  @Put('settings/certificate')
  saveSettings(@CurrentUser() admin: SessionUser, @Body() dto: SettingsDto) {
    return this.certificates.putSettings(admin, dto);
  }
}
