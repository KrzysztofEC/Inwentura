'use client';

import { useEffect } from 'react';

export function PWAInstaller() {
  useEffect(() => {
    // Rejestruj service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.log('SW error:', err));
    }
  }, []);

  return null;
}
