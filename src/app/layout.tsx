import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Magazyny',
  description: 'Zarządzanie stanami magazynowymi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
