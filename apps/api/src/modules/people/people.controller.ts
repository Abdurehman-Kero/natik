import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { PeopleService } from './people.service';

/** A person's profile card, for people who share a chat or a course with them. */
@ApiTags('People')
@Roles('STUDENT', 'TEACHER', 'ADMIN')
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get(':id/card')
  card(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.people.card(user, id.slice(0, 60));
  }
}
