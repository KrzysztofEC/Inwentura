'use client';

import { useRef, useState, useTransition } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode, productName } from '@/lib/products';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';
import { ROAD_COL_KEY, colsWithRoad } from '@/lib/warehouses';

type Field = 'kwit_top' | 'kwit_bot' | 'starch_top' | 'starch_bot' | 'weight_top' | 'weight_bot';

interface CellState {
  kwit_top: string;
  kwit_bot: string;
  starch_top: string;
  starch_bot: string;
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
    kwit_top: '', kwit_bot: '',
    starch_top: '', starch_bot: '',
    weight_top: '', weight_bot: '',
    note: '',
    product_code: null, product_code_bot: null,
    isUnknown: false, saving: false, dirty: false,
  };
}

function fromCell(c: Cell | undefined): CellState {
  if (!c) return emptyState();
  const parsed = parseProductCode(c.raw_label ?? '');

  let kwit_top = c.raw_label ?? '';
  let kwit_bot = '';
  if (parsed.codeBot && c.raw_label?.includes('/')) {
    const [first, second] = c.raw_label.split('/', 2).map((s) => s.trim());
    if (!/^\d+$/.test(second)) {
      kwit_top = first;
      kwit_bot = second;
    }
  }

  let starch_top = c.starch ?? '';
  let starch_bot = '';
  if (c.starch && c.starch.includes('/')) {
    const [first, second] = c.starch.split('/', 2).map((s) => s.trim());
    starch_top = first;
    starch_bot = second;
  }

  return {
    kwit_top, kwit_bot,
    starch_top, starch_bot,
    weight_top: c.weight_top !== null && c.weight_top !== undefined ? String(c.weight_top) : '',
    weight_bot: c.weight_bot !== null && c.weight_bot !== undefined ? String(c.weight_bot) : '',
    note: c.note ?? '',
    product_code: c.product_code ?? parsed.code,
    product_code_bot: c.product_code_bot ?? parsed.codeBot,
    isUnknown: c.product_code === 'UNKNOWN' || parsed.isUnknown,
    saving: false, dirty: false,
  };
}

function buildRawLabel(st: CellState): string {
  const top = st.kwit_top.trim();
  const bot = st.kwit_bot.trim();
  if (top && bot) return `${top} / ${bot}`;
  return top || bot;
}

function buildStarch(st: CellState): string {
  const top = st.starch_top.trim();
  const bot = st.starch_bot.trim();
  if (top && bot) return `${top} / ${bot}`;
  return top || bot;
}

