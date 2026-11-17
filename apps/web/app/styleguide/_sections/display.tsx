'use client';

import { formatDateTime, formatMoney, formatPrice } from '@natik/shared';
import { BookOpen, CreditCard, Mail, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge, CountBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { CourseCard } from '@/components/ui/course-card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { STATUS_KEYS, StatusPill } from '@/components/ui/status-pill';
import { Timeline } from '@/components/ui/timeline';
import { Demo, Section } from './section';

export function Display() {
  return (
    <>
      <Section
        id="status"
        title="Status"
        note="One look per status, everywhere. Always an icon and a word, never colour alone."
      >
        <Demo title="Status pills" className="flex flex-wrap gap-2">
          {STATUS_KEYS.map((key) => (
            <StatusPill key={key} status={key} />
          ))}
        </Demo>
        <Demo title="Badges, counts and avatars" className="flex flex-wrap items-center gap-4">
          <Badge>Arabic</Badge>
          <Badge tone="accent">Free</Badge>
          <Badge tone="muted">Beginner</Badge>
          <span className="flex items-center gap-2 font-medium">
            Payments to check <CountBadge count={5} label="waiting" />
          </span>
          <Avatar name="Abdi Kedir" />
          <Avatar name="Sara Mohammed" size="lg" />
          <Avatar name="Hana" size="sm" />
        </Demo>
      </Section>

      <Section
        id="cards"
        title="Cards"
        note="Course cards show a title and three facts. Dashboard numbers link to the work behind them."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CourseCard
            href="/courses"
            title="Arabic for Beginners"
            language="Arabic"
            level="Beginner"
            duration="8 weeks"
            priceLabel={formatPrice('PAID', 150000)}
          />
          <CourseCard
            href="/courses"
            title="القراءة والكتابة"
            titleLang="ar"
            language="Arabic"
            level="Intermediate"
            duration="10 weeks"
            priceLabel={formatPrice('PAID', 180000)}
          />
          <CourseCard
            href="/courses"
            title="Afaan Oromo Basics"
            language="Afaan Oromo"
            level="Beginner"
            duration="6 weeks"
            priceLabel={formatPrice('FREE', null)}
            isFree
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard value="1,248" label="Students" icon={UsersRound} />
          <StatCard value="+36" label="New this week" />
          <StatCard
            value={5}
            label="Payments to check"
            icon={CreditCard}
            href="/admin/payments"
            actionLabel="Review now"
            highlight
          />
          <StatCard
            value={3}
            label="New messages"
            icon={Mail}
            href="/admin/messages"
            actionLabel="Open inbox"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Demo title="Empty state">
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Pick one to get started."
              action={<LinkButton href="/courses">Browse courses</LinkButton>}
              className="py-4"
            />
          </Demo>
          <Demo title="Details and history" className="flex flex-col gap-6">
            <KeyValue
              columns={2}
              items={[
                { label: 'Amount', value: formatMoney(150000) },
                { label: 'Method', value: 'telebirr' },
                { label: 'Reference', value: 'FT2431XYZ' },
                { label: 'Checked by', value: null },
              ]}
            />
            <Timeline
              items={[
                {
                  id: '1',
                  title: 'Payment confirmed by Hana',
                  time: formatDateTime('2026-11-04T07:42:00Z'),
                  tone: 'accent',
                },
                {
                  id: '2',
                  title: 'Reference submitted',
                  time: formatDateTime('2026-11-03T15:10:00Z'),
                },
                {
                  id: '3',
                  title: 'Enrolment created',
                  time: formatDateTime('2026-11-03T15:02:00Z'),
                  tone: 'muted',
                },
              ]}
            />
          </Demo>
        </div>
      </Section>

      <Section id="progress" title="Progress" note="Navy while learning, gold when complete.">
        <Demo title="Bars" className="flex max-w-md flex-col gap-4">
          <ProgressBar value={0} showValue />
          <ProgressBar value={42} showValue />
          <ProgressBar value={100} showValue />
          <ProgressBar value={64} size="sm" />
        </Demo>
        <Demo title="Quiz result rings" className="flex flex-wrap items-center gap-8">
          <ProgressRing value={80} tone="accent" label="80%, passed" />
          <ProgressRing value={45} label="45%, not passed" />
          <ProgressRing value={100} tone="accent" size="md" />
        </Demo>
      </Section>
    </>
  );
}
