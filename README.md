# Magazyny - aplikacja Next.js + Supabase + Vercel

Webowa aplikacja do zarządzania stanami magazynowymi (Kostka, Sticksy, Semolina, Proszek, Granulat, BIO, BB...) z logowaniem, automatycznym sumowaniem i wydrukami kart magazynowych.

## Stack
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Baza**: Supabase (Postgres + Row Level Security)
- **Auth**: Supabase Auth (email + hasło)
- **Hosting**: Vercel

## 🚀 Wdrożenie krok po kroku

### 1. Załóż projekt Supabase
1. Wejdź na [supabase.com](https://supabase.com) i utwórz nowy projekt
2. W panelu projektu otwórz **SQL Editor**
3. Skopiuj zawartość `supabase/migrations/0001_init.sql` i uruchom (przycisk **Run**)
4. Przejdź do **Settings → API** i skopiuj:
   - `Project URL`
   - `anon public` klucz
   - `service_role` klucz (tylko do importera, **trzymaj w sekrecie**)

### 2. Wgraj kod na GitHub
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:TWOJUSER/magazyn-app.git
git push -u origin main
```

### 3. Wdróż na Vercel
1. Wejdź na [vercel.com](https://vercel.com) → **Add New → Project**
2. Wybierz repozytorium z GitHuba
3. Framework: **Next.js** (powinno wykryć automatycznie)
4. W **Environment Variables** dodaj:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL z punktu 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key z punktu 1
5. Kliknij **Deploy**

Po kilku minutach aplikacja będzie pod adresem `https://twoja-nazwa.vercel.app`.

### 4. Pierwsze logowanie
Otwórz aplikację → kliknij **"Nie masz konta? Załóż"** → zarejestruj się emailem i hasłem.

⚠️ **Ważne**: domyślnie Supabase wymaga potwierdzenia emaila. Jeśli chcesz to wyłączyć (lub mieć tylko zaufane konta), wejdź w **Supabase → Authentication → Providers → Email → Confirm email = OFF**, albo w **Authentication → Settings → Allow new users** ustaw na off i twórz konta ręcznie z poziomu panelu.

### 5. Zaimportuj dane z Twojego excela
Lokalnie na swoim komputerze (jednorazowa operacja):

```bash
git clone <twoje repo>
cd magazyn-app
npm install
cp .env.example .env.local
# Wpisz w .env.local wszystkie 3 zmienne (w tym SUPABASE_SERVICE_ROLE_KEY)
cp /sciezka/do/inwentura.xlsx ./
npm run import:xlsx
```

Wszystkie dane z arkuszy `MAGAZYN LEWA STRONA`, `MAGAZYN PRAWA STRONA`, `WIATA`, `BLASZAK 1`, `BLASZAK 2`, `Ambro` zostaną wgrane do bazy. Po zakończeniu odśwież stronę aplikacji.

## 💻 Praca lokalna (development)

```bash
npm install
cp .env.example .env.local
# Uzupełnij .env.local
npm run dev
```
Aplikacja na `http://localhost:3000`.

## 📋 Workflow codzienny

1. **Rano**: zaloguj się, w każdym magazynie kliknij **🖨 Drukuj wypełnioną** → zanieś wydruki na produkcję
2. **W ciągu dnia**: pracownicy piszą zmiany długopisem na wydrukach
3. **Następnego dnia**: wracasz do aplikacji, klikasz w komórki i aktualizujesz wagi/kody
4. **Suma odświeża się natychmiast** (nie ma już kłopotów z formułami w excelu)
5. Drukujesz nowe karty (lub **📄 Drukuj pustą** jeśli potrzeba więcej miejsca do dopisywania)
6. **📸 Zrzut dnia** zapisuje migawkę wszystkich stanów do tabeli `snapshots`

## 🔤 Inteligentny parser kodów

W każdym polu z produktem możesz wpisać:
- `K`, `Kostka` → Kostka (kod K)
- `KBIO`, `K BIO`, `Kostka BIO` → Kostka BIO
- `1580` (sam numer) → Kostka z numerem kwitu 1580
- `K / 1580` → Kostka + kwit 1580
- `GBB / KBIO` → Grys BB (przy dwóch kodach bierze pierwszy)
- `Granulat`, `GR` → Granulat
- `Semolina SR`, `SR` → Semolina SR
- `PŻ`, `Proszek żółty` → PZ
- ... pełna lista w `src/lib/products.ts`

**Czerwone tło komórki** = parser nie rozpoznał kodu → kliknij i popraw.

## 🗂 Struktura kodu

```
src/
  app/
    page.tsx                    # podsumowanie wszystkich magazynów
    login/page.tsx              # ekran logowania
    warehouse/[key]/page.tsx    # widok magazynu (siatka + kontenery)
    print/[key]/page.tsx        # wydruk wypełniony / pusty (?empty=1)
    api/export/route.ts         # eksport CSV
    actions.ts                  # Server Actions (zapis do Supabase)
  components/                   # interaktywne klienty (modal, edytory)
  lib/
    products.ts                 # słownik aliasów + parser
    warehouses.ts               # konfiguracja magazynów
    supabase/                   # client / server / SSR
  middleware.ts                 # ochrona stron przed niezalogowanymi
supabase/
  migrations/0001_init.sql      # schemat bazy + RLS + widok totals
scripts/
  import-xlsx.ts                # importer z inwentura.xlsx
```

## 🔧 Modyfikacje

- **Dodanie aliasu produktu** → edytuj `ALIASES_RAW` w `src/lib/products.ts`
- **Inna liczba rzędów w magazynie** → edytuj `WAREHOUSES` w `src/lib/warehouses.ts`
- **Zmiana układu wydruku** → `src/app/print/[key]/page.tsx`

## 🛡 Bezpieczeństwo

- Wszystkie tabele mają **Row Level Security** włączone — tylko zalogowani widzą dane
- Hasła i sesje obsługuje Supabase Auth (bcrypt, refresh tokens, HttpOnly cookies)
- `service_role` klucz nigdy nie trafia do kodu klienta — używaj go tylko w `scripts/import-xlsx.ts`
- Vercel automatycznie wymusza HTTPS

## 📊 Co robić jak coś nie działa

| Problem | Rozwiązanie |
|---|---|
| Nie mogę się zalogować | Sprawdź czy w Supabase potwierdziłeś email |
| Pusta strona po wdrożeniu | Sprawdź zmienne środowiskowe w Vercel → Settings |
| Importer mówi "Brak SUPABASE_SERVICE_ROLE_KEY" | Uzupełnij `.env.local` |
| Niektóre wpisy są na czerwono (UNKNOWN) | Kliknij i popraw — dodaj alias w `products.ts` jeśli używasz go często |
| Sumy się nie zgadzają | To znak że gdzieś jest UNKNOWN lub pusta waga — strona główna pokaże gdzie |