export function WarehouseGrid({ cfg, cells }: { cfg: WarehouseConfig; cells: Cell[] }) {
  const [states, setStates] = useState<Map<string, CellState>>(() => {
    const m = new Map<string, CellState>();
    for (const c of cells) m.set(`${c.col}|${c.row}`, fromCell(c));
    return m;
  });
  const [, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  function persist(col: string, row: number) {
    const key = `${col}|${row}`;
    const st = states.get(key);
    if (!st || !st.dirty) return;

    setStates((prev) => {
      const m = new Map(prev);
      m.set(key, { ...m.get(key)!, saving: true });
      return m;
    });

    const rawLabel = buildRawLabel(st);
    const starch = buildStarch(st);

    startTransition(async () => {
      if (!rawLabel && !starch && !st.weight_top && !st.weight_bot && !st.note) {
        await clearCell({ warehouse: cfg.key, col, row });
      } else {
        await saveCell({
          warehouse: cfg.key, col, row,
          raw_label: rawLabel,
          starch: starch,
          weight_top: st.weight_top,
          weight_bot: st.weight_bot,
          note: st.note,
        });
      }
      setStates((prev) => {
        const m = new Map(prev);
        const cur = m.get(key);
        if (!cur) return prev;
        const parsed = parseProductCode(rawLabel);
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
    setStates((prev) => {
      const m = new Map(prev);
      const cur = m.get(`${col}|${row}`) ?? emptyState();
      const next = { ...cur, ...patch, dirty: true };
      if ('kwit_top' in patch || 'kwit_bot' in patch) {
        const raw = buildRawLabel(next);
        const parsed = parseProductCode(raw);
        next.product_code = parsed.code;
        next.product_code_bot = parsed.codeBot;
        next.isUnknown = parsed.isUnknown;
      }
      m.set(`${col}|${row}`, next);
      return m;
    });
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

  type SubRow = 'kwit' | 'starch' | 'weight';
  type Side = 'top' | 'bot';
  const SUB_ROWS: SubRow[] = cfg.noStarch ? ['kwit', 'weight'] : ['kwit', 'starch', 'weight'];

  function fieldOf(sub: SubRow, side: Side): Field {
    return `${sub}_${side}` as Field;
  }
  function parseField(f: Field): { sub: SubRow; side: Side } {
    const [sub, side] = f.split('_') as [SubRow, Side];
    return { sub, side };
  }

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    col: string, row: number, field: Field
  ) {
    const cols = colsWithRoad(cfg);
    const rows = cfg.rows!;
    const colIdx = cols.indexOf(col);
    const { sub, side } = parseField(field);
    const subIdx = SUB_ROWS.indexOf(sub);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      persist(col, row);
      if (subIdx < SUB_ROWS.length - 1) {
        focusInput(col, row, fieldOf(SUB_ROWS[subIdx + 1], side));
      } else if (row < rows) {
        focusInput(col, row + 1, fieldOf(SUB_ROWS[0], side));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      persist(col, row);
      if (subIdx > 0) {
        focusInput(col, row, fieldOf(SUB_ROWS[subIdx - 1], side));
      } else if (row > 1) {
        focusInput(col, row - 1, fieldOf(SUB_ROWS[SUB_ROWS.length - 1], side));
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      persist(col, row);
      if (side === 'top') {
        focusInput(col, row, fieldOf(sub, 'bot'));
      } else if (colIdx < cols.length - 1) {
        focusInput(cols[colIdx + 1], row, fieldOf(sub, 'top'));
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      persist(col, row);
      if (side === 'bot') {
        focusInput(col, row, fieldOf(sub, 'top'));
      } else if (colIdx > 0) {
        focusInput(cols[colIdx - 1], row, fieldOf(sub, 'bot'));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      persist(col, row);
      if (subIdx < SUB_ROWS.length - 1) {
        focusInput(col, row, fieldOf(SUB_ROWS[subIdx + 1], side));
      } else if (row < rows) {
        focusInput(col, row + 1, fieldOf(SUB_ROWS[0], side));
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      persist(col, row);
      if (e.shiftKey) {
        if (side === 'bot') {
          focusInput(col, row, fieldOf(sub, 'top'));
        } else if (colIdx > 0) {
          focusInput(cols[colIdx - 1], row, fieldOf(sub, 'bot'));
        }
      } else {
        if (side === 'top') {
          focusInput(col, row, fieldOf(sub, 'bot'));
        } else if (colIdx < cols.length - 1) {
          focusInput(cols[colIdx + 1], row, fieldOf(sub, 'top'));
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

  // Lista wszystkich kolumn do renderowania (zawiera DROGA jeśli skonfigurowano)
  const allCols = colsWithRoad(cfg);

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
            const subRows: SubRow[] = SUB_ROWS;

            return subRows.map((sub, subIdx) => (
              <tr key={`${r}-${sub}`} className={subIdx === 0 ? 'border-t-2 border-t-gray-700' : ''}>
                {subIdx === 0 && (
                  <th rowSpan={subRows.length} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-r-2 border-gray-700">
                    {r}
                  </th>
                )}
                <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">
                  {sub === 'kwit' ? 'KWIT' : sub === 'starch' ? 'SKROBIA' : 'WAGA'}
                </th>

                {allCols.flatMap((col) => {
                  const isRoad = col === ROAD_COL_KEY;
                  const key = `${col}|${r}`;
                  const st = states.get(key) ?? emptyState();
                  const bg = cellBgClass(st, isRoad);

                  function fieldInput(side: Side) {
                    const f = fieldOf(sub, side);
                    const value = st[f as keyof CellState] as string;
                    const isWeight = sub === 'weight';
                    const isKwit = sub === 'kwit';
                    return (
                      <td key={`${key}-${sub}-${side}`} className={`border ${isRoad ? 'border-gray-500' : 'border-gray-300'} p-0 align-middle ${bg}`}>
                        <input
                          data-cell-input={`${cfg.key}|${col}|${r}|${f}`}
                          value={value}
                          type="text"
                          inputMode={isWeight ? 'decimal' : undefined}
                          onChange={(e) => update(col, r, { [f]: e.target.value } as any)}
                          onBlur={() => persist(col, r)}
                          onKeyDown={(e) => handleKey(e, col, r, f)}
                          title={isKwit && st.product_code ? `${st.product_code}${st.product_code_bot ? ' / ' + st.product_code_bot : ''} (${productName(st.product_code)})` : ''}
                          className={`w-full px-1 py-1 text-[12px] border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                            isWeight ? 'text-right text-green-800 font-semibold' :
                            isKwit ? `font-semibold ${st.isUnknown ? 'text-red-700' : ''}` :
                            'text-gray-700'
                          }`}
                        />
                      </td>
                    );
                  }

                  return [fieldInput('top'), fieldInput('bot')];
                })}

                {subIdx === 0 && (
                  <th rowSpan={subRows.length} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-l-2 border-gray-700">
                    {r}
                  </th>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>

      <div className="text-xs text-gray-500 px-2 py-1.5 border-t bg-gray-50">
        <strong>Skróty:</strong> ↓ kolumną w dół (KWIT → SKROBIA → WAGA → KWIT następnego rzędu) ·
        ↑ w górę · → góra→dół tej samej kolumny → góra następnej · ← w lewo ·
        Enter = pole niżej · Tab = pole w prawo · zapis automatyczny ·
        W KWIT możesz wpisać różne produkty na górę i dół osobno.
        {cfg.roadAfter && <span className="ml-2"><strong>DROGA</strong> = kolumna zapasowa, edytowalna gdy magazyn pełny.</span>}
      </div>
    </div>
  );
}
