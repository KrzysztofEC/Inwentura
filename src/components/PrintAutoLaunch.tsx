'use client';
import { useEffect } from 'react';

export function PrintAutoLaunch() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
