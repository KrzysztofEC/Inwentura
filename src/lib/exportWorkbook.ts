import ExcelJS from 'exceljs';
import { WAREHOUSES, WAREHOUSE_KEYS, colsWithRoad, ROAD_COL_1, ROAD_COL_2 } from '@/lib/warehouses';
import type { WarehouseConfig } from '@/lib/warehouses';

// ===== Typy danych z Supabase =====
export interface ExportCell {
  warehouse: string; col: string; row: number;
  raw_label: string | null; starch: string | null;
  weight_top: number | string | null; weight_bot: number | string | null;
  product_code: string | null; product_code_bot: string | null;
}
export interface ExportTotal { warehouse: string; product_code: string; total: number | string | null; }

// Jeden wiersz arkusza "Dane": jedna waga (góra albo dół) w jednej lokalizacji
interface DaneEntry {
  sheet: string; loc: string; level: string; label: string; code: string;
  ref: string; value: number | null;
}

const FONT = 'Arial';
const DARK = 'FF1E293B';
const NUM_FMT = '#,##0;-#,##0;""';
const UNKNOWN_CODE = '?';

const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function sheetNameOf(cfg: WarehouseConfig): string {
  return cfg.name.replace('Magazyn ', '').replace(' (zewnętrzny)', '').slice(0, 31);
}
function q(sheet: string) { return `'${sheet.replace(/'/g, "''")}'`; }

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
function codeOf(code: string | null | undefined, hasWeight: boolean): string {
  if (code && code !== 'UNKNOWN') return code;
  return hasWeight ? UNKNOWN_CODE : '';
}
function isRoad(col: string) { return col === ROAD_COL_1 || col === ROAD_COL_2; }
function locName(col: string, row: number) {
  if (col === ROAD_COL_1) return `DROGA1-${row}`;
  if (col === ROAD_COL_2) return `DROGA2-${row}`;
  return `${col}${row}`;
}

