import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** Where the Next.js server reaches the API (private network in production). */
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone for a small self-contained server;
  // local `next start` (and the e2e tests) use the normal output.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // Monorepo: trace files from the repository root so the standalone build includes workspace packages.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  reactStrictMode: true,
  // The corner badge that says "Rendering…" while a page compiles in development only gets in the way;
  // the Natik loader and the gold progress bar already show that something is happening.
  devIndicators: false,
  poweredByHeader: false,
  // Uploads (PDFs and audio up to 25 MB, development videos up to 100 MB) pass through this proxy.
  // Without this, anything over 10 MB is cut off.
  experimental: {
    proxyClientMaxBodySize: '110mb',
    // A page fetched ahead of a click is reused for up to 30 seconds (the shortest Next.js allows), so
    // the click is instant. Pages already visited are fetched again, so they always show the latest
    // data; anything the person changes clears the early copies too (components/ui/link.tsx).
    staleTimes: { dynamic: 0, static: 30 },
    optimizePackageImports: ['@natik/shared', 'react-icons/fa6', 'lucide-react', 'radix-ui'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Same-origin API: the browser calls /api/*, which is forwarded to the NestJS API.
  // In production the reverse proxy does this first; this rewrite is the fallback.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
