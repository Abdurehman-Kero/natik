import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../../jobs/queues';
import { CertificatesService } from './certificates.service';

/** Opens certificate requests and prints approved certificates in the background. */
@Processor(QUEUES.CERTIFICATE)
@Injectable()
export class CertificateProcessor extends WorkerHost {
  constructor(private readonly certificates: CertificatesService) {
    super();
  }

  async process(job: Job<{ enrolmentId?: string; certificateId?: string }>): Promise<void> {
    // "issue" is the old name of this job; ones queued before the change are handled the same way.
    if ((job.name === 'request' || job.name === 'issue') && job.data.enrolmentId) {
      await this.certificates.openRequest(job.data.enrolmentId);
    } else if (job.name === 'render' && job.data.certificateId) {
      await this.certificates.render(job.data.certificateId);
    }
  }
}
