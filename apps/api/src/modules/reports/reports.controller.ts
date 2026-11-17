import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  activityQuerySchema,
  REPORT_TYPES,
  reportQuerySchema,
  type ReportType,
  teacherStudentsQuerySchema,
} from '@natik/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { ActivityService } from './activity.service';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';
import { TeacherProgressService } from './teacher-progress.service';

class ReportQuery extends createZodDto(reportQuerySchema) {}
class ActivityQuery extends createZodDto(activityQuerySchema) {}
class StudentsQuery extends createZodDto(teacherStudentsQuerySchema) {}

function reportType(value: string): ReportType {
  if (!(REPORT_TYPES as readonly string[]).includes(value)) {
    throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }
  return value as ReportType;
}

function sendCsv(res: Response, name: string, body: Buffer): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(body);
}

const today = () => new Date().toISOString().slice(0, 10);

/** Admin: dashboard, the four reports with CSV export, and the activity log (FR-ADMIN-001, FR-REP). */
@ApiTags('Admin · Reports')
@Roles('ADMIN')
@Controller('admin')
export class AdminReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly reports: ReportsService,
    private readonly activity: ActivityService,
  ) {}

  @Get('dashboard')
  home() {
    return this.dashboard.admin();
  }

  @Get('reports/:type')
  report(@Param('type') type: string, @Query() query: ReportQuery) {
    return this.reports.report(reportType(type), query);
  }

  @Get('reports/:type/export')
  async export(@Param('type') type: string, @Query() query: ReportQuery, @Res() res: Response) {
    const t = reportType(type);
    sendCsv(res, `natik-${t}-${today()}.csv`, await this.reports.csv(t, query));
  }

  @Get('activity')
  list(@Query() query: ActivityQuery) {
    return this.activity.list(query);
  }

  @Get('activity/:id')
  detail(@Param('id') id: string) {
    return this.activity.detail(id);
  }
}

/** Teachers: the home figures and their students' progress, with a CSV (FR-TEACH-001, FR-TEACH-006). */
@ApiTags('Teach · Progress')
@Roles('TEACHER', 'ADMIN')
@Controller('teach')
export class TeacherReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly progress: TeacherProgressService,
  ) {}

  @Get('dashboard')
  home(@CurrentUser() user: SessionUser) {
    return this.dashboard.teacher(user);
  }

  @Get('courses/:id/students')
  students(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Query() query: StudentsQuery,
  ) {
    return this.progress.students(user, id, query);
  }

  @Get('courses/:id/students/export')
  async export(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Query() query: StudentsQuery,
    @Res() res: Response,
  ) {
    sendCsv(res, `natik-students-${today()}.csv`, await this.progress.csv(user, id, query.q));
  }
}
