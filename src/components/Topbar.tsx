import Link from 'next/link';
import { WAREHOUSES } from '@/lib/warehouses';

export function Topbar({ user }: { user: { email?: string | null } | null }) {
  return (
    <header className="bg-gray-900 text-white px-4 py-2 flex items-center gap-2 flex-wrap no-print">
      <Link href="/" className="font-semibold mr-2">📦 Magazyny</Link>
      <nav className="flex gap-1 flex-wrap text-sm">
        <Link href="/" className="px-3 py-1 rounded hover:bg-gray-700">Podsumowanie</Link>
        {Object.entries(WAREHOUSES).map(([k, c]) => (
          <Link key={k} href={`/warehouse/${k}`} className="px-3 py-1 rounded hover:bg-gray-700">
            {c.name.replace('Magazyn ', '').replace(' (zewnętrzny)', '')}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        {user?.email && <span className="text-gray-300 hidden sm:inline">{user.email}</span>}
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-gray-300 hover:text-white">Wyloguj</button>
        </form>
      </div>
    </header>
  );
}
