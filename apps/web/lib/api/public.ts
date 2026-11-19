import 'server-only';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Reads public website data (courses, news…). Cached briefly and never sends cookies.
 * If the API is unreachable it returns `fallback`, so marketing pages still render.
 */
export async function publicFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 10, tags: ['site'] },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface PublicLanguage {
  id: string;
  name: string;
  code: string;
  direction: 'LTR' | 'RTL';
  courseCount: number;
}

export interface PublicFilters {
  languages: PublicLanguage[];
  levels: { id: string; name: string }[];
}

export interface PublicCourse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  durationText: string | null;
  access: 'FREE' | 'PAID';
  /** Null for a premium course whose price is kept off the public site. */
  priceSantim: number | null;
  showPrice: boolean;
  accessDays: number | null;
  outcomes: string[];
  featured: boolean;
  imageUrl: string | null;
  language: { name: string; code: string; direction: 'LTR' | 'RTL' };
  level: { name: string };
}

export interface PublicCourseDetail extends PublicCourse {
  descriptionHtml: string;
  trailerEmbedUrl: string | null;
  lessonOrder: 'OPEN' | 'IN_ORDER';
  teachers: { name: string; bio: string | null }[];
  outline: {
    id: string;
    title: string;
    lessons: { id: string; title: string; sessionDate: string | null }[];
  }[];
  /** Sessions are still being added week by week. */
  ongoing: boolean;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
}

/** Text blocks admins edit in Admin › Website. A missing entry means "use the built-in wording". */
export interface PublicSiteContent {
  home: { heroEyebrow?: string; heroTitle?: string; heroSubtitle?: string } | null;
  about: { mission?: string } | null;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
    mapUrl?: string;
    telegram?: string;
    telegramContact?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  } | null;
  /** The how-to videos for the Help tab (YouTube or Vimeo links). */
  help: { studentVideoUrl?: string; teacherVideoUrl?: string } | null;
}

export const EMPTY_SITE_CONTENT: PublicSiteContent = {
  home: null,
  about: null,
  contact: null,
  help: null,
};

export interface PublicFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface PublicTestimonial {
  id: string;
  name: string;
  quote: string;
  courseLabel: string | null;
  /** The student's picture, if the admin uploaded one. */
  photoUrl: string | null;
}

export interface PublicPolicy {
  title: string;
  html: string;
  updatedAt: string;
}

export interface PublicStats {
  courses: number;
  lessons: number;
  learners: number;
  languages: number;
}

export interface PublicTeacher {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  languages: string[];
  courses: { slug: string; title: string }[];
}

export interface PlacementQuestion {
  id: string;
  band: number;
  text: string;
  options: { id: string; text: string }[];
}

export interface PlacementCheck {
  language: { name: string; code: string; direction: 'LTR' | 'RTL' };
  questions: PlacementQuestion[];
}

export interface PlacementResult {
  score: number;
  total: number;
  level: string | null;
  language: { name: string; code: string };
  courses: PublicCourse[];
}
