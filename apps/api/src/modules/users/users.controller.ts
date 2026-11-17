import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { changePasswordSchema, updateProfileSchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { type AuthedRequest, CurrentUser, type SessionUser } from '../auth/decorators';
import { UsersService } from './users.service';

class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

/** Anything above this is refused by the upload parser; the friendly size message comes from the image check. */
const UPLOAD_HARD_LIMIT = 25 * 1024 * 1024;

@ApiTags('Me')
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: SessionUser) {
    return this.users.me(user.id);
  }

  @Patch()
  update(@CurrentUser() user: SessionUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Req() req: AuthedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(user, req.sessionId, dto);
    return { ok: true };
  }

  @Post('photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: UPLOAD_HARD_LIMIT, files: 1 },
    }),
  )
  setPhoto(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.users.setPhoto(user.id, file.buffer);
  }
}
