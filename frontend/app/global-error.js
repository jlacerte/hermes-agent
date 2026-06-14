'use client';

import { useEffect } from 'react';

// Envoie l'erreur au collecteur serveur — silencieux, ne relance jamais
function postErreur(error) {
  try {
    fetch('/api/clientlog', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: error?.message ?? '(aucun message)',
        stack: error?.stack ?? null,
        digest: error?.digest ?? null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ts: new Date().toISOString(),
      }),
    }).catch(() => {}); // ignorer les erreurs réseau
  } catch (_) {
    // ne jamais relancer depuis un error boundary
  }
}

// global-error DOIT rendre ses propres <html><body> (règle Next.js)
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    postErreur(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f3f5',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: '2rem',
            boxShadow: '0 1px 4px rgba(0,0,0,.08)',
          }}
        >
          <h1 style={{ margin: '0 0 .75rem', color: '#212529', fontSize: '1.25rem' }}>
            Une erreur est survenue
          </h1>

          {error?.message && (
            <p
              style={{
                margin: '0 0 .5rem',
                padding: '.75rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: 4,
                fontSize: '.9rem',
                color: '#664d03',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </p>
          )}

          {error?.digest && (
            <p style={{ margin: '0 0 1rem', fontSize: '.8rem', color: '#6c757d' }}>
              Référence&nbsp;: <code>{error.digest}</code>
            </p>
          )}

          <button
            onClick={reset}
            style={{
              padding: '.5rem 1.25rem',
              background: '#0d6efd',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
