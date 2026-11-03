'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetHaslaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nowe-haslo`,
    });
    setLoading(false);
    if (error) {
      if (/rate limit|too many|seconds/i.test(error.message)) {
        setError('Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.');
      } else {
        setError('Nie udało się wysłać wiadomości: ' + error.message);
      }
      return;
    }
    // Ten sam komunikat niezależnie od tego, czy konto istnieje (nie zdradzamy listy użytkowników)
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-900">Resetowanie hasła</h1>

        {sent ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-700">
              Jeśli konto <strong>{email}</strong> istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.
              Sprawdź skrzynkę (także folder SPAM) i kliknij link w ciągu godziny.
            </p>
            <p className="text-xs text-slate-500">
              Link otwórz najlepiej na tym samym urządzeniu i w tej samej przeglądarce.
            </p>
            <Link href="/login" className="block text-center text-sm font-medium text-slate-900 underline">
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">
              Podaj adres e-mail, którym logujesz się do aplikacji. Wyślemy na niego link do ustawienia nowego hasła.
            </p>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
              <input
                id="email" type="email" required autoFocus autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                placeholder="jan@firma.pl"
              />
            </div>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white py-2.5 text-sm font-semibold"
            >
              {loading ? 'Wysyłanie…' : 'Wyślij link'}
            </button>
            <Link href="/login" className="block text-center text-sm text-slate-600 hover:text-slate-900">
              Wróć do logowania
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
