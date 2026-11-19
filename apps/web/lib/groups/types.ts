export type GroupRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface GroupListItem {
  courseId: string;
  title: string;
  language: string;
  imageUrl: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unread: number;
}

export interface GroupMember {
  id: string;
  name: string;
  role: GroupRole;
  avatarUrl: string | null;
}

export interface GroupInfo {
  course: { id: string; title: string; slug: string; imageUrl: string | null };
  me: { role: GroupRole; canModerate: boolean };
  members: GroupMember[];
  counts: { students: number; teachers: number; admins: number; total: number };
  pinned: { id: string; text: string } | null;
}

export interface GroupFile {
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface GroupReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface GroupMessage {
  id: string;
  kind: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'FILE' | 'SYSTEM';
  body: string | null;
  mine: boolean;
  deleted: boolean;
  edited: boolean;
  pinned: boolean;
  createdAt: string;
  sender: { id: string; name: string; role: GroupRole; avatarUrl: string | null };
  durationSec: number | null;
  file: GroupFile | null;
  replyTo: { id: string; senderName: string; text: string } | null;
  reactions: GroupReaction[];
  /** Only on messages this browser is still sending, or could not send. */
  pending?: 'sending' | 'failed';
}

export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '👏'] as const;
