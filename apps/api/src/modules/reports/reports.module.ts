import { Module } from '@nestjs/common';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { ActivityService } from './activity.service';
import { DashboardService } from './dashboard.service';
import { AdminReportsController, TeacherReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TeacherProgressService } from './teacher-progress.service';

/** Dashboards, reports, CSV export, the activity log (FR-REP, FR-ADMIN-001, FR-TEACH-006). */
@Module({
  imports: [QuizzesModule],
  controllers: [AdminReportsController, TeacherReportsController],
  providers: [ReportsService, DashboardService, ActivityService, TeacherProgressService],
  exports: [ReportsService],
})
export class ReportsModule {}
