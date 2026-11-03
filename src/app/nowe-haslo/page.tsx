'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

export default function NoweHasloPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Odczytaj link z e-maila i zaloguj użytkownika tymczasowo, żeby mógł ustawić nowe hasło
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const linkError = url.searchParams.get('error_description') || hash.get('error_description');

      if (linkError) { if (!cancelled) setStage('invalid'); return; }

      try {
        if (tokenHash) {
          // Wariant z szablonem e-maila używającym {{ .TokenHash }} – działa na każdym urządzeniu
          const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
          if (error) throw error;
        } else if (code) {
          // Domyślny wariant Supabase (PKCE)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // Klient mógł już sam wymienić kod – sprawdzamy, czy sesja istnieje
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw error;
          }
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get('access_token')!,
            refresh_token: hash.get('refresh_token')!,
          });
          if (error) throw error;
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setStage(data.session ? 'ready' : 'invalid');
        // Usuń kod z paska adresu
        window.history.replaceState(null, '', '/nowe-haslo');
      } catch {
        if (!cancelled) setStage('invalid');
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Hasło musi mieć co najmniej 8 znaków.'); return; }
    if (password !== password2) { setError('Hasła nie są takie same.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      if (/different from the old/i.test(error.message)) setError('Nowe hasło musi się różnić od poprzedniego.');
      else if (/weak|short|characters/i.test(error.message)) setError('Hasło jest za słabe. Użyj dłuższego hasła z cyframi i literami.');
      else setError('Nie udało się zmienić hasła: ' + error.message);
      return;
    }
    setStage('done');
    setTimeout(() => { router.push('/'); router.refresh(); }, 1500);
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-900">Ustaw nowe hasło</h1>

        {stage === 'checking' && <p className="mt-4 text-sm text-slate-600">Sprawdzanie linku…</p>}

        {stage === 'invalid' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Link jest nieważny albo wygasł. Linki działają godzinę i tylko raz. Poproś o nowy.
            </p>
            <Link href="/reset-hasla" className="block text-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white py-2.5 text-sm font-semibold">
              Wyślij nowy link
            </Link>
          </div>
        )}

        {stage === 'done' && (
          <p className="mt-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Hasło zostało zmienione. Przekierowuję do aplikacji…
          </p>
        )}

        {stage === 'ready' && (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="p1" className="block text-xs font-medium text-slate-600 mb-1">Nowe hasło</label>
              <input id="p1" type={show ? 'text' : 'password'} required autoFocus autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="p2" className="block text-xs font-medium text-slate-600 mb-1">Powtórz hasło</label>
              <input id="p2" type={show ? 'text' : 'password'} required autoComplete="new-password"
                value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 select-none">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Pokaż hasło
            </label>
            <p className="text-xs text-slate-500">Co najmniej 8 znaków.</p>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white py-2.5 text-sm font-semibold">
              {loading ? 'Zapisywanie…' : 'Zapisz nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
