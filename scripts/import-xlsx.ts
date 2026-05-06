/**
 * Importer danych z inwentura.xlsx do bazy Supabase.
 * 
 * Uruchomienie:
 *   1. Skopiuj inwentura.xlsx do głównego katalogu projektu
 *   2. Uzupełnij .env.local (SUPABASE_SERVICE_ROLE_KEY!)
 *   3. npm run import:xlsx
 */
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { config } from 'dotenv';
import path from 'path';
import { parseProductCode } from '../src/lib/products.js';

config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local');
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const FILE = process.argv[2] ?? 'inwentura.xlsx';

// (col_letter, gora_col_excel, dol_col_excel) - układ siatki głównych magazynów
const GRID_LAYOUT: [string, string, string][] = [
  ['A', 'C', 'D'],
  ['B', 'F', 'G'],
  ['C', 'I', 'J'],
  ['D', 'L', 'M'],
  ['E', 'O', 'P'],
  ['F', 'R', 'S'],
  ['G', 'U', 'V'],
  ['H', 'X', 'Y'],
];

const BLASZAK_LAYOUT: [string, string, string][] = [
  ['A', 'C', 'D'], ['B', 'F', 'G'], ['C', 'I', 'J'], ['D', 'L', 'M'], ['E', 'O', 'P'],
  ['F', 'V', 'W'], ['G', 'Y', 'Z'], ['H', 'AB', 'AC'], ['I', 'AE', 'AF'], ['J', 'AH', 'AI'],
];

function colToIdx(letter: string): number {
  let n = 0;
  for (const c of letter) n = n * 26 + (c.toUpperCase().charCodeAt(0) - 64);
  return n;
}

function val(ws: ExcelJS.Worksheet, row: number, col: string): any {
  const v = ws.getCell(row, colToIdx(col)).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'result' in v) return (v as any).result;
  if (typeof v === 'object' && 'text' in v) return (v as any).text;
  return v;
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = parseFloat(String(v).replace(',', '.'));
  return isNaN(x) ? null : x;
}

async function importGrid(ws: ExcelJS.Worksheet, warehouse: string, nRows: number, layout = GRID_LAYOUT) {
  const rows: any[] = [];
  for (let r = 1; r <= nRows; r++) {
    const labelRow = 3 + (r - 1) * 3;
    const starchRow = labelRow + 1;
    const weightRow = labelRow + 2;
    for (const [colLetter, gCol, dCol] of layout) {
      for (const [slot, exCol] of [['gora', gCol] as const, ['dol', dCol] as const]) {
        const label = val(ws, labelRow, exCol);
        const starch = val(ws, starchRow, exCol);
        const weight = val(ws, weightRow, exCol);
        if (label === null && starch === null && weight === null) continue;
        const parsed = parseProductCode(label?.toString() ?? null);
        rows.push({
          warehouse, col: colLetter, row: r, slot,
          raw_label: label?.toString().trim() || null,
          product_code: parsed.code,
          kwit: parsed.kwit,
          starch: starch?.toString().trim() || null,
          weight: num(weight),
        });
      }
    }
  }
  if (rows.length === 0) return 0;
  // upsert w paczkach
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from('cells').upsert(chunk, { onConflict: 'warehouse,col,row,slot' });
    if (error) throw error;
  }
  return rows.length;
}

