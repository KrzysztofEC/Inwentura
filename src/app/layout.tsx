import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PWAInstaller } from '@/components/PWAInstaller';

export const metadata: Metadata = {
  title: 'Magazyny',
  description: 'Zarządzanie stanami magazynowymi',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Magazyn APP',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e293b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        {children}
        <PWAInstaller />
      </body>
    </html>
  );
}
