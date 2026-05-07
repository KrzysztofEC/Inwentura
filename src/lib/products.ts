// Słownik kanonicznych produktów i ich nazw wyświetlanych.
export const PRODUCTS: Record<string, string> = {
  K: 'Kostka',
  KD: 'Kostka duża',
  KM: 'Kostka mała',
  KC: 'Kostka C',
  KB: 'Kostka B',
  KO: 'Kostka odsort',
  OK: 'Odzysk Kostka',
  OS: 'Odzysk Sticksy',
  ST: 'Sticksy',
  SO: 'Semolina odsort',
  S: 'Semolina',
  SR: 'Semolina SR',
  SZ: 'Semolina Z',
  SPG: 'Semolina SPG',
  SB: 'Semolina B',
  P: 'Proszek',
  PZ: 'Proszek Z',
  PZG: 'Proszek ZG',
  PZD: 'Proszek ZD',
  G: 'Grys',
  GR: 'Granulat',
  SCORPION: 'Scorpion (wentylacja)',
  GRYSIK: 'Grysik',
  SK: 'Skórki',
  ZMIOTKI: 'Zmiotki',
  KBB: 'Kostka BB',
  SBB: 'Semolina BB',
  SRBB: 'Semolina SR BB',
  GBB: 'Grys BB',
  GRBB: 'Granulat BB',
  STBB: 'Sticksy BB',
  PBB: 'Proszek BB',
  GRYSIKBB: 'Grysik BB',
  KBIO: 'Kostka BIO',
  KDBIO: 'Kostka duża BIO',
  KCBIO: 'Kostka C BIO',
  KBBIO: 'Kostka B BIO',
  KOBIO: 'Kostka odsort BIO',
  OKBIO: 'Odzysk Kostka BIO',
  OSBIO: 'Odzysk Sticksy BIO',
  STBIO: 'Sticksy BIO',
  SBIO: 'Semolina BIO',
  SRBIO: 'Semolina SR BIO',
  SZBIO: 'Semolina Z BIO',
  SPGBIO: 'Semolina SPG BIO',
  SBBIO: 'Semolina B BIO',
  PBIO: 'Proszek BIO',
  PZBIO: 'Proszek Z BIO',
  GBIO: 'Grys BIO',
  GRBIO: 'Granulat BIO',
  GRYSIKBIO: 'Grysik BIO',
};

