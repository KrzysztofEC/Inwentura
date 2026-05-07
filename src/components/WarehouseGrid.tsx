'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';

// Pole w siatce nawigacji - każda komórka ma 3 pola: kod, skrobia, waga
type Field = 'code' | 'starch' | 'weight';
const FIELDS: Field[] = ['code', 'starch', 'weight'];

interface CellState {
  raw_label: string;
  starch: string;
  weight: string;
  note: string;
  product_code: string | null;
  isUnknown: boolean;
  saving: boolean;
  dirty: boolean;
}

function emptyState(): CellState {
  return {
    raw_label: '', starch: '', weight: '', note: '',
    product_code: null, isUnknown: false, saving: false, dirty: false,
  };
}

function fromCell(c: Cell | undefined): CellState {
  if (!c) return emptyState();
  return {
    raw_label: c.raw_label ?? '',
    starch: c.starch ?? '',
    weight: c.weight !== null && c.weight !== undefined ? String(c.weight) : '',
    note: c.note ?? '',
    product_code: c.product_code,
    isUnknown: c.product_code === 'UNKNOWN',
    saving: false,
    dirty: false,
  };
}

export function WarehouseGrid({ cfg, cells }: { cfg: WarehouseConfig; cells: Cell[] }) {
  const [states, setStates] = useState<Map<string, CellState>>(() => {
    const m = new Map<string, CellState>();
    for (const c of cells) m.set(`${c.col}|${c.row}|${c.slot}`, fromCell(c));
    return m;
  });
  const [, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  function persist(col: string, row: number, slot: 'gora' | 'dol') {
    const key = `${col}|${row}|${slot}`;
    const st = states.get(key);
    if (!st || !st.dirty) return;

    setStates((prev) => {
      const m = new Map(prev);
      const cur = m.get(key)!;
      m.set(key, { ...cur, saving: true });
      return m;
    });

    startTransition(async () => {
      if (!st.raw_label && !st.starch && !st.weight && !st.note) {
        await clearCell({ warehouse: cfg.key, col, row, slot });
      } else {
        await saveCell({
          warehouse: cfg.key, col, row, slot,
          raw_label: st.raw_label,
          starch: st.starch,
          weight: st.weight,
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
          isUnknown: parsed.isUnknown,
        });
        return m;
      });
    });
  }

  function update(col: string, row: number, slot: 'gora' | 'dol', patch: Partial<CellState>) {
    setStates((prev) => {
      const m = new Map(prev);
      const cur = m.get(`${col}|${row}|${slot}`) ?? emptyState();
      const next = { ...cur, ...patch, dirty: true };
      if ('raw_label' in patch) {
        const parsed = parseProductCode(next.raw_label);
        next.product_code = parsed.code;
        next.isUnknown = parsed.isUnknown;
      }
      m.set(`${col}|${row}|${slot}`, next);
      return m;
    });
  }

  function focusInput(col: string, row: number, slot: 'gora' | 'dol', field: Field) {
    const tbl = tableRef.current;
    if (!tbl) return;
    const sel = `[data-cell-input="${cfg.key}|${col}|${row}|${slot}|${field}"]`;
    const el = tbl.querySelector<HTMLInputElement>(sel);
    if (el) {
      el.focus();
      el.select?.();
    }
  }

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    col: string, row: number, slot: 'gora' | 'dol', field: Field
  ) {
    const cols = cfg.cols!;
    const rows = cfg.rows!;
    const colIdx = cols.indexOf(col);
    const fieldIdx = FIELDS.indexOf(field);

    function nextCell(): { col: string; row: number; slot: 'gora' | 'dol'; field: Field } | null {
      if (slot === 'gora') return { col, row, slot: 'dol', field };
      if (colIdx < cols.length - 1) {
        return { col: cols[colIdx + 1], row, slot: 'gora', field };
      }
      if (row < rows) {
        return { col: cols[0], row: row + 1, slot: 'gora', field };
      }
      return null;
    }

    function prevCell(): { col: string; row: number; slot: 'gora' | 'dol'; field: Field } | null {
      if (slot === 'dol') return { col, row, slot: 'gora', field };
      if (colIdx > 0) return { col: cols[colIdx - 1], row, slot: 'dol', field };
      if (row > 1) return { col: cols[cols.length - 1], row: row - 1, slot: 'dol', field };
      return null;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      persist(col, row, slot);
      if (e.shiftKey) {
        if (fieldIdx > 0) {
          focusInput(col, row, slot, FIELDS[fieldIdx - 1]);
        } else {
          const p = prevCell();
          if (p) focusInput(p.col, p.row, p.slot, FIELDS[FIELDS.length - 1]);
        }
      } else {
        if (fieldIdx < FIELDS.length - 1) {
          focusInput(col, row, slot, FIELDS[fieldIdx + 1]);
        } else {
          const n = nextCell();
          if (n) focusInput(n.col, n.row, n.slot, FIELDS[0]);
        }
      }
      return;
    }

    const input = e.currentTarget;
    const atStart = input.selectionStart === 0;
    const atEnd = input.selectionEnd === input.value.length;

    if (e.key === 'ArrowRight' && atEnd) {
      e.preventDefault();
      persist(col, row, slot);
      if (fieldIdx < FIELDS.length - 1) {
        focusInput(col, row, slot, FIELDS[fieldIdx + 1]);
      } else {
        const n = nextCell();
        if (n) focusInput(n.col, n.row, n.slot, FIELDS[0]);
      }
    } else if (e.key === 'ArrowLeft' && atStart) {
      e.preventDefault();
      persist(col, row, slot);
      if (fieldIdx > 0) {
        focusInput(col, row, slot, FIELDS[fieldIdx - 1]);
      } else {
        const p = prevCell();
        if (p) focusInput(p.col, p.row, p.slot, FIELDS[FIELDS.length - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      persist(col, row, slot);
      if (slot === 'gora') focusInput(col, row, 'dol', field);
      else if (row < rows) focusInput(col, row + 1, 'gora', field);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      persist(col, row, slot);
      if (slot === 'dol') focusInput(col, row, 'gora', field);
      else if (row > 1) focusInput(col, row - 1, 'dol', field);
    } else if (e.key === 'Escape') {
      input.blur();
    }
  }

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <table ref={tableRef} className="border-collapse w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="bg-gray-900 text-white w-8"></th>
            {cfg.cols!.map((col) => (
              <th key={col} colSpan={2} className="bg-gray-900 text-white border border-gray-700 px-1 py-1 text-sm">{col}</th>
            ))}
          </tr>
          <tr>
            <th className="bg-gray-900"></th>
            {cfg.cols!.flatMap((col) => [
              <th key={`${col}-g`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">góra</th>,
              <th key={`${col}-d`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">dół</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cfg.rows! }, (_, i) => i + 1).map((r) => (
            <tr key={r}>
              <th className="bg-gray-900 text-white w-8 text-center align-middle">{r}</th>
              {cfg.cols!.flatMap((col) =>
                (['gora', 'dol'] as const).map((slot) => {
                  const key = `${col}|${r}|${slot}`;
                  const st = states.get(key) ?? emptyState();
                  return (
                    <td
                      key={key}
                      className={`border p-0.5 align-top w-[110px] ${
                        st.isUnknown ? 'bg-red-50' : st.product_code ? 'bg-green-50' : ''
                      }`}
                    >
                      <input
                        data-cell-input={`${cfg.key}|${col}|${r}|${slot}|code`}
                        value={st.raw_label}
                        onChange={(e) => update(col, r, slot, { raw_label: e.target.value })}
                        onBlur={() => persist(col, r, slot)}
                        onKeyDown={(e) => handleKey(e, col, r, slot, 'code')}
                        placeholder="kod"
                        className={`w-full px-1 py-0.5 text-[11px] font-medium border-0 outline-none bg-transparent focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 rounded-sm ${
                          st.isUnknown ? 'text-red-700' : ''
                        }`}
                      />
                      <input
                        data-cell-input={`${cfg.key}|${col}|${r}|${slot}|starch`}
                        value={st.starch}
                        onChange={(e) => update(col, r, slot, { starch: e.target.value })}
                        onBlur={() => persist(col, r, slot)}
                        onKeyDown={(e) => handleKey(e, col, r, slot, 'starch')}
                        placeholder="skrobia"
                        className="w-full px-1 py-0.5 text-[10px] text-gray-600 border-0 outline-none bg-transparent focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 rounded-sm"
                      />
                      <input
                        data-cell-input={`${cfg.key}|${col}|${r}|${slot}|weight`}
                        type="text"
                        inputMode="decimal"
                        value={st.weight}
                        onChange={(e) => update(col, r, slot, { weight: e.target.value })}
                        onBlur={() => persist(col, r, slot)}
                        onKeyDown={(e) => handleKey(e, col, r, slot, 'weight')}
                        placeholder="waga"
                        className="w-full px-1 py-0.5 text-[11px] text-green-800 font-semibold border-0 outline-none bg-transparent focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 rounded-sm"
                      />
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-500 px-2 py-1 border-t bg-gray-50">
        <strong>Skróty:</strong> Tab / Enter / → = następne pole · Shift+Tab / ← = poprzednie ·
        ↓↑ = ten sam typ pola w komórce niżej/wyżej · zapis automatyczny przy opuszczaniu pola
      </div>
    </div>
  );
}
