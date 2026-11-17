import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/** One-to-one chat with files and voice messages (students, teachers and the Natik team). */
@Module({ controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
