'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    const supabase = createClient();
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Konto utworzone. Możesz się zalogować (lub potwierdź email jeśli wymagane).');
        setMode('login');
      }
    } catch (e: any) {
      setError(e.message ?? 'Błąd');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-sm space-y-4">
      <div className="text-center">
        <div className="text-2xl">📦</div>
        <h1 className="text-xl font-semibold mt-1">Magazyny</h1>
        <p className="text-sm text-gray-500">{mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</p>
      </div>
      <div>
        <label className="block text-sm mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded" autoComplete="email" />
      </div>
      <div>
        <label className="block text-sm mb-1">Hasło</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {info && <div className="text-sm text-green-700 bg-green-50 p-2 rounded">{info}</div>}
      <button disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded disabled:opacity-50">
        {busy ? '...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
      </button>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="w-full text-sm text-gray-600 hover:text-gray-900">
        {mode === 'login' ? 'Nie masz konta? Załóż' : 'Masz konto? Zaloguj się'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div>Ładowanie...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
