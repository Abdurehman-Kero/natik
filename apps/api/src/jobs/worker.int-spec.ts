import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { CoreModule } from '../core.module';
import { EnrolmentProcessor, ProgressProcessor } from '../modules/enrolments/enrolment.processors';
import { SmsProcessor } from '../modules/notifications/sms/sms.processor';
import { ProcessorsModule } from './processors.module';

/** The background worker is a separate process, so a wiring mistake there would not show in other tests. */
describe('background worker', () => {
  it('can be built with every job processor', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule, ProcessorsModule],
    }).compile();
    expect(moduleRef.get(EnrolmentProcessor, { strict: false })).toBeDefined();
    expect(moduleRef.get(ProgressProcessor, { strict: false })).toBeDefined();
    expect(moduleRef.get(SmsProcessor, { strict: false })).toBeDefined();
    await moduleRef.close();
  });
});
