'use client';

import { useRef, useState, useTransition } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode, productName } from '@/lib/products';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';
import { ROAD_COL_KEY, colsWithRoad } from '@/lib/warehouses';

type Field = 'kwit' | 'starch' | 'weight_top' | 'weight_bot';

interface CellState {
  raw_label: string;
  starch: string;
  weight_top: string;
  weight_bot: string;
  note: string;
  product_code: string | null;
  product_code_bot: string | null;
  isUnknown: boolean;
  saving: boolean;
  dirty: boolean;
}

function emptyState(): CellState {
  return {
    raw_label: '', starch: '',
    weight_top: '', weight_bot: '',
    note: '',
    product_code: null, product_code_bot: null,
    isUnknown: false, saving: false, dirty: false,
  };
}

function fromCell(c: Cell | undefined): CellState {
  if (!c) return emptyState();
  const parsed = parseProductCode(c.raw_label ?? '');
  return {
    raw_label: c.raw_label ?? '',
    starch: c.starch ?? '',
    weight_top: c.weight_top !== null && c.weight_top !== undefined ? String(c.weight_top) : '',
    weight_bot: c.weight_bot !== null && c.weight_bot !== undefined ? String(c.weight_bot) : '',
    note: c.note ?? '',
    product_code: c.product_code ?? parsed.code,
    product_code_bot: c.product_code_bot ?? parsed.codeBot,
    isUnknown: c.product_code === 'UNKNOWN' || parsed.isUnknown,
    saving: false, dirty: false,
  };
}

