import type { MetadataRoute } from 'next';

/** Lets phones add Natik to the home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Natik Language Centre',
    short_name: 'Natik',
    description: 'Learn Arabic, English and Afaan Oromo online.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f6f2',
    theme_color: '#123b5a',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
