// products.ts — aliasy ładowane z bazy danych przez API
// Statyczna lista służy tylko jako fallback gdy API niedostępne

export interface ProductDef {
  code: string;
  name: string;
  aliases: string[];
}

// ============================================================
// NORMALIZACJA
// ============================================================
function normalizeStr(s: string): string {
  return s.trim().toUpperCase()
    .replace(/Ą/g,'A').replace(/Ć/g,'C').replace(/Ę/g,'E')
    .replace(/Ł/g,'L').replace(/Ń/g,'N').replace(/Ó/g,'O')
    .replace(/Ś/g,'S').replace(/Ź/g,'Z').replace(/Ż/g,'Z');
}

// ============================================================
// DYNAMICZNY ALIAS MAP — ładowany z bazy
// ============================================================
let dynamicAliasMap: Map<string, string> | null = null;
let dynamicNameMap: Map<string, string> | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadProductsFromAPI(): Promise<void> {
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    if (!res.ok) return;
    const data: ProductDef[] = await res.json();
    const amap = new Map<string, string>();
    const nmap = new Map<string, string>();
    for (const p of data) {
      nmap.set(p.code, p.name);
      amap.set(normalizeStr(p.code), p.code);
      for (const alias of p.aliases ?? []) {
        amap.set(normalizeStr(alias), p.code);
      }
    }
    dynamicAliasMap = amap;
    dynamicNameMap = nmap;
  } catch {
    // fallback do statycznej listy
  }
}

export function ensureProductsLoaded(): Promise<void> {
  if (dynamicAliasMap) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = loadProductsFromAPI().finally(() => { loadPromise = null; });
  }
  return loadPromise;
}

export function invalidateProductsCache(): void {
  dynamicAliasMap = null;
  dynamicNameMap = null;
}

// ============================================================
// STATYCZNY FALLBACK
// ============================================================
const STATIC_PRODUCTS: Record<string, string> = {
  K: 'Kostka', KD: 'Kostka duża', KC: 'Kostka C', KB: 'Kostka B',
  KO: 'Kostka odsort', OK: 'Odzysk Kostka', ST: 'Sticksy', OS: 'Odzysk Sticksy',
  S: 'Semolina', SR: 'Semolina SR', SPG: 'Semolina po grysie',
  SZ: 'Semolina żółta', SB: 'Semolina B', SO: 'Semolina Organic',
  P: 'Proszek', PZ: 'Proszek żółty', G: 'Grys', GR: 'Granulat', GRYSIK: 'Grysik',
  GBIO: 'Grys BIO', GRBIO: 'Granulat BIO', GRYSIKBIO: 'Grysik BIO',
  KBIO: 'Kostka BIO', KBBIO: 'Kostka B BIO', KOBIO: 'Kostka odsort BIO',
  KM: 'Kasza Manna',
};

const STATIC_ALIASES: Record<string, string> = {
  K: 'K', KOSTKA: 'K',
  KD: 'KD', 'KOSTKA DUZA': 'KD', 'KOSTKA DUŻA': 'KD',
  KC: 'KC', 'KOSTKA C': 'KC',
  KB: 'KB', 'KOSTKA B': 'KB',
  KO: 'KO', 'KOSTKA ODSORT': 'KO',
  OK: 'OK', 'ODZYSK KOSTKA': 'OK',
  ST: 'ST', STICKSY: 'ST',
  OS: 'OS', 'ODZYSK STICKSY': 'OS',
  S: 'S', SEMOLINA: 'S',
  SR: 'SR', 'SEMOLINA SR': 'SR',
  SPG: 'SPG', 'SEMOLINA PO GRYSIE': 'SPG',
  SZ: 'SZ', 'SEMOLINA ZOLTA': 'SZ', SŻ: 'SZ',
  SB: 'SB', 'SEMOLINA B': 'SB',
  SO: 'SO', 'SEMOLINA ORGANIC': 'SO',
  P: 'P', PROSZEK: 'P',
  PZ: 'PZ', 'PROSZEK ZOLTY': 'PZ', PŻ: 'PZ',
  G: 'G', GRYS: 'G',
  GR: 'GR', GRANULAT: 'GR',
  GRYSIK: 'GRYSIK',
  GBIO: 'GBIO', 'GRYS BIO': 'GBIO', 'G BIO': 'GBIO',
  GRBIO: 'GRBIO', 'GRANULAT BIO': 'GRBIO', 'GR BIO': 'GRBIO',
  GRYSIKBIO: 'GRYSIKBIO', 'GRYSIK BIO': 'GRYSIKBIO',
  KBIO: 'KBIO', 'KOSTKA BIO': 'KBIO', 'K BIO': 'KBIO',
  KBBIO: 'KBBIO', 'KOSTKA B BIO': 'KBBIO', 'KB BIO': 'KBBIO',
  KOBIO: 'KOBIO', 'KOSTKA ODSORT BIO': 'KOBIO', 'KO BIO': 'KOBIO',
  KM: 'KM', 'KASZA MANNA': 'KM',
};

function resolveAlias(norm: string): string | null {
  // Najpierw dynamiczna mapa z bazy
  if (dynamicAliasMap) return dynamicAliasMap.get(norm) ?? null;
  // Fallback statyczny
  return STATIC_ALIASES[norm] ?? null;
}

export function productName(code: string | null): string {
  if (!code) return '';
  if (dynamicNameMap) return dynamicNameMap.get(code) ?? code;
  return STATIC_PRODUCTS[code] ?? code;
}

// ============================================================
// PARSE — synchroniczny, używa załadowanej mapy
// ============================================================
function resolvePart(s: string): { code: string | null; kwit: string | null; isUnknown: boolean } {
  if (!s) return { code: null, kwit: null, isUnknown: false };
  if (/^\d+$/.test(s)) return { code: 'K', kwit: s, isUnknown: false };

  // Kod + numer kwitu: "K 1580" lub "GRANULAT 1580"
  const kwitMatch = s.match(/^(.+?)\s+(\d{3,})$/);
  if (kwitMatch) {
    const label = kwitMatch[1].trim();
    const kwit = kwitMatch[2];
    const norm = normalizeStr(label);
    const code = resolveAlias(norm);
    return code ? { code, kwit, isUnknown: false } : { code: 'UNKNOWN', kwit, isUnknown: true };
  }

  const norm = normalizeStr(s);
  const code = resolveAlias(norm);
  if (code) return { code, kwit: null, isUnknown: false };
  return { code: 'UNKNOWN', kwit: null, isUnknown: true };
}

export function parseProductCode(raw: string): {
  code: string | null;
  codeBot: string | null;
  kwit: string | null;
  isUnknown: boolean;
} {
  if (!raw || !raw.trim()) return { code: null, codeBot: null, kwit: null, isUnknown: false };

  const parts = raw.split('/').map(p => p.trim());

  if (parts.length === 1) {
    const r = resolvePart(parts[0]);
    return { code: r.code, codeBot: null, kwit: r.kwit, isUnknown: r.isUnknown };
  }

  const top = resolvePart(parts[0]);
  const bot = resolvePart(parts[1]);
  return {
    code: top.code,
    codeBot: bot.code !== top.code ? bot.code : null,
    kwit: top.kwit ?? bot.kwit,
    isUnknown: top.isUnknown || bot.isUnknown,
  };
}