export function WarehouseGrid({ cfg, cells }: { cfg: WarehouseConfig; cells: Cell[] }) {
  const [states, setStates] = useState<Map<string, CellState>>(() => {
    const m = new Map<string, CellState>();
    for (const c of cells) m.set(`${c.col}|${c.row}`, fromCell(c));
    return m;
  });
  // KLUCZOWE: trzymamy aktualny stan w ref, żeby persist czytał świeże dane
  // (setState jest asynchroniczne, więc bez ref persist widziałby starszą wersję)
  const statesRef = useRef(states);
  statesRef.current = states;

  const [, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  function persist(col: string, row: number) {
    const key = `${col}|${row}`;
    // CZYTAMY Z REF - to gwarantuje że mamy najświeższe dane
    const st = statesRef.current.get(key);
    if (!st || !st.dirty) return;

    setStates((prev) => {
      const m = new Map(prev);
      m.set(key, { ...m.get(key)!, saving: true });
      return m;
    });

    startTransition(async () => {
      if (!st.raw_label && !st.starch && !st.weight_top && !st.weight_bot && !st.note) {
        await clearCell({ warehouse: cfg.key, col, row });
      } else {
        await saveCell({
          warehouse: cfg.key, col, row,
          raw_label: st.raw_label,
          starch: st.starch,
          weight_top: st.weight_top,
          weight_bot: st.weight_bot,
          note: st.note,
        });
      }
      setStates((prev) => {
        const m = new Map(prev);
        const cur = m.get(key);
        if (!cur) return prev;
        const parsed = parseProductCode(cur.raw_label);
        m.set(key, {
          ...cur, saving: false, dirty: false,
          product_code: parsed.code,
          product_code_bot: parsed.codeBot,
          isUnknown: parsed.isUnknown,
        });
        return m;
      });
    });
  }

  function update(col: string, row: number, patch: Partial<CellState>) {
    // KRYTYCZNE: Modyfikujemy statesRef NAJPIERW (synchronicznie),
    // a React state ustawiamy potem (asynchronicznie, tylko dla UI).
    // Dzięki temu szybkie sekwencje update() nigdy nie tracą danych.
    const key = `${col}|${row}`;
    const cur = statesRef.current.get(key) ?? emptyState();
    const next = { ...cur, ...patch, dirty: true };
    if ('raw_label' in patch) {
      const parsed = parseProductCode(next.raw_label);
      next.product_code = parsed.code;
      next.product_code_bot = parsed.codeBot;
      next.isUnknown = parsed.isUnknown;
    }
    // Aktualizuj ref od razu - to jest źródło prawdy
    const newMap = new Map(statesRef.current);
    newMap.set(key, next);
    statesRef.current = newMap;
    // React state dla re-renderu (asynchroniczny)
    setStates(newMap);
    // Planuj zapis (debounced 400ms)
    scheduleSave(col, row, false);
  }

  function focusInput(col: string, row: number, field: Field) {
    const tbl = tableRef.current;
    if (!tbl) return;
    const sel = `[data-cell-input="${cfg.key}|${col}|${row}|${field}"]`;
    const el = tbl.querySelector<HTMLInputElement>(sel);
    if (el) {
      el.focus();
      el.select?.();
    }
  }

  const FIELDS: Field[] = (() => {
    const f: Field[] = ['kwit'];
    if (cfg.middleRow) f.push('starch');
    f.push('weight_top', 'weight_bot');
    return f;
  })();

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    col: string, row: number, field: Field
  ) {
    const cols = colsWithRoad(cfg);
    const rows = cfg.rows!;
    const colIdx = cols.indexOf(col);
    const fieldIdx = FIELDS.indexOf(field);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      persist(col, row);
      if (field === 'kwit') {
        if (cfg.middleRow) focusInput(col, row, 'starch');
        else focusInput(col, row, 'weight_top');
      } else if (field === 'starch') {
        focusInput(col, row, 'weight_top');
      } else if (field === 'weight_top' || field === 'weight_bot') {
        if (row < rows) focusInput(col, row + 1, 'kwit');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      persist(col, row);
      if (field === 'weight_top' || field === 'weight_bot') {
        if (cfg.middleRow) focusInput(col, row, 'starch');
        else focusInput(col, row, 'kwit');
      } else if (field === 'starch') {
        focusInput(col, row, 'kwit');
      } else if (field === 'kwit') {
        if (row > 1) focusInput(col, row - 1, 'weight_top');
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      persist(col, row);
      if (field === 'weight_top') {
        focusInput(col, row, 'weight_bot');
      } else if (field === 'weight_bot') {
        if (colIdx < cols.length - 1) focusInput(cols[colIdx + 1], row, 'weight_top');
      } else if (field === 'kwit' || field === 'starch') {
        if (colIdx < cols.length - 1) focusInput(cols[colIdx + 1], row, field);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      persist(col, row);
      if (field === 'weight_bot') {
        focusInput(col, row, 'weight_top');
      } else if (field === 'weight_top') {
        if (colIdx > 0) focusInput(cols[colIdx - 1], row, 'weight_bot');
      } else if (field === 'kwit' || field === 'starch') {
        if (colIdx > 0) focusInput(cols[colIdx - 1], row, field);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      persist(col, row);
      if (field === 'kwit') {
        if (cfg.middleRow) focusInput(col, row, 'starch');
        else focusInput(col, row, 'weight_top');
      } else if (field === 'starch') {
        focusInput(col, row, 'weight_top');
      } else if (field === 'weight_top' || field === 'weight_bot') {
        if (row < rows) focusInput(col, row + 1, 'kwit');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      persist(col, row);
      if (e.shiftKey) {
        if (fieldIdx > 0) {
          focusInput(col, row, FIELDS[fieldIdx - 1]);
        } else if (colIdx > 0) {
          focusInput(cols[colIdx - 1], row, FIELDS[FIELDS.length - 1]);
        } else if (row > 1) {
          focusInput(cols[cols.length - 1], row - 1, FIELDS[FIELDS.length - 1]);
        }
      } else {
        if (fieldIdx < FIELDS.length - 1) {
          focusInput(col, row, FIELDS[fieldIdx + 1]);
        } else if (colIdx < cols.length - 1) {
          focusInput(cols[colIdx + 1], row, FIELDS[0]);
        } else if (row < rows) {
          focusInput(cols[0], row + 1, FIELDS[0]);
        }
      }
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  }

  const rowNumbers = (() => {
    const list: (number | 'M')[] = [];
    for (let i = 1; i <= cfg.rows!; i++) list.push(i);
    if (cfg.rowsReversed) list.reverse();
    if (cfg.hasMagazynek) list.push('M');
    return list;
  })();

  const allCols = colsWithRoad(cfg);
  const middleLabel = cfg.middleRow === 'info' ? 'INFO' : 'SKROBIA';
  const hasMiddle = !!cfg.middleRow;

  function cellBgClass(st: CellState, isRoad: boolean): string {
    if (st.isUnknown) return 'bg-red-100';
    if (st.product_code || st.weight_top || st.weight_bot) {
      return isRoad ? 'bg-yellow-100' : 'bg-green-50';
    }
    return isRoad ? 'bg-gray-200' : '';
  }

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <table ref={tableRef} className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 70 }} />
          {allCols.flatMap((col, idx) => [
            <col key={`g-${idx}`} style={{ width: col === ROAD_COL_KEY ? 60 : 70 }} />,
            <col key={`d-${idx}`} style={{ width: col === ROAD_COL_KEY ? 60 : 70 }} />,
          ])}
          <col style={{ width: 36 }} />
        </colgroup>

        <thead className="sticky top-0 z-10">
          <tr>
            <th className="bg-gray-900 text-white"></th>
            <th className="bg-gray-900 text-white text-xs">DATA</th>
            {allCols.map((col) => (
              <th key={col} colSpan={2} className={`text-sm font-bold py-1 border ${
                col === ROAD_COL_KEY
                  ? 'bg-gray-500 text-white border-gray-700'
                  : 'bg-gray-900 text-white border-gray-700'
              }`}>
                {col}
              </th>
            ))}
            <th className="bg-gray-900 text-white"></th>
          </tr>
          <tr>
            <th className="bg-gray-900 text-white text-[10px]"></th>
            <th className="bg-gray-700 text-gray-200 text-[10px] font-normal"></th>
            {allCols.flatMap((col) => [
              <th key={`${col}-g`} className={`font-normal text-[10px] border ${
                col === ROAD_COL_KEY ? 'bg-gray-400 text-gray-100 border-gray-600' : 'bg-gray-700 text-gray-200 border-gray-600'
              }`}>góra</th>,
              <th key={`${col}-d`} className={`font-normal text-[10px] border ${
                col === ROAD_COL_KEY ? 'bg-gray-400 text-gray-100 border-gray-600' : 'bg-gray-700 text-gray-200 border-gray-600'
              }`}>dół</th>,
            ])}
            <th className="bg-gray-700 text-gray-200 text-[10px] font-normal"></th>
          </tr>
        </thead>

        <tbody>
          {rowNumbers.map((rNum) => {
            if (rNum === 'M') {
              return (
                <tr key="magazynek">
                  <th className="bg-gray-900 text-white w-9 text-center align-middle text-xs">M</th>
                  <th className="bg-amber-100 border text-xs font-semibold">Magazynek</th>
                  <td colSpan={allCols.length * 2} className="border bg-amber-50 text-xs italic text-gray-500 px-2">
                    (rząd specjalny - dane wpisuj jak zwykłe komórki magazynu w razie potrzeby)
                  </td>
                  <th className="bg-gray-900 text-white w-9 text-center align-middle text-xs">M</th>
                </tr>
              );
            }

            const r = rNum as number;
            const nSubRows = hasMiddle ? 3 : 2;

            return (
              <>
                <tr key={`${r}-kwit`} className="border-t-2 border-t-gray-700">
                  <th rowSpan={nSubRows} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-r-2 border-gray-700">
                    {r}
                  </th>
                  <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">
                    KWIT
                  </th>
                  {allCols.map((col) => {
                    const isRoad = col === ROAD_COL_KEY;
                    const key = `${col}|${r}`;
                    const st = states.get(key) ?? emptyState();
                    const bg = cellBgClass(st, isRoad);
                    return (
                      <td key={`${key}-kwit`} colSpan={2} className={`border ${isRoad ? 'border-gray-500' : 'border-gray-300'} p-0 align-middle ${bg}`}>
                        <input
                          data-cell-input={`${cfg.key}|${col}|${r}|kwit`}
                          value={st.raw_label}
                          onChange={(e) => update(col, r, { raw_label: e.target.value })}
                          onBlur={() => persist(col, r)}
                          onKeyDown={(e) => handleKey(e, col, r, 'kwit')}
                          title={st.product_code ? `${st.product_code}${st.product_code_bot ? ' / ' + st.product_code_bot : ''} (${productName(st.product_code)})` : ''}
                          className={`w-full px-1 py-1 text-[12px] text-center font-semibold border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                            st.isUnknown ? 'text-red-700' : ''
                          }`}
                        />
                      </td>
                    );
                  })}
                  <th rowSpan={nSubRows} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-l-2 border-gray-700">
                    {r}
                  </th>
                </tr>

                {hasMiddle && (
                  <tr key={`${r}-starch`}>
                    <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">
                      {middleLabel}
                    </th>
                    {allCols.map((col) => {
                      const isRoad = col === ROAD_COL_KEY;
                      const key = `${col}|${r}`;
                      const st = states.get(key) ?? emptyState();
                      const bg = cellBgClass(st, isRoad);
                      return (
                        <td key={`${key}-starch`} colSpan={2} className={`border ${isRoad ? 'border-gray-500' : 'border-gray-300'} p-0 align-middle ${bg}`}>
                          <input
                            data-cell-input={`${cfg.key}|${col}|${r}|starch`}
                            value={st.starch}
                            onChange={(e) => update(col, r, { starch: e.target.value })}
                            onBlur={() => persist(col, r)}
                            onKeyDown={(e) => handleKey(e, col, r, 'starch')}
                            className="w-full px-1 py-1 text-[11px] text-center text-gray-700 border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                          />
                        </td>
                      );
                    })}
                  </tr>
                )}

                <tr key={`${r}-weight`}>
                  <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">
                    WAGA
                  </th>
                  {allCols.flatMap((col) => {
                    const isRoad = col === ROAD_COL_KEY;
                    const key = `${col}|${r}`;
                    const st = states.get(key) ?? emptyState();
                    const bg = cellBgClass(st, isRoad);
                    return [
                      <td key={`${key}-wt`} className={`border ${isRoad ? 'border-gray-500' : 'border-gray-300'} p-0 align-middle ${bg}`}>
                        <input
                          data-cell-input={`${cfg.key}|${col}|${r}|weight_top`}
                          value={st.weight_top}
                          type="text"
                          inputMode="decimal"
                          onChange={(e) => update(col, r, { weight_top: e.target.value })}
                          onBlur={() => persist(col, r)}
                          onKeyDown={(e) => handleKey(e, col, r, 'weight_top')}
                          className="w-full px-1 py-1 text-[12px] text-right text-green-800 font-semibold border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                        />
                      </td>,
                      <td key={`${key}-wb`} className={`border ${isRoad ? 'border-gray-500' : 'border-gray-300'} p-0 align-middle ${bg}`}>
                        <input
                          data-cell-input={`${cfg.key}|${col}|${r}|weight_bot`}
                          value={st.weight_bot}
                          type="text"
                          inputMode="decimal"
                          onChange={(e) => update(col, r, { weight_bot: e.target.value })}
                          onBlur={() => persist(col, r)}
                          onKeyDown={(e) => handleKey(e, col, r, 'weight_bot')}
                          className="w-full px-1 py-1 text-[12px] text-right text-green-800 font-semibold border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                        />
                      </td>,
                    ];
                  })}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>

      <div className="text-xs text-gray-500 px-2 py-1.5 border-t bg-gray-50">
        <strong>Skróty:</strong> ↓↑ jeden rząd w pionie · →← w bok między polami · Enter = pole niżej · Tab = następne pole · zapis automatyczny.
        W KWIT wpisz <code className="bg-gray-200 px-1 rounded">K</code> = ten sam produkt na górze i dole; <code className="bg-gray-200 px-1 rounded">S / PZ</code> = S na górze, PZ na dole; <code className="bg-gray-200 px-1 rounded">K / 1580</code> = K z numerem kwitu 1580.
      </div>
    </div>
  );
}
