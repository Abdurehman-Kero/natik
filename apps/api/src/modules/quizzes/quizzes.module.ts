import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { AuditModule } from '../audit/audit.module';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { AttemptGrader } from './attempt-grader.service';
import { MarkingService } from './marking.service';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizBuilderService } from './quiz-builder.service';
import { QuizProcessor } from './quiz.processor';
import {
  MarkingController,
  QuizBuilderController,
  StudentQuizController,
} from './quizzes.controller';

/** Quizzes, questions, attempts, marking, extra attempts (FR-QUIZ, FR-TEACH-005). */
@Module({
  imports: [EnrolmentsModule],
  controllers: [QuizBuilderController, MarkingController, StudentQuizController],
  providers: [QuizBuilderService, QuizAttemptsService, MarkingService, AttemptGrader],
  exports: [AttemptGrader, QuizBuilderService, MarkingService],
})
export class QuizzesModule {}

/** The quiz time-out job. Imported by the worker side only (see ProcessorsModule). */
@Module({
  imports: [AuditModule, QueueModule, QuizzesModule],
  providers: [QuizProcessor],
})
export class QuizzesWorkerModule {}
