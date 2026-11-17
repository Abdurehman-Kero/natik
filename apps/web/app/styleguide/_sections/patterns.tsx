'use client';

import { CircleAlert, Filter, MoreHorizontal, Pencil, Power, Send, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, SectionHeading, StickyActionBar } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { RadioCards } from '@/components/ui/radio-cards';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CourseCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Stepper } from '@/components/ui/stepper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Demo, Section } from './section';

interface DemoUser {
  id: string;
  name: string;
  phone: string;
  role: 'Student' | 'Teacher' | 'Admin';
  active: boolean;
}

const USERS: DemoUser[] = [
  { id: '1', name: 'Abdi Kedir', phone: '+251 91 234 5678', role: 'Student', active: true },
  { id: '2', name: 'Sara Mohammed', phone: '+251 92 111 2233', role: 'Teacher', active: true },
  { id: '3', name: 'Hana Tesfaye', phone: '+251 93 444 5566', role: 'Admin', active: true },
  { id: '4', name: 'Musa Bekele', phone: '+251 70 777 8899', role: 'Student', active: false },
];

function UserActions({ user }: { user: DemoUser }) {
  const tt = useTranslations('table');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={tt('rowActions', { name: user.name })}>
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => toast('Edit opens in M2')}>
          <Pencil aria-hidden /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast('Password link sent')}>
          <Send aria-hidden /> Send password link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => toast('Disable asks for confirmation')}>
          <Power aria-hidden /> Disable
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: Column<DemoUser>[] = [
  {
    key: 'name',
    header: 'Name',
    mobile: 'title',
    cell: (u) => (
      <span className="flex items-center gap-3">
        <Avatar name={u.name} size="sm" />
        <span className="font-medium text-ink">{u.name}</span>
      </span>
    ),
  },
  {
    key: 'phone',
    header: 'Phone',
    mobile: 'meta',
    cell: (u) => <span className="tabular-nums">{u.phone}</span>,
  },
  { key: 'role', header: 'Role', mobile: 'meta', cell: (u) => u.role },
  {
    key: 'status',
    header: 'Status',
    mobile: 'side',
    cell: (u) => (
      <StatusPill status={u.active ? 'enrolment.ACTIVE' : 'enrolment.CANCELLED'} size="sm" />
    ),
  },
];

export function Patterns() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <>
      <Section
        id="feedback"
        title="Feedback"
        note="Skeletons while loading, short toasts for success, plain words for errors."
      >
        <Demo title="Loading skeletons" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CourseCardSkeleton />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-2 h-11 w-36 rounded-xl" />
          </div>
        </Demo>
        <Demo title="Toasts" className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast.success('Lesson completed')}>
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.error("We couldn't save that. Check your connection and try again.")
            }
          >
            Error toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast('Payment confirmed', {
                action: { label: 'Undo', onClick: () => toast('Undone') },
              })
            }
          >
            Toast with Undo
          </Button>
        </Demo>
        <Demo title="Banners" className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            You&apos;re offline. Your answers are saved and will be sent when you reconnect.
          </p>
          <p className="flex items-center gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            This file is 32 MB. The maximum is 25 MB.
          </p>
        </Demo>
      </Section>

      <Section
        id="overlays"
        title="Overlays"
        note="Important actions ask first, using a verb on the button, never “Yes”."
      >
        <Demo title="Dialogs, sheet, menu, tooltip" className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Payment instructions</DialogTitle>
              <DialogDescription>
                Pay to one of these accounts, then submit your reference.
              </DialogDescription>
              <div className="mt-6 flex justify-end">
                <Button>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Disable account
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Disable this account?"
            description="Abdi Kedir will be signed out and can't sign in until enabled again."
            confirmLabel="Disable account"
            onConfirm={async () => {
              await new Promise((r) => setTimeout(r, 800));
              toast.success('Account disabled');
            }}
          />

          <Button variant="secondary" onClick={() => setRejectOpen(true)}>
            Reject payment (needs reason)
          </Button>
          <ConfirmDialog
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            title="Reject this payment?"
            description="The student gets an SMS with your reason and can submit again."
            confirmLabel="Reject payment"
            requireReason
            onConfirm={(reason) => {
              toast(`Rejected: ${reason}`);
            }}
          />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">
                <Filter aria-hidden /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" aria-describedby={undefined} className="p-5">
              <SheetTitle className="mb-4 text-xl font-semibold">Filters</SheetTitle>
              <RadioCards
                label="Language"
                defaultValue="all"
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'ar', label: 'Arabic' },
                  { value: 'en', label: 'English' },
                  { value: 'om', label: 'Afaan Oromo' },
                ]}
              />
              <Button className="mt-6" fullWidth>
                Show 12 courses
              </Button>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Pencil aria-hidden /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger">
                <Power aria-hidden /> Hide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip content="Visible to students now">
            <Button variant="ghost">Hover or focus me</Button>
          </Tooltip>
        </Demo>
      </Section>

      <Section id="navigation" title="Navigation">
        <Demo title="Tabs">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="teachers">Teachers</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
            </TabsList>
            <TabsContent value="details">Course details form.</TabsContent>
            <TabsContent value="content">Units and lessons.</TabsContent>
            <TabsContent value="teachers">Assigned teachers.</TabsContent>
            <TabsContent value="students">Enrolled students.</TabsContent>
          </Tabs>
        </Demo>
        <Demo title="Breadcrumb, pagination and steps" className="flex flex-col gap-6">
          <Breadcrumb
            items={[
              { label: 'Courses', href: '/admin/courses' },
              { label: 'Arabic for Beginners', href: '/admin/courses' },
              { label: 'Short vowels' },
            ]}
          />
          <Pagination
            page={4}
            totalPages={12}
            hrefFor={(p) => `/styleguide?page=${p}#navigation`}
          />
          <Stepper steps={['Phone', 'Code', 'New password']} current={1} />
        </Demo>
      </Section>

      <Section id="data" title="Data" note="A table on desktop; each row becomes a card on phones.">
        <DataTable
          caption="Users"
          columns={columns}
          rows={USERS}
          getRowId={(u) => u.id}
          rowActions={(u) => <UserActions user={u} />}
        />
      </Section>

      <Section
        id="layouts"
        title="Layouts"
        note="Page header with one action, section headings with the gold bar, and the four shells."
      >
        <Demo title="Page header and section heading">
          <PageHeader
            title="Users"
            subtitle="Search, add and manage accounts."
            back={{ href: '/admin', label: 'Dashboard' }}
            action={<Button>New user</Button>}
          />
          <SectionHeading title="Featured courses" link={{ href: '/courses', label: 'See all' }} />
        </Demo>
        <Demo title="Shells (open each)" className="flex flex-wrap gap-3">
          <LinkButton href="/" variant="secondary">
            Public
          </LinkButton>
          <LinkButton href="/sign-in" variant="secondary">
            Account
          </LinkButton>
          <LinkButton href="/dashboard" variant="secondary">
            Student
          </LinkButton>
          <LinkButton href="/teach" variant="secondary">
            Teacher
          </LinkButton>
          <LinkButton href="/admin" variant="secondary">
            Admin
          </LinkButton>
          <LinkButton href="/this-page-does-not-exist" variant="secondary">
            404
          </LinkButton>
        </Demo>
        <Demo title="Sticky action bar (phones)">
          <p className="mb-4 text-muted">
            On phones the main action stays at the bottom of the screen.
          </p>
          <StickyActionBar>
            <Button variant="secondary">Preview</Button>
            <Button>Publish</Button>
          </StickyActionBar>
        </Demo>
      </Section>
    </>
  );
}
