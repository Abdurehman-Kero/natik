import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  eraseUserSchema,
  listUsersQuerySchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { RetentionService } from './retention.service';
import { UsersService } from './users.service';

class CreateUserDto extends createZodDto(adminCreateUserSchema) {}
class UpdateUserDto extends createZodDto(adminUpdateUserSchema) {}
class ListUsersQuery extends createZodDto(listUsersQuerySchema) {}
class EraseDto extends createZodDto(eraseUserSchema) {}

/** Admin user management (FR-ADMIN-002). Admin accounts can only be managed by the Owner. */
@ApiTags('Admin · Users')
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly retention: RetentionService,
  ) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.getForAdmin(id);
  }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.users.setStatus(actor, id, 'DISABLED');
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.users.setStatus(actor, id, 'ACTIVE');
  }

  /** "Delete personal data": anonymises the person and ends their sessions (SRS §8.2). */
  @Post(':id/erase')
  @HttpCode(HttpStatus.OK)
  erase(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: EraseDto) {
    return this.retention.eraseByAdmin(actor, id, dto.reason);
  }

  @Post(':id/password-link')
  @HttpCode(HttpStatus.OK)
  async passwordLink(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    await this.users.sendPasswordLink(actor, id);
    return { ok: true };
  }
}