// ===== Arkusz magazynu w rzucie (grid / blaszak) =====
function buildGridSheet(
  wb: ExcelJS.Workbook, cfg: WarehouseConfig, cellMap: Map<string, ExportCell>,
  dane: DaneEntry[], dateStr: string,
) {
  const sheet = sheetNameOf(cfg);
  const ws = wb.addWorksheet(sheet, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      horizontalCentered: true,
    },
  });
  const cols = colsWithRoad(cfg);
  const rowNums: number[] = [];
  for (let i = 1; i <= (cfg.rows ?? 0); i++) rowNums.push(i);
  if (cfg.rowsReversed) rowNums.reverse();
  const hasMiddle = !!cfg.middleRow;
  const middleLabel = cfg.middleRow === 'info' ? 'INFO' : 'SKROBIA';
  const firstW = 3;
  const lastWeightCol = firstW + cols.length * 2 - 1;
  const lastCol = lastWeightCol + 1;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 9;
  cols.forEach((c, i) => {
    const w = isRoad(c) ? 7 : 9;
    ws.getColumn(firstW + i * 2).width = w;
    ws.getColumn(firstW + i * 2 + 1).width = w;
  });
  ws.getColumn(lastCol).width = 5;

  // Wiersz 1: tytuł
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = `${cfg.name} — stan na ${dateStr}`;
  t.font = { name: FONT, bold: true, size: 13 };
  ws.getRow(1).height = 20;

  // Wiersz 2: litery kolumn, wiersz 3: góra/dół
  const hdr = (c: ExcelJS.Cell, road: boolean, small = false) => {
    c.font = { name: FONT, bold: !small, size: small ? 8 : 10, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(road ? 'FF6B7280' : small ? 'FF374151' : DARK);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thin;
  };
  for (const r of [2, 3]) for (const c of [1, 2, lastCol]) hdr(ws.getCell(r, c), false, r === 3);
  cols.forEach((c, i) => {
    const cc = firstW + i * 2;
    ws.mergeCells(2, cc, 2, cc + 1);
    ws.getCell(2, cc).value = isRoad(c) ? 'DROGA' : c;
    hdr(ws.getCell(2, cc), isRoad(c));
    ws.getCell(3, cc).value = 'góra';
    ws.getCell(3, cc + 1).value = 'dół';
    hdr(ws.getCell(3, cc), isRoad(c), true);
    hdr(ws.getCell(3, cc + 1), isRoad(c), true);
  });

  let r = 4;
  const firstDataRow = r;
  const colSums = new Array(cols.length * 2).fill(0);

  for (const rn of rowNums) {
    const nSub = hasMiddle ? 3 : 2;
    const kwitR = r, midR = r + 1, wagaR = r + nSub - 1;

    for (const side of [1, lastCol]) {
      ws.mergeCells(r, side, r + nSub - 1, side);
      const c = ws.getCell(r, side);
      c.value = rn;
      c.font = { name: FONT, bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      c.fill = fill(DARK);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    const lbl = (row: number, text: string) => {
      const c = ws.getCell(row, 2);
      c.value = text;
      c.font = { name: FONT, bold: true, size: 8, color: { argb: 'FF374151' } };
      c.fill = fill('FFF3F4F6');
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thin;
    };
    lbl(kwitR, 'KWIT');
    if (hasMiddle) lbl(midR, middleLabel);
    lbl(wagaR, 'WAGA');

    cols.forEach((col, i) => {
      const cc = firstW + i * 2;
      const st = cellMap.get(`${cfg.key}|${col}|${rn}`);
      const road = isRoad(col);
      const wt = toNum(st?.weight_top);
      const wb_ = toNum(st?.weight_bot);
      const codeTop = codeOf(st?.product_code, wt !== null);
      const codeBot = codeOf(st?.product_code_bot ?? st?.product_code, wb_ !== null);
      const unknown = st?.product_code === 'UNKNOWN';
      const occupied = !!(st?.raw_label || wt !== null || wb_ !== null);
      const bg = unknown ? 'FFFEE2E2' : occupied ? (road ? 'FFFEF9C3' : 'FFF0FDF4') : road ? 'FFE5E7EB' : undefined;

      // KWIT (scalony na górę+dół)
      ws.mergeCells(kwitR, cc, kwitR, cc + 1);
      const kc = ws.getCell(kwitR, cc);
      kc.value = st?.raw_label || null;
      kc.font = { name: FONT, bold: true, size: 10, color: { argb: unknown ? 'FFB91C1C' : 'FF111827' } };
      kc.alignment = { horizontal: 'center', vertical: 'middle' };

      if (hasMiddle) {
        ws.mergeCells(midR, cc, midR, cc + 1);
        const mc = ws.getCell(midR, cc);
        mc.value = st?.starch || null;
        mc.font = { name: FONT, size: 9, color: { argb: 'FF4B5563' } };
        mc.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const wcTop = ws.getCell(wagaR, cc);
      const wcBot = ws.getCell(wagaR, cc + 1);
      wcTop.value = wt; wcBot.value = wb_;
      for (const wc of [wcTop, wcBot]) {
        wc.numFmt = NUM_FMT;
        wc.font = { name: FONT, bold: true, size: 10, color: { argb: 'FF166534' } };
        wc.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      colSums[i * 2] += wt ?? 0;
      colSums[i * 2 + 1] += wb_ ?? 0;

      for (let rr = kwitR; rr <= wagaR; rr++) for (const c2 of [cc, cc + 1]) {
        const cell = ws.getCell(rr, c2);
        cell.border = thin;
        if (bg) cell.fill = fill(bg);
      }

      const loc = locName(col, rn);
      const label = st?.raw_label ?? '';
      dane.push({ sheet, loc, level: 'góra', label, code: codeTop, ref: `${q(sheet)}!${wcTop.address}`, value: wt });
      dane.push({ sheet, loc, level: 'dół', label, code: codeBot, ref: `${q(sheet)}!${wcBot.address}`, value: wb_ });
    });
    r += nSub;
  }
  const lastDataRow = r - 1;

  // Wiersz SUMA kolumn (liczy tylko wiersze WAGA)
  const sumRow = r;
  const sl = ws.getCell(sumRow, 2);
  sl.value = 'SUMA';
  sl.font = { name: FONT, bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
  sl.fill = fill(DARK);
  sl.alignment = { horizontal: 'center' };
  for (let c = firstW; c <= lastWeightCol; c++) {
    const L = ws.getColumn(c).letter;
    const cell = ws.getCell(sumRow, c);
    cell.value = {
      formula: `SUMIF($B$${firstDataRow}:$B$${lastDataRow},"WAGA",${L}${firstDataRow}:${L}${lastDataRow})`,
      result: colSums[c - firstW],
    };
    cell.numFmt = NUM_FMT;
    cell.font = { name: FONT, bold: true, size: 9 };
    cell.fill = fill('FFFEF3C7');
    cell.border = thin;
  }

  // Razem magazyn
  const totRow = sumRow + 1;
  ws.mergeCells(totRow, 1, totRow, 4);
  const tl = ws.getCell(totRow, 1);
  tl.value = 'RAZEM MAGAZYN (kg):';
  tl.font = { name: FONT, bold: true, size: 11 };
  tl.alignment = { horizontal: 'right' };
  ws.mergeCells(totRow, 5, totRow, 7);
  const tv = ws.getCell(totRow, 5);
  const sL = ws.getColumn(firstW).letter, eL = ws.getColumn(lastWeightCol).letter;
  tv.value = { formula: `SUM(${sL}${sumRow}:${eL}${sumRow})`, result: colSums.reduce((a, b) => a + b, 0) };
  tv.numFmt = NUM_FMT;
  tv.font = { name: FONT, bold: true, size: 11 };
  tv.fill = fill('FFFDE68A');
  tv.alignment = { horizontal: 'center' };

  ws.pageSetup.printArea = `A1:${ws.getColumn(lastCol).letter}${totRow}`;
}

// ===== Arkusz listy (Kontenery / Ambro) – sumy po produktach =====
function buildListSheet(
  wb: ExcelJS.Workbook, cfg: WarehouseConfig, totals: ExportTotal[],
  names: Record<string, string>, dane: DaneEntry[], dateStr: string,
) {
  const sheet = sheetNameOf(cfg);
  const ws = wb.addWorksheet(sheet, { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.getColumn(1).width = 10; ws.getColumn(2).width = 32; ws.getColumn(3).width = 14;
  ws.mergeCells(1, 1, 1, 3);
  ws.getCell(1, 1).value = `${cfg.name} — stan na ${dateStr} (sumy po produktach)`;
  ws.getCell(1, 1).font = { name: FONT, bold: true, size: 13 };
  ['Kod', 'Nazwa', 'Waga (kg)'].forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(DARK); c.border = thin;
  });
  const byCode = new Map<string, number>();
  for (const t of totals) {
    if (t.warehouse !== cfg.key) continue;
    const n = toNum(t.total) ?? 0;
    if (!n) continue;
    const code = codeOf(t.product_code, true);
    byCode.set(code, (byCode.get(code) ?? 0) + n);
  }
  let r = 4;
  const first = r;
  let sum = 0;
  for (const [code, kg] of Array.from(byCode.entries()).sort((a, b) => b[1] - a[1])) {
    ws.getCell(r, 1).value = code;
    ws.getCell(r, 2).value = names[code] ?? code;
    const wc = ws.getCell(r, 3);
    wc.value = kg; wc.numFmt = NUM_FMT;
    for (let c = 1; c <= 3; c++) { ws.getCell(r, c).border = thin; ws.getCell(r, c).font = { name: FONT, bold: c === 3 }; }
    dane.push({ sheet, loc: '-', level: '-', label: '', code, ref: `${q(sheet)}!${wc.address}`, value: kg });
    sum += kg; r++;
  }
  ws.getCell(r, 2).value = 'RAZEM';
  ws.getCell(r, 2).font = { name: FONT, bold: true };
  const tc = ws.getCell(r, 3);
  tc.value = r > first ? { formula: `SUM(C${first}:C${r - 1})`, result: sum } : 0;
  tc.numFmt = NUM_FMT; tc.font = { name: FONT, bold: true }; tc.fill = fill('FFFDE68A');
}

// ===== Główna funkcja =====
export async function buildInventoryWorkbook(
  cells: ExportCell[], totals: ExportTotal[], names: Record<string, string>, dateStr: string,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Magazyn APP';
  wb.calcProperties.fullCalcOnLoad = true;

  const cellMap = new Map<string, ExportCell>();
  for (const c of cells) cellMap.set(`${c.warehouse}|${c.col}|${c.row}`, c);

  const summary = wb.addWorksheet('Podsumowanie', { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }] });
  const dane: DaneEntry[] = [];
  const whSheets: { key: string; sheet: string }[] = [];

  for (const key of WAREHOUSE_KEYS) {
    const cfg = WAREHOUSES[key];
    if ((cfg.type === 'grid' || cfg.type === 'blaszak') && cfg.cols && cfg.rows) {
      buildGridSheet(wb, cfg, cellMap, dane, dateStr);
    } else {
      buildListSheet(wb, cfg, totals, names, dane, dateStr);
    }
    whSheets.push({ key, sheet: sheetNameOf(cfg) });
  }

  // ===== Arkusz "Dane" – każda waga jako odwołanie do komórki na mapie =====
  const ds = wb.addWorksheet('Dane', { views: [{ state: 'frozen', ySplit: 1 }] });
  const dh = ['Magazyn', 'Lokalizacja', 'Poziom', 'Etykieta (KWIT)', 'Kod produktu', 'Waga (kg)'];
  [18, 12, 8, 18, 12, 12].forEach((w, i) => (ds.getColumn(i + 1).width = w));
  dh.forEach((h, i) => {
    const c = ds.getCell(1, i + 1);
    c.value = h; c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(DARK);
  });
  dane.forEach((d, i) => {
    const r = i + 2;
    ds.getCell(r, 1).value = d.sheet;
    ds.getCell(r, 2).value = d.loc;
    ds.getCell(r, 3).value = d.level;
    ds.getCell(r, 4).value = d.label || null;
    ds.getCell(r, 5).value = d.code || null;
    // Odwołanie do mapy; pusta komórka na mapie daje 0
    ds.getCell(r, 6).value = { formula: `N(${d.ref})`, result: d.value ?? 0 };
    ds.getCell(r, 6).numFmt = NUM_FMT;
    for (let c = 1; c <= 6; c++) ds.getCell(r, c).font = { name: FONT, size: 10 };
  });
  const lastDane = Math.max(dane.length + 1, 2);
  ds.autoFilter = { from: 'A1', to: `F${lastDane}` };

  // ===== Arkusz "Podsumowanie" =====
  const agg = new Map<string, Map<string, number>>();
  for (const d of dane) {
    if (!d.code || !d.value) continue;
    if (!agg.has(d.code)) agg.set(d.code, new Map());
    const m = agg.get(d.code)!;
    m.set(d.sheet, (m.get(d.sheet) ?? 0) + d.value);
  }
  const totalOf = (code: string) => Array.from(agg.get(code)!.values()).reduce((a, b) => a + b, 0);
  const codes = Array.from(agg.keys())
    .filter(c => totalOf(c) !== 0)
    .sort((a, b) => (a === UNKNOWN_CODE ? 1 : b === UNKNOWN_CODE ? -1 : totalOf(b) - totalOf(a)));

  const nWh = whSheets.length;
  const sumCol = 3 + nWh;          // SUMA
  const spisCol = sumCol + 1;      // Spis z natury
  const diffCol = sumCol + 2;      // Różnica

  summary.getColumn(1).width = 9;
  summary.getColumn(2).width = 30;
  for (let i = 0; i < nWh; i++) summary.getColumn(3 + i).width = 13;
  summary.getColumn(sumCol).width = 14;
  summary.getColumn(spisCol).width = 15;
  summary.getColumn(diffCol).width = 13;

  summary.mergeCells(1, 1, 1, diffCol);
  summary.getCell(1, 1).value = `Podsumowanie produktów — stan na ${dateStr}`;
  summary.getCell(1, 1).font = { name: FONT, bold: true, size: 14 };
  summary.mergeCells(2, 1, 2, diffCol);
  summary.getCell(2, 1).value = 'Sumy liczą się z arkusza „Dane” (odwołania do map). Zmiana wagi na mapie przelicza podsumowanie. Kolumnę „Spis z natury” wypełnij przy inwenturze.';
  summary.getCell(2, 1).font = { name: FONT, italic: true, size: 9, color: { argb: 'FF6B7280' } };

  const headers = ['Kod', 'Nazwa', ...whSheets.map(w => w.sheet), 'SUMA', 'Spis z natury', 'Różnica'];
  headers.forEach((h, i) => {
    const c = summary.getCell(3, i + 1);
    c.value = h;
    const col = i + 1;
    const special = col === sumCol ? 'FFFDE68A' : col === spisCol ? 'FFFFFF00' : null;
    c.font = { name: FONT, bold: true, color: { argb: special ? 'FF111827' : 'FFFFFFFF' } };
    c.fill = fill(special ?? DARK);
    c.alignment = { horizontal: col <= 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    c.border = thin;
  });
  summary.getRow(3).height = 30;

  const firstRow = 4;
  codes.forEach((code, idx) => {
    const r = firstRow + idx;
    summary.getCell(r, 1).value = code;
    summary.getCell(r, 2).value = code === UNKNOWN_CODE ? 'Nierozpoznane etykiety (sprawdź mapy)' : (names[code] ?? code);
    whSheets.forEach((w, i) => {
      const c = summary.getCell(r, 3 + i);
      c.value = {
        formula: `SUMIFS(Dane!$F:$F,Dane!$A:$A,"${w.sheet}",Dane!$E:$E,$A${r})`,
        result: agg.get(code)!.get(w.sheet) ?? 0,
      };
    });
    const sL = summary.getColumn(3).letter, eL = summary.getColumn(sumCol - 1).letter;
    summary.getCell(r, sumCol).value = { formula: `SUM(${sL}${r}:${eL}${r})`, result: totalOf(code) };
    const sumL = summary.getColumn(sumCol).letter, spisL = summary.getColumn(spisCol).letter;
    summary.getCell(r, diffCol).value = { formula: `IF(${spisL}${r}="","",${spisL}${r}-${sumL}${r})`, result: '' };

    for (let c = 1; c <= diffCol; c++) {
      const cell = summary.getCell(r, c);
      cell.border = thin;
      cell.font = { name: FONT, bold: c === 1 || c === sumCol, color: code === UNKNOWN_CODE && c <= 2 ? { argb: 'FFB91C1C' } : undefined };
      if (c >= 3) cell.numFmt = NUM_FMT;
      if (c === sumCol) cell.fill = fill('FFFEF3C7');
      if (c === spisCol) cell.fill = fill('FFFFFFCC');
    }
  });

  // Wiersz RAZEM
  const lastRow = firstRow + codes.length - 1;
  const totR = firstRow + codes.length;
  summary.getCell(totR, 2).value = 'RAZEM';
  for (let c = 3; c <= diffCol; c++) {
    const L = summary.getColumn(c).letter;
    const cell = summary.getCell(totR, c);
    if (codes.length > 0) {
      let result: number | string = 0;
      if (c < sumCol) result = codes.reduce((a, code) => a + (agg.get(code)!.get(whSheets[c - 3].sheet) ?? 0), 0);
      else if (c === sumCol) result = codes.reduce((a, code) => a + totalOf(code), 0);
      cell.value = { formula: `SUM(${L}${firstRow}:${L}${lastRow})`, result };
    }
    cell.numFmt = NUM_FMT;
  }
  for (let c = 1; c <= diffCol; c++) {
    const cell = summary.getCell(totR, c);
    cell.font = { name: FONT, bold: true };
    cell.fill = fill('FFFDE68A');
    cell.border = thin;
  }

  summary.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  return wb;
}
