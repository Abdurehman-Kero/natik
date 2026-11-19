/** A person's profile card (what you see when you tap someone in a chat or a course group). */
export interface PersonCard {
  id: string;
  name: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatarUrl: string | null;
  /** True when it is the signed-in person's own card. */
  isMe: boolean;
  /** Teachers and the Natik team only. */
  bio: string | null;
  memberSince: string;
  teaches: { title: string; slug: string; language: string }[];
  sharedCourses: { id: string; title: string; slug: string }[];
  /** Shown to teachers and the Natik team, never to other students. */
  location: { country: string | null; city: string | null } | null;
  /** Shown to the Natik team only. */
  contact: { phone: string | null; email: string | null } | null;
  /** What to pass to "open a chat" to write to this person, or null when that is not allowed. */
  messageWith: string | null;
}
