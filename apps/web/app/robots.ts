import type { MetadataRoute } from 'next';
import { appEnv } from '@/lib/site-config';

// Staging and production run the same image, so read APP_ENV per request, not at build time.
export const dynamic = 'force-dynamic';

/** Only production is indexed; local and staging sites are hidden from search engines. */
export default function robots(): MetadataRoute.Robots {
  if (appEnv() !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/teach', '/dashboard', '/styleguide'],
      },
    ],
  };
}
