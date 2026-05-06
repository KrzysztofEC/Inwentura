'use client';

import { useState } from 'react';
import { makeSnapshot } from '@/app/actions';

export function SnapshotButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        const r = await makeSnapshot();
        setBusy(false);
        alert(r.ok ? 'Zapisano zrzut dnia.' : 'Błąd: ' + (r.error ?? '?'));
      }}
      disabled={busy}
      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
    >
      {busy ? '...' : '📸 Zrzut dnia'}
    </button>
  );
}
