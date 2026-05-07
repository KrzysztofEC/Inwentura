'use client';

import { useRef, useState, useTransition } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode, productName } from '@/lib/products';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';

type Field = 'kwit' | 'starch' | 'weight_top' | 'weight_bot';
const FIELDS: Field[] = ['kwit', 'starch', 'weight_top', 'weight_bot'];

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
    raw_label: '', starch: '', weight_top: '', weight_bot: '', note: '',
    product_code: null, product_code_bot: null, isUnknown: false, saving: false, dirty: false,
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
    product_code_bot: parsed.codeBot,
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
  const [, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  function persist(col: string, row: number) {
    const key = `${col}|${row}`;
    const st = states.get(key);
    if (!st || !st.dirty) return;

    setStates((prev) => {
      const m = new Map(prev);
      const cur = m.get(key)!;
      m.set(key, { ...cur, saving: true });
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
          ...cur,
          saving: false,
          dirty: false,
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
      if ('raw_label' in patch) {
        const parsed = parseProductCode(next.raw_label);
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

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    col: string, row: number, field: Field
  ) {
    const cols = cfg.cols!;
    const rows = cfg.rows!;
    const colIdx = cols.indexOf(col);
    const fieldIdx = FIELDS.indexOf(field);

    if (e.key === 'Enter' || e.key === 'Tab') {
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
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      persist(col, row);
      if (row < rows) focusInput(col, row + 1, field);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      persist(col, row);
      if (row > 1) focusInput(col, row - 1, field);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      persist(col, row);
      if (fieldIdx < FIELDS.length - 1) {
        focusInput(col, row, FIELDS[fieldIdx + 1]);
      } else if (colIdx < cols.length - 1) {
        focusInput(cols[colIdx + 1], row, FIELDS[0]);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      persist(col, row);
      if (fieldIdx > 0) {
        focusInput(col, row, FIELDS[fieldIdx - 1]);
      } else if (colIdx > 0) {
        focusInput(cols[colIdx - 1], row, FIELDS[FIELDS.length - 1]);
      }
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  }

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <table ref={tableRef} className="border-collapse w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="bg-gray-900 text-white w-8"></th>
            {cfg.cols!.map((col) => (
              <th key={col} colSpan={4} className="bg-gray-900 text-white border border-gray-700 px-1 py-1 text-sm">
                {col}
              </th>
            ))}
          </tr>
          <tr>
            <th className="bg-gray-900"></th>
            {cfg.cols!.flatMap((col) => [
              <th key={`${col}-k`}  className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">KWIT</th>,
              <th key={`${col}-s`}  className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">SKROBIA</th>,
              <th key={`${col}-wt`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">WAGA góra</th>,
              <th key={`${col}-wb`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">WAGA dół</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cfg.rows! }, (_, i) => i + 1).map((r) => (
            <tr key={r}>
              <th className="bg-gray-900 text-white w-8 text-center align-middle">{r}</th>
              {cfg.cols!.flatMap((col) => {
                const key = `${col}|${r}`;
                const st = states.get(key) ?? emptyState();
                const cellBg = st.isUnknown ? 'bg-red-50' : (st.product_code || st.weight_top || st.weight_bot) ? 'bg-green-50' : '';

                return [
                  <td key={`${key}-k`} className={`border p-0 align-middle ${cellBg}`} style={{ minWidth: 90 }}>
                    <input
                      data-cell-input={`${cfg.key}|${col}|${r}|kwit`}
                      value={st.raw_label}
                      onChange={(e) => update(col, r, { raw_label: e.target.value })}
                      onBlur={() => persist(col, r)}
                      onKeyDown={(e) => handleKey(e, col, r, 'kwit')}
                      title={st.product_code ? `${st.product_code}${st.product_code_bot ? ' / ' + st.product_code_bot : ''}${productName(st.product_code) ? ` (${productName(st.product_code)})` : ''}` : ''}
                      className={`w-full h-full px-1 py-1 text-[12px] font-semibold border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                        st.isUnknown ? 'text-red-700' : ''
                      }`}
                    />
                  </td>,
                  <td key={`${key}-s`} className={`border p-0 align-middle ${cellBg}`} style={{ minWidth: 60 }}>
                    <input
                      data-cell-input={`${cfg.key}|${col}|${r}|starch`}
                      value={st.starch}
                      onChange={(e) => update(col, r, { starch: e.target.value })}
                      onBlur={() => persist(col, r)}
                      onKeyDown={(e) => handleKey(e, col, r, 'starch')}
                      className="w-full h-full px-1 py-1 text-[11px] text-gray-700 border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    />
                  </td>,
                  <td key={`${key}-wt`} className={`border p-0 align-middle ${cellBg}`} style={{ minWidth: 65 }}>
                    <input
                      data-cell-input={`${cfg.key}|${col}|${r}|weight_top`}
                      type="text"
                      inputMode="decimal"
                      value={st.weight_top}
                      onChange={(e) => update(col, r, { weight_top: e.target.value })}
                      onBlur={() => persist(col, r)}
                      onKeyDown={(e) => handleKey(e, col, r, 'weight_top')}
                      className="w-full h-full px-1 py-1 text-[12px] text-green-800 font-semibold text-right border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    />
                  </td>,
                  <td key={`${key}-wb`} className={`border p-0 align-middle ${cellBg}`} style={{ minWidth: 65 }}>
                    <input
                      data-cell-input={`${cfg.key}|${col}|${r}|weight_bot`}
                      type="text"
                      inputMode="decimal"
                      value={st.weight_bot}
                      onChange={(e) => update(col, r, { weight_bot: e.target.value })}
                      onBlur={() => persist(col, r)}
                      onKeyDown={(e) => handleKey(e, col, r, 'weight_bot')}
                      className="w-full h-full px-1 py-1 text-[12px] text-green-800 font-semibold text-right border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    />
                  </td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-500 px-2 py-1 border-t bg-gray-50">
        <strong>Skróty:</strong> ↓ jedzie kolumną w dół · ↑ w górę · → następne pole w prawo · ← w lewo ·
        Tab / Enter = następne pole · Shift+Tab = wstecz · zapis automatyczny.
        W KWIT wpisz np. <code className="bg-gray-200 px-1 rounded">S / PZ</code> żeby ustawić różne produkty na górze i dole.
      </div>
    </div>
  );
}
