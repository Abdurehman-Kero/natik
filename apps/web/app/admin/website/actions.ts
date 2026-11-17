'use server';

import { updateTag } from 'next/cache';
import { requireRole } from '@/lib/auth';

/**
 * Called by the website editor right after a save, so the public pages show the change at once
 * (FR-WEB-005). Only admins may trigger it.
 */
export async function refreshPublicSite(): Promise<void> {
  await requireRole(['ADMIN'], '/admin/website');
  updateTag('site');
}
