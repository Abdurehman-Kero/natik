import { Module } from '@nestjs/common';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

/** Profile cards for chat and course groups. */
@Module({ controllers: [PeopleController], providers: [PeopleService] })
export class PeopleModule {}
