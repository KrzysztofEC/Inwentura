'use client';

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      gap: '16px',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '64px' }}>📦</div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Brak połączenia</h1>
      <p style={{ color: '#94a3b8', margin: 0, maxWidth: '300px' }}>
        Sprawdź połączenie internetowe i spróbuj ponownie.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#38bdf8',
          color: '#0c4a6e',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '8px',
        }}
      >
        Odśwież
      </button>
    </div>
  );
}
