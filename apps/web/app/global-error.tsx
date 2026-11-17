'use client';

/**
 * Last-resort error page when the root layout itself fails. It can't rely on
 * translations or app styles, so it is plain and self-contained.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f7f6f2',
          color: '#202a32',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 16,
        }}
      >
        <div>
          <h1 style={{ color: '#123b5a', fontSize: 26, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 24px' }}>Please try again. If it keeps happening, contact us.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#123b5a',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