async function importBlaszakContainers(ws: ExcelJS.Worksheet, warehouse: string) {
  const rows: any[] = [];
  for (let r = 20; r <= ws.rowCount; r++) {
    const aVal = val(ws, r, 'A');
    const qVal = val(ws, r, 'Q');
    // Lewy kontener
    if (typeof aVal === 'number' && aVal >= 1 && aVal <= 6) {
      const cnum = Math.floor(aVal);
      let line = 1;
      for (let rr = r; rr <= Math.min(r + 5, ws.rowCount); rr++) {
        if (rr !== r && typeof val(ws, rr, 'A') === 'number') break;
        const code = val(ws, rr, 'D');
        const pallets = val(ws, rr, 'G');
        const weight = val(ws, rr, 'J');
        const desc = val(ws, rr, 'M');
        if (code !== null || weight !== null || desc !== null) {
          const parsed = parseProductCode(code?.toString() ?? null);
          rows.push({
            warehouse, container_no: cnum, line_no: line++,
            raw_label: code?.toString().trim() || null,
            product_code: parsed.code,
            pallets: pallets?.toString().trim() || null,
            weight: num(weight),
            description: desc?.toString().trim() || null,
          });
        }
      }
    }
    // Prawy kontener
    if (typeof qVal === 'number' && qVal >= 1 && qVal <= 6) {
      const cnum = Math.floor(qVal);
      let line = 1;
      for (let rr = r; rr <= Math.min(r + 5, ws.rowCount); rr++) {
        if (rr !== r && typeof val(ws, rr, 'Q') === 'number') break;
        const code = val(ws, rr, 'T');
        const pallets = val(ws, rr, 'W');
        const weight = val(ws, rr, 'Z');
        const desc = val(ws, rr, 'AC');
        if (code !== null || weight !== null || desc !== null) {
          const parsed = parseProductCode(code?.toString() ?? null);
          rows.push({
            warehouse, container_no: cnum, line_no: line++,
            raw_label: code?.toString().trim() || null,
            product_code: parsed.code,
            pallets: pallets?.toString().trim() || null,
            weight: num(weight),
            description: desc?.toString().trim() || null,
          });
        }
      }
    }
  }
  if (rows.length) {
    const { error } = await supabase.from('containers').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

async function importAmbro(ws: ExcelJS.Worksheet) {
  const rows: any[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const kod = val(ws, r, 'B');
    const waga = val(ws, r, 'C');
    const nrkw = val(ws, r, 'D');
    const wyd = val(ws, r, 'E');
    const prz = val(ws, r, 'F');
    const uwagi = val(ws, r, 'G');
    const extra = val(ws, r, 'H');
    if (kod === null && waga === null) continue;
    const parsed = parseProductCode(kod?.toString() ?? null);
    const toIso = (v: any) => v instanceof Date ? v.toISOString().slice(0, 10) : null;
    rows.push({
      raw_label: kod?.toString().trim() || null,
      product_code: parsed.code,
      weight: num(waga),
      kwit: nrkw?.toString().trim() || null,
      issue_date: toIso(wyd),
      receive_date: toIso(prz),
      notes: uwagi?.toString().trim() || null,
      extra: extra?.toString().trim() || null,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from('ambro').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

async function clearTables() {
  for (const t of ['cells', 'containers', 'ambro']) {
    const { error } = await supabase.from(t).delete().neq('id', 0);
    if (error) throw error;
  }
}

async function main() {
  console.log(`Wczytuję ${FILE}...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(FILE));

  console.log('Czyszczę istniejące dane...');
  await clearTables();

  const map: [string, string, number, [string, string, string][]?][] = [
    ['MAGAZYN LEWA STRONA', 'lewa', 10],
    ['MAGAZYN PRAWA STRONA', 'prawa', 10],
    ['WIATA', 'wiata', 10],
    ['BLASZAK 1', 'blaszak1', 5, BLASZAK_LAYOUT],
    ['BLASZAK 2', 'blaszak2', 5, BLASZAK_LAYOUT],
  ];
  for (const [sheet, key, nRows, layout] of map) {
    const ws = wb.getWorksheet(sheet);
    if (!ws) { console.log(`  Pominięto: ${sheet} (brak arkusza)`); continue; }
    const n = await importGrid(ws, key, nRows, layout);
    console.log(`  ${key}: ${n} komórek`);
    if (key.startsWith('blaszak')) {
      const c = await importBlaszakContainers(ws, key);
      console.log(`  ${key} kontenery: ${c} pozycji`);
    }
  }
  const ambroWs = wb.getWorksheet('Ambro');
  if (ambroWs) {
    const n = await importAmbro(ambroWs);
    console.log(`  ambro: ${n} wpisów`);
  }
  console.log('\nGotowe! Sprawdź stany na stronie głównej aplikacji.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
