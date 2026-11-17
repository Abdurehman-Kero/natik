import { getTranslations } from 'next-intl/server';
import { ChatApp } from '@/components/chat/chat-app';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('chat');
  return { title: t('title') };
}

/** Chat with the Natik team and with teachers or students (voice, pictures and files included). */
export default async function ChatPage() {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/chat');
  return <ChatApp isAdmin={false} />;
}
