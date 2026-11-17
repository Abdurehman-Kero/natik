import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

/** The student's dashboard, outline and lesson player (FR-STU, FR-LEARN-001…005, 012). */
@Module({
  imports: [EnrolmentsModule, ContentModule, NotificationsModule],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
