import {
  Award,
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  Compass,
  CreditCard,
  Globe,
  House,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  Megaphone,
  MessageCircle,
  ScrollText,
  Settings,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';

/** `label` is a key under messages.nav (e.g. "student.home"). */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which badge count to show, filled in by later milestones. */
  badge?: 'marking' | 'payments' | 'messages' | 'chat' | 'certificates';
  /** Exact match only (for dashboard roots like /admin). */
  exact?: boolean;
}

export interface NavGroup {
  /** Key under messages.nav, or null for an untitled group. */
  label: string | null;
  items: NavItem[];
}

export const publicNav = [
  { label: 'public.courses', href: '/courses' },
  { label: 'public.freeLessons', href: '/free-lessons' },
  { label: 'public.about', href: '/about' },
  { label: 'public.help', href: '/help' },
  { label: 'public.contact', href: '/contact' },
] as const;

/** Student area: the sidebar on larger screens lists everything; phones show the first four only. */
export const studentNav: NavItem[] = [
  { label: 'student.home', href: '/dashboard', icon: House, exact: true },
  { label: 'student.myCourses', href: '/my-courses', icon: BookOpen },
  { label: 'student.browse', href: '/browse', icon: Compass },
  { label: 'student.chat', href: '/chat', icon: MessageCircle, badge: 'chat' },
  { label: 'student.announcements', href: '/announcements', icon: Megaphone },
  { label: 'student.payments', href: '/profile/payments', icon: Wallet },
  { label: 'student.profile', href: '/profile', icon: UserRound, exact: true },
  // The certificate is what you earn at the end, so it comes last.
  { label: 'student.certificates', href: '/certificates', icon: Award },
];

/** The four tabs on a phone (DESIGN.md �8), with their short labels. */
export const studentPhoneTabs: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'student.home' },
  { href: '/my-courses', label: 'student.courses' },
  { href: '/profile', label: 'student.profile' },
  { href: '/certificates', label: 'student.certificates' },
];

export const teacherNav: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'teacher.dashboard', href: '/teach', icon: LayoutDashboard, exact: true },
      { label: 'teacher.courses', href: '/teach/courses', icon: BookOpen },
      { label: 'teacher.marking', href: '/teach/marking', icon: ClipboardCheck, badge: 'marking' },
      { label: 'teacher.chat', href: '/teach/chat', icon: MessageCircle, badge: 'chat' },
      { label: 'teacher.announcements', href: '/teach/announcements', icon: Megaphone },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    label: 'admin.groups.overview',
    items: [{ label: 'admin.dashboard', href: '/admin', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'admin.groups.people',
    items: [
      { label: 'admin.users', href: '/admin/users', icon: Users },
      { label: 'admin.enrolments', href: '/admin/enrolments', icon: UsersRound },
    ],
  },
  {
    label: 'admin.groups.learning',
    items: [
      { label: 'admin.courses', href: '/admin/courses', icon: BookOpen },
      { label: 'admin.marking', href: '/teach/marking', icon: ClipboardCheck, badge: 'marking' },
      {
        label: 'admin.certificates',
        href: '/admin/certificates',
        icon: Award,
        badge: 'certificates',
      },
    ],
  },
  {
    label: 'admin.groups.money',
    items: [
      { label: 'admin.payments', href: '/admin/payments', icon: CreditCard, badge: 'payments' },
    ],
  },
  {
    label: 'admin.groups.communication',
    items: [
      { label: 'admin.chat', href: '/admin/chat', icon: MessageCircle, badge: 'chat' },
      { label: 'admin.announcements', href: '/admin/announcements', icon: Megaphone },
      { label: 'admin.messages', href: '/admin/messages', icon: Mail, badge: 'messages' },
    ],
  },
  {
    label: 'admin.groups.website',
    items: [{ label: 'admin.website', href: '/admin/website', icon: Globe }],
  },
  {
    label: 'admin.groups.insights',
    items: [
      { label: 'admin.reports', href: '/admin/reports', icon: ChartColumn },
      { label: 'admin.activity', href: '/admin/activity', icon: ScrollText },
    ],
  },
  {
    label: 'admin.groups.system',
    items: [{ label: 'admin.settings', href: '/admin/settings', icon: Settings }],
  },
];

/** Is this nav item the current page (or a parent of it)? */
export function isActive(pathname: string, item: Pick<NavItem, 'href' | 'exact'>): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
