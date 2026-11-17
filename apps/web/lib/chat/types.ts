export interface ChatListItem {
  id: string;
  kind: 'STUDENT_ADMIN' | 'STUDENT_TEACHER' | 'TEACHER_ADMIN';
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  team: boolean;
  lastMessageText: string | null;
  lastMessageAt: string;
  unread: number;
}

export interface ChatFile {
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  kind: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
  body: string | null;
  mine: boolean;
  senderName: string;
  createdAt: string;
  durationSec: number | null;
  file: ChatFile | null;
  /** Only on messages this browser is still sending, or could not send. */
  pending?: 'sending' | 'failed';
}

export interface ChatThreadData {
  conversation: {
    id: string;
    title: string;
    subtitle: string;
    avatarUrl: string | null;
    team: boolean;
  };
  seenAt: string;
  /** Goes up when a message is deleted or the chat is cleared. */
  revision: number;
  items: ChatMessage[];
}

export interface ChatContact {
  id: string;
  name: string;
  subtitle: string;
  avatarUrl: string | null;
}

/** What the composer hands over to be sent. */
export interface Outgoing {
  body: string;
  file?: File;
  voice?: boolean;
  durationSec?: number;
}
