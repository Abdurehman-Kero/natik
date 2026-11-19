import type { Role, UserStatus } from '@natik/shared';

/** What the API returns for a user (never includes passwords or hashes). */
export interface UserView {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: Role;
  isOwner: boolean;
  status: UserStatus;
  photoUrl: string | null;
  bio: string | null;
  showOnWebsite: boolean;
  gender: 'MALE' | 'FEMALE' | null;
  /** Two-letter country code, e.g. ET. */
  country: string | null;
  city: string | null;
  lastSignInAt: string | null;
  erased?: boolean;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LanguageOption {
  id: string;
  name: string;
  code: string;
  direction: 'LTR' | 'RTL';
}

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  STUDENT: '/dashboard',
  TEACHER: '/teach',
  ADMIN: '/admin',
};

// ─── Course builder (M3) ───────────────────────────────────────────────────

export type ContentStatusValue = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
export type BlockKind = 'TEXT' | 'VIDEO' | 'PDF' | 'AUDIO' | 'IMAGE' | 'SLIDES' | 'FILE';

/** The steps of a guided lesson that a block can belong to (null = the plain lesson part). */
export type LessonStageName = 'PREPARE' | 'WATCH' | 'REVISE' | 'EXAMPLES';

/** A rich-text document (Tiptap/ProseMirror JSON). */
export type RichTextDoc = { type: 'doc'; content?: unknown[] };

export interface AdminCourseListItem {
  id: string;
  slug: string;
  title: string;
  status: ContentStatusValue;
  access: 'FREE' | 'PAID';
  priceSantim: number | null;
  featured: boolean;
  imageUrl: string | null;
  language: { id: string; name: string };
  level: { id: string; name: string };
  teachers: { id: string; fullName: string }[];
  studentCount: number;
  createdAt: string;
}

export interface AdminCourseDetail {
  id: string;
  slug: string;
  title: string;
  status: ContentStatusValue;
  languageId: string;
  levelId: string;
  summary: string;
  description: RichTextDoc | null;
  outcomes: string[];
  durationText: string | null;
  lessonOrder: 'OPEN' | 'IN_ORDER';
  showPrice: boolean;
  /** Sessions are still being added week by week. */
  ongoing: boolean;
  trailerUrl: string | null;
  access: 'FREE' | 'PAID';
  priceSantim: number | null;
  accessDays: number | null;
  featured: boolean;
  imageFileId: string | null;
  imageUrl: string | null;
  language: { id: string; name: string; code: string; direction: 'LTR' | 'RTL' };
  level: { id: string; name: string };
  teachers: { id: string; fullName: string }[];
  unitCount: number;
  lessonCount: number;
  studentCount: number;
}

export interface LanguageItem {
  id: string;
  name: string;
  code: string;
  direction: 'LTR' | 'RTL';
  active: boolean;
  position: number;
  courseCount: number;
}

export interface LevelItem {
  id: string;
  name: string;
  active: boolean;
  position: number;
  courseCount: number;
}

export interface TeacherCourse {
  id: string;
  title: string;
  status: ContentStatusValue;
  imageUrl: string | null;
  language: string;
  level: string;
  unitCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  studentCount: number;
}

export interface OutlineLesson {
  id: string;
  title: string;
  status: ContentStatusValue;
  /** When the session takes place. */
  sessionDate: string | null;
  blockTypes: BlockKind[];
}

export interface OutlineUnit {
  id: string;
  title: string;
  status: ContentStatusValue;
  lessons: OutlineLesson[];
}

export interface Outline {
  course: {
    id: string;
    title: string;
    status: ContentStatusValue;
    access: 'FREE' | 'PAID';
    priceSantim: number | null;
    accessDays: number | null;
    language: { name: string; code: string; direction: 'LTR' | 'RTL' };
    level: string;
    canEditSettings: boolean;
  };
  units: OutlineUnit[];
}

export type VideoStatusValue = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface EditorSlide {
  id: string;
  title: string;
  body: string | null;
  keywords: string[];
  imageUrl: string | null;
  imageFileId: string | null;
}

export interface EditorBlock {
  id: string;
  type: BlockKind;
  stage: LessonStageName | null;
  textJson: RichTextDoc | null;
  caption: string | null;
  slides: EditorSlide[];
  file: { id: string; url: string; name: string; sizeBytes: number } | null;
  video: {
    id: string;
    title: string;
    status: VideoStatusValue;
    durationSec: number | null;
    external: boolean;
    hasCaptions: boolean;
    posterUrl: string | null;
  } | null;
}

export interface EditorLesson {
  id: string;
  title: string;
  status: ContentStatusValue;
  sessionDate: string | null;
  downloadsAllowed: boolean;
  description: string | null;
  objectives: string[];
  estimatedMinutes: number | null;
  alwaysOpen: boolean;
  unit: { id: string; title: string };
  course: { id: string; title: string; lang: string; dir: 'ltr' | 'rtl' };
  blocks: EditorBlock[];
  quiz: {
    id: string;
    title: string;
    status: ContentStatusValue;
    isFinal: boolean;
    questionCount: number;
  } | null;
}

export interface LessonViewSlide {
  id: string;
  title: string;
  body: string | null;
  keywords: string[];
  imageUrl: string | null;
}

export type LessonViewBlock = { stage: LessonStageName | null } & (
  | { id: string; type: 'TEXT'; html: string }
  | { id: string; type: 'IMAGE'; url: string; caption: string | null }
  | { id: string; type: 'SLIDES'; slides: LessonViewSlide[] }
  | {
      id: string;
      type: 'PDF' | 'AUDIO';
      url: string;
      name: string;
      sizeBytes: number;
      caption: string | null;
      downloadUrl: string | null;
    }
  | {
      id: string;
      /** PowerPoint, Word or Excel: downloaded. */
      type: 'FILE';
      url: string;
      name: string;
      sizeBytes: number;
      caption: string | null;
    }
  | {
      id: string;
      type: 'VIDEO';
      videoId: string;
      title: string;
      status: string;
      durationSec: number | null;
      posterUrl: string | null;
      caption: string | null;
    }
);

export interface LessonViewModel {
  id: string;
  title: string;
  description: string | null;
  objectives: string[];
  estimatedMinutes: number | null;
  isFreePreview: boolean;
  downloadsAllowed: boolean;
  course: { id: string; title: string; lang: string; dir: 'ltr' | 'rtl' };
  unit: { id: string; title: string };
  blocks: LessonViewBlock[];
}

export type VideoPlayback =
  | { kind: 'iframe'; url: string; expiresAt: number }
  | { kind: 'file'; url: string; captionsUrl?: string };

export type VideoUpload =
  | { kind: 'tus'; endpoint: string; headers: Record<string, string> }
  | { kind: 'direct'; url: string };

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}