const ALIASES_RAW: Record<string, string> = {
  KOSTKA: 'K', K: 'K',
  KD: 'KD', 'KOSTKA DUZA': 'KD', 'KOSTKA DUŻA': 'KD',
  KM: 'KM', 'KOSTKA MALA': 'KM', 'KOSTKA MAŁA': 'KM',
  KC: 'KC', 'KOSTKA C': 'KC',
  KB: 'KB', 'KOSTKA B': 'KB',
  KO: 'KO', 'KOSTKA ODSORT': 'KO', ODSORT: 'KO',
  OK: 'OK', 'ODZYSK KOSTKA': 'OK', 'ODZYSK KOSTKI': 'OK',
  ST: 'ST', STICKSY: 'ST', STICKS: 'ST',
  OS: 'OS', 'ODZYSK STICKSY': 'OS', 'ODZYSK STICKS': 'OS', 'ODZYSK STICK': 'OS',
  S: 'S', SEMOLINA: 'S',
  SR: 'SR', 'SEMOLINA SR': 'SR',
  SZ: 'SZ', 'SŻ': 'SZ', 'SEMOLINA Z': 'SZ', 'SEMOLINA Ż': 'SZ',
  'SEMOLINA ŻÓŁTA': 'SZ', 'SEMOLINA ZOLTA': 'SZ',
  SPG: 'SPG', 'SEMOLINA SPG': 'SPG', 'SEMOLINA PO GRYSIE': 'SPG',
  SO: 'SO', 'SEMOLINA ODSORT': 'SO',
  SB: 'SB', 'SEMOLINA B': 'SB',
  P: 'P', PROSZEK: 'P',
  PZ: 'PZ', 'PŻ': 'PZ', 'PROSZEK Z': 'PZ', 'PROSZEK Ż': 'PZ',
  'PROSZEK ŻÓŁTY': 'PZ', 'PROSZEK ZOLTY': 'PZ',
  PZG: 'PZG', 'PROSZEK ZG': 'PZG',
  PZD: 'PZD', 'PROSZEK ZD': 'PZD',
  G: 'G', GRYS: 'G',
  GR: 'GR', GRANULAT: 'GR',
  SCORPION: 'SCORPION', WENTYLACJA: 'SCORPION',
  GRYSIK: 'GRYSIK',
  SK: 'SK', SKORKI: 'SK', 'SKÓRKI': 'SK',
  ZMIOTKI: 'ZMIOTKI', ZMIOKI: 'ZMIOTKI',
  KBB: 'KBB', 'KOSTKA BB': 'KBB', 'K BB': 'KBB', 'KOSTKA BEZ BLANSZU': 'KBB',
  SBB: 'SBB', 'SEMOLINA BB': 'SBB', 'S BB': 'SBB',
  SRBB: 'SRBB', 'SEMOLINA SR BB': 'SRBB', 'SEMOLINA SRBB': 'SRBB',
  GBB: 'GBB', 'GRYS BB': 'GBB', 'G BB': 'GBB',
  GRBB: 'GRBB', 'GRANULAT BB': 'GRBB', 'GR BB': 'GRBB',
  STBB: 'STBB', 'STICKSY BB': 'STBB', 'ST BB': 'STBB',
  PBB: 'PBB', 'PROSZEK BB': 'PBB', 'P BB': 'PBB',
  GRYSIKBB: 'GRYSIKBB', 'GRYSIK BB': 'GRYSIKBB',
  KBIO: 'KBIO', 'KOSTKA BIO': 'KBIO', 'K BIO': 'KBIO',
  KDBIO: 'KDBIO', 'KOSTKA DUŻA BIO': 'KDBIO',
  KCBIO: 'KCBIO', 'KOSTKA C BIO': 'KCBIO',
  KBBIO: 'KBBIO', 'KOSTKA B BIO': 'KBBIO',
  KOBIO: 'KOBIO', 'KOSTKA ODSORT BIO': 'KOBIO',
  OSBIO: 'OSBIO', 'ODZYSK STICKSY BIO': 'OSBIO',
  STBIO: 'STBIO', 'STICKSY BIO': 'STBIO',
  SBIO: 'SBIO', 'SEMOLINA BIO': 'SBIO', 'S BIO': 'SBIO',
  SRBIO: 'SRBIO', 'SEMOLINA SR BIO': 'SRBIO', 'SEMOLINA SRBIO': 'SRBIO',
  SZBIO: 'SZBIO', 'SŻBIO': 'SZBIO', 'SEMOLINA ŻÓŁTA BIO': 'SZBIO',
  SPGBIO: 'SPGBIO', 'SEMOLINA SPG BIO': 'SPGBIO',
  SBBIO: 'SBBIO', 'SEMOLINA B BIO': 'SBBIO',
  PBIO: 'PBIO', 'PROSZEK BIO': 'PBIO',
  PZBIO: 'PZBIO', 'PŻBIO': 'PZBIO', 'PROSZEK Z BIO': 'PZBIO', 'PROSZEK ŻÓŁTY BIO': 'PZBIO',
  GBIO: 'GBIO', 'GRYS BIO': 'GBIO',
  GRBIO: 'GRBIO', 'GRANULAT BIO': 'GRBIO',
  GRYSIKBIO: 'GRYSIKBIO', 'GRYSIK BIO': 'GRYSIKBIO',
};

function normalize(s: string): string {
  return s.trim().toUpperCase().split(/\s+/).join(' ');
}

const ALIASES: Record<string, string> = {};
for (const [k, v] of Object.entries(ALIASES_RAW)) ALIASES[normalize(k)] = v;

export interface ParsedProduct {
  code: string | null;
  codeBot: string | null;
  kwit: string | null;
  isUnknown: boolean;
}

export function parseProductCode(raw: string | null | undefined): ParsedProduct {
  if (!raw || !raw.toString().trim()) return { code: null, codeBot: null, kwit: null, isUnknown: false };
  const s = raw.toString().trim();

  if (s.includes('/')) {
    const [first, second] = s.split('/', 2).map((p) => p.trim());
    const firstParsed = parseProductCode(first);
    if (/^\d+$/.test(second)) {
      return { code: firstParsed.code, codeBot: null, kwit: second, isUnknown: firstParsed.isUnknown };
    }
    const secondParsed = parseProductCode(second);
    return {
      code: firstParsed.code,
      codeBot: secondParsed.code,
      kwit: null,
      isUnknown: firstParsed.isUnknown || secondParsed.isUnknown,
    };
  }

  if (/^\d+$/.test(s)) return { code: 'K', codeBot: null, kwit: s, isUnknown: false };

  const norm = normalize(s);
  if (ALIASES[norm]) return { code: ALIASES[norm], codeBot: null, kwit: null, isUnknown: false };
  return { code: 'UNKNOWN', codeBot: null, kwit: null, isUnknown: true };
}

export function productName(code: string | null): string {
  if (!code) return '';
  return PRODUCTS[code] ?? code;
}
