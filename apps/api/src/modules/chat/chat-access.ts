import type { ConversationKind } from '../../generated/prisma/client';

export interface ChatActor {
  id: string;
  role: string;
}
export interface ChatConversationRef {
  kind: ConversationKind;
  ownerId: string;
  peerId: string | null;
}

/**
 * Who may open a conversation: the two people in it. Admins answer for the Natik team, so they open
 * every student-admin and teacher-admin chat, but never a private student-teacher chat.
 */
export function canOpenConversation(actor: ChatActor, conversation: ChatConversationRef): boolean {
  if (actor.role === 'ADMIN') return conversation.kind !== 'STUDENT_TEACHER';
  return conversation.ownerId === actor.id || conversation.peerId === actor.id;
}
