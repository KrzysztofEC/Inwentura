import './globals.css';
import type { Metadata } from 'next';
import { PWAInstaller } from '@/components/PWAInstaller';

export const metadata: Metadata = {
  title: 'Magazyn APP',
  description: 'Zarządzanie stanami magazynowymi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e293b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Magazyn APP" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <PWAInstaller />
        {children}
      </body>
    </html>
  );
}
