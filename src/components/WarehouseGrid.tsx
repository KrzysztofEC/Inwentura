'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode, productName } from '@/lib/products';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';
import { ROAD_COL_1, ROAD_COL_2, colsWithRoad } from '@/lib/warehouses';

type Field = 'kwit' | 'starch' | 'weight_top' | 'weight_bot';

interface CellState {
  raw_label: string; starch: string; weight_top: string; weight_bot: string; note: string;
  product_code: string | null; product_code_bot: string | null;
  isUnknown: boolean; saving: boolean; dirty: boolean;
}

function emptyState(): CellState {
  return { raw_label: '', starch: '', weight_top: '', weight_bot: '', note: '', product_code: null, product_code_bot: null, isUnknown: false, saving: false, dirty: false };
}

function fromCell(c: Cell | undefined): CellState {
  if (!c) return emptyState();
  const parsed = parseProductCode(c.raw_label ?? '');
  return {
    raw_label: c.raw_label ?? '', starch: c.starch ?? '',
    weight_top: c.weight_top != null ? String(c.weight_top) : '',
    weight_bot: c.weight_bot != null ? String(c.weight_bot) : '',
    note: c.note ?? '',
    product_code: c.product_code ?? parsed.code,
    product_code_bot: c.product_code_bot ?? parsed.codeBot,
    isUnknown: c.product_code === 'UNKNOWN' || parsed.isUnknown,
    saving: false, dirty: false,
  };
}

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function isRoadCol(col: string): boolean { return col === ROAD_COL_1 || col === ROAD_COL_2; }

export function WarehouseGrid({ cfg, cells }: { cfg: WarehouseConfig; cells: Cell[] }) {
  const [states, setStates] = useState<Map<string, CellState>>(() => {
    const m = new Map<string, CellState>();
    for (const c of cells) m.set(`${c.col}|${c.row}`, fromCell(c));
    return m;
  });
  const statesRef = useRef(states);
  const [saveStatus, setSaveStatus] = useState<Map<string, SaveStatus>>(new Map());
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const retryRef = useRef<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);

  // ZAZNACZANIE — aktywne tylko gdy Ctrl wciśnięty
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isDragging = useRef(false);
  const dragStartRef = useRef<{ colIdx: number; rowIdx: number } | null>(null);

  const allCols = colsWithRoad(cfg);
  const editableCols = allCols.filter(c => !isRoadCol(c));
  const rowNumbers = (() => {
    const list: (number | 'M')[] = [];
    for (let i = 1; i <= cfg.rows!; i++) list.push(i);
    if (cfg.rowsReversed) list.reverse();
    if (cfg.hasMagazynek) list.push('M');
    return list;
  })();
  const numericRows = rowNumbers.filter(r => r !== 'M') as number[];

  // Nasłuch Ctrl
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(true); }
    function onKeyUp(e: KeyboardEvent) { if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(false); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  function getRange(start: { colIdx: number; rowIdx: number }, end: { colIdx: number; rowIdx: number }): Set<string> {
    const cMin = Math.min(start.colIdx, end.colIdx);
    const cMax = Math.max(start.colIdx, end.colIdx);
    const rMin = Math.min(start.rowIdx, end.rowIdx);
    const rMax = Math.max(start.rowIdx, end.rowIdx);
    const s = new Set<string>();
    for (let ci = cMin; ci <= cMax; ci++) {
      for (let ri = rMin; ri <= rMax; ri++) {
        s.add(`${editableCols[ci]}|${numericRows[ri]}`);
      }
    }
    return s;
  }

  function handleOverlayMouseDown(col: string, row: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const colIdx = editableCols.indexOf(col);
    const rowIdx = numericRows.indexOf(row);
    if (colIdx === -1 || rowIdx === -1) return;
    isDragging.current = true;
    dragStartRef.current = { colIdx, rowIdx };
    setSelected(new Set([`${col}|${row}`]));
  }

  function handleOverlayMouseEnter(col: string, row: number) {
    if (!isDragging.current || !dragStartRef.current) return;
    const colIdx = editableCols.indexOf(col);
    const rowIdx = numericRows.indexOf(row);
    if (colIdx === -1 || rowIdx === -1) return;
    setSelected(getRange(dragStartRef.current, { colIdx, rowIdx }));
  }

  useEffect(() => {
    function onMouseUp() { isDragging.current = false; }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Delete zaznaczonych
  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const keys = Array.from(selected);
    setStates(prev => {
      const next = new Map(prev);
      keys.forEach(key => next.set(key, { ...emptyState() }));
      statesRef.current = next;
      return next;
    });
    for (const key of keys) {
      const [col, rowStr] = key.split('|');
      await clearCell({ warehouse: cfg.key, col, row: parseInt(rowStr, 10) });
    }
    setSelected(new Set());
  }, [selected, cfg.key]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size === 0) return;
        e.preventDefault();
        deleteSelected();
        return;
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape') setSelected(new Set());
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, deleteSelected]);

  function setStatus(key: string, status: SaveStatus) {
    setSaveStatus((prev) => { const m = new Map(prev); m.set(key, status); return m; });
  }

  async function doSave(col: string, row: number) {
    const key = `${col}|${row}`;
    if (inFlightRef.current.has(key)) { retryRef.current.add(key); return; }
    const st = statesRef.current.get(key);
    if (!st || !st.dirty) return;
    inFlightRef.current.add(key);
    setStatus(key, 'saving');
    const snapshot = { raw_label: st.raw_label, starch: st.starch, weight_top: st.weight_top, weight_bot: st.weight_bot, note: st.note };
    try {
      if (!snapshot.raw_label && !snapshot.starch && !snapshot.weight_top && !snapshot.weight_bot && !snapshot.note) {
        await clearCell({ warehouse: cfg.key, col, row });
      } else {
        const result = await saveCell({ warehouse: cfg.key, col, row, ...snapshot });
        if (!result.ok) throw new Error(result.error || 'save failed');
      }
      const cur = statesRef.current.get(key);
      if (cur) {
        const stillSame = cur.raw_label === snapshot.raw_label && cur.starch === snapshot.starch && cur.weight_top === snapshot.weight_top && cur.weight_bot === snapshot.weight_bot && cur.note === snapshot.note;
        if (stillSame) {
          const parsed = parseProductCode(cur.raw_label);
          const cleaned: CellState = { ...cur, saving: false, dirty: false, product_code: parsed.code, product_code_bot: parsed.codeBot, isUnknown: parsed.isUnknown };
          const newMap = new Map(statesRef.current); newMap.set(key, cleaned); statesRef.current = newMap; setStates(newMap);
        }
      }
      setStatus(key, 'saved');
      setTimeout(() => { if (saveStatusRef.current.get(key) === 'saved') setStatus(key, 'idle'); }, 1500);
    } catch (e) { setStatus(key, 'error'); }
    finally {
      inFlightRef.current.delete(key);
      if (retryRef.current.has(key)) { retryRef.current.delete(key); doSave(col, row); }
    }
  }

  function scheduleSave(col: string, row: number, immediate = false) {
    const key = `${col}|${row}`;
    const existing = timersRef.current.get(key); if (existing) clearTimeout(existing);
    setStatus(key, 'pending');
    const timer = setTimeout(() => { timersRef.current.delete(key); doSave(col, row); }, immediate ? 0 : 400);
    timersRef.current.set(key, timer);
  }

  function flushAll() {
    for (const [key, timer] of timersRef.current.entries()) { clearTimeout(timer); const [col, rowStr] = key.split('|'); doSave(col, parseInt(rowStr, 10)); }
    timersRef.current.clear();
    for (const [key, st] of statesRef.current.entries()) { if (st.dirty && !inFlightRef.current.has(key)) { const [col, rowStr] = key.split('|'); doSave(col, parseInt(rowStr, 10)); } }
  }

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      let anyDirty = false;
      for (const st of statesRef.current.values()) { if (st.dirty) { anyDirty = true; break; } }
      if (anyDirty) { flushAll(); e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(col: string, row: number) { scheduleSave(col, row, true); }

  function update(col: string, row: number, patch: Partial<CellState>) {
    const key = `${col}|${row}`;
    const cur = statesRef.current.get(key) ?? emptyState();
    const next = { ...cur, ...patch, dirty: true };
    if ('raw_label' in patch) { const parsed = parseProductCode(next.raw_label); next.product_code = parsed.code; next.product_code_bot = parsed.codeBot; next.isUnknown = parsed.isUnknown; }
    const newMap = new Map(statesRef.current); newMap.set(key, next); statesRef.current = newMap; setStates(newMap);
    scheduleSave(col, row, false);
  }

  function focusInput(col: string, row: number, field: Field) {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell-input="${cfg.key}|${col}|${row}|${field}"]`);
    if (el) { el.focus(); el.select?.(); }
  }

  const FIELDS: Field[] = (() => { const f: Field[] = ['kwit']; if (cfg.middleRow) f.push('starch'); f.push('weight_top', 'weight_bot'); return f; })();

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>, col: string, row: number, field: Field) {
    const cols = colsWithRoad(cfg); const rows = cfg.rows!; const colIdx = cols.indexOf(col); const fieldIdx = FIELDS.indexOf(field);
    function rowDown(r: number) { if (cfg.rowsReversed) return r > 1 ? r - 1 : null; return r < rows ? r + 1 : null; }
    function rowUp(r: number) { if (cfg.rowsReversed) return r < rows ? r + 1 : null; return r > 1 ? r - 1 : null; }
    if (e.key === 'ArrowDown') { e.preventDefault(); persist(col, row); if (field === 'kwit') { if (cfg.middleRow) focusInput(col, row, 'starch'); else focusInput(col, row, 'weight_top'); } else if (field === 'starch') { focusInput(col, row, 'weight_top'); } else { const n = rowDown(row); if (n !== null) focusInput(col, n, 'kwit'); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); persist(col, row); if (field === 'weight_top' || field === 'weight_bot') { if (cfg.middleRow) focusInput(col, row, 'starch'); else focusInput(col, row, 'kwit'); } else if (field === 'starch') { focusInput(col, row, 'kwit'); } else { const p = rowUp(row); if (p !== null) focusInput(col, p, 'weight_top'); } }
    else if (e.key === 'ArrowRight') { e.preventDefault(); persist(col, row); if (field === 'weight_top') { focusInput(col, row, 'weight_bot'); } else if (field === 'weight_bot') { if (colIdx < cols.length - 1) focusInput(cols[colIdx + 1], row, 'weight_top'); } else { if (colIdx < cols.length - 1) focusInput(cols[colIdx + 1], row, field); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); persist(col, row); if (field === 'weight_bot') { focusInput(col, row, 'weight_top'); } else if (field === 'weight_top') { if (colIdx > 0) focusInput(cols[colIdx - 1], row, 'weight_bot'); } else { if (colIdx > 0) focusInput(cols[colIdx - 1], row, field); } }
    else if (e.key === 'Enter') { e.preventDefault(); persist(col, row); if (field === 'kwit') { if (cfg.middleRow) focusInput(col, row, 'starch'); else focusInput(col, row, 'weight_top'); } else if (field === 'starch') { focusInput(col, row, 'weight_top'); } else { const n = rowDown(row); if (n !== null) focusInput(col, n, 'kwit'); } }
    else if (e.key === 'Tab') {
      e.preventDefault(); persist(col, row);
      if (e.shiftKey) { if (fieldIdx > 0) { focusInput(col, row, FIELDS[fieldIdx - 1]); } else if (colIdx > 0) { focusInput(cols[colIdx - 1], row, FIELDS[FIELDS.length - 1]); } else { const p = rowUp(row); if (p !== null) focusInput(cols[cols.length - 1], p, FIELDS[FIELDS.length - 1]); } }
      else { if (fieldIdx < FIELDS.length - 1) { focusInput(col, row, FIELDS[fieldIdx + 1]); } else if (colIdx < cols.length - 1) { focusInput(cols[colIdx + 1], row, FIELDS[0]); } else { const n = rowDown(row); if (n !== null) focusInput(cols[0], n, FIELDS[0]); } }
    } else if (e.key === 'Escape') { e.currentTarget.blur(); }
  }

  const middleLabel = cfg.middleRow === 'info' ? 'INFO' : 'SKROBIA';
  const hasMiddle = !!cfg.middleRow;

  function cellBg(st: CellState, col: string, isSel: boolean): string {
    if (isSel) return 'bg-blue-100';
    const road = isRoadCol(col);
    if (st.isUnknown) return 'bg-red-100';
    if (st.product_code || st.weight_top || st.weight_bot) return road ? 'bg-yellow-100' : 'bg-green-50';
    return road ? 'bg-gray-200' : '';
  }

  function colWidth(col: string) { return isRoadCol(col) ? 45 : 70; }

  function renderInput(col: string, row: number, field: Field) {
    const key = `${col}|${row}`; const st = states.get(key) ?? emptyState(); const status = saveStatus.get(key) ?? 'idle';
    const base = 'w-full px-1 py-1 border-0 outline-none bg-transparent focus:bg-yellow-100 focus:ring-2 focus:ring-blue-500 focus:ring-inset';
    if (field === 'kwit') return (
      <div className="relative">
        <input data-cell-input={`${cfg.key}|${col}|${row}|kwit`} value={st.raw_label}
          onChange={(e) => update(col, row, { raw_label: e.target.value })} onBlur={() => persist(col, row)}
          onKeyDown={(e) => handleKey(e, col, row, 'kwit')}
          title={st.product_code ? `${st.product_code}${st.product_code_bot ? ' / ' + st.product_code_bot : ''} (${productName(st.product_code)})` : ''}
          className={`${base} text-[12px] text-center font-semibold ${st.isUnknown ? 'text-red-700' : ''}`} />
        {status !== 'idle' && <span className={`absolute top-0 right-0.5 text-[8px] leading-none ${status === 'pending' ? 'text-gray-400' : status === 'saving' ? 'text-blue-500 animate-pulse' : status === 'saved' ? 'text-green-600' : 'text-red-600 font-bold'}`}>●</span>}
      </div>
    );
    if (field === 'starch') return <input data-cell-input={`${cfg.key}|${col}|${row}|starch`} value={st.starch} onChange={(e) => update(col, row, { starch: e.target.value })} onBlur={() => persist(col, row)} onKeyDown={(e) => handleKey(e, col, row, 'starch')} className={`${base} text-[11px] text-center text-gray-700`} />;
    if (field === 'weight_top') return <input data-cell-input={`${cfg.key}|${col}|${row}|weight_top`} value={st.weight_top} type="text" inputMode="decimal" onChange={(e) => update(col, row, { weight_top: e.target.value })} onBlur={() => persist(col, row)} onKeyDown={(e) => handleKey(e, col, row, 'weight_top')} className={`${base} text-[12px] text-right text-green-800 font-semibold`} />;
    if (field === 'weight_bot') return <input data-cell-input={`${cfg.key}|${col}|${row}|weight_bot`} value={st.weight_bot} type="text" inputMode="decimal" onChange={(e) => update(col, row, { weight_bot: e.target.value })} onBlur={() => persist(col, row)} onKeyDown={(e) => handleKey(e, col, row, 'weight_bot')} className={`${base} text-[12px] text-right text-green-800 font-semibold`} />;
    return null;
  }

  function renderTd(col: string, row: number, colSpan: number, tdKey: string, field: Field) {
    const road = isRoadCol(col);
    const key = `${col}|${row}`;
    const st = states.get(key) ?? emptyState();
    const isSel = selected.has(key);
    const bg = cellBg(st, col, isSel);
    const border = road ? 'border-gray-500' : 'border-gray-300';
    return (
      <td key={tdKey} colSpan={colSpan} className={`border ${border} p-0 align-middle ${bg} relative`}>
        {renderInput(col, row, field)}
        {/* Nakładka TYLKO gdy Ctrl wciśnięty */}
        {ctrlHeld && (
          <div
            className="absolute inset-0 z-20"
            style={{ cursor: 'crosshair', background: isSel ? 'rgba(59,130,246,0.15)' : 'transparent' }}
            onMouseDown={(e) => handleOverlayMouseDown(col, row, e)}
            onMouseEnter={() => handleOverlayMouseEnter(col, row)}
          />
        )}
        {isSel && <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-30" />}
      </td>
    );
  }

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <SaveBar states={states} saveStatus={saveStatus} flushAll={flushAll}
        selected={selected} ctrlHeld={ctrlHeld} onDeleteSelected={deleteSelected} onClearSelected={() => setSelected(new Set())} />
      <table ref={tableRef} className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 36 }} /><col style={{ width: 70 }} />
          {allCols.flatMap((col, idx) => [<col key={`g-${idx}`} style={{ width: colWidth(col) }} />, <col key={`d-${idx}`} style={{ width: colWidth(col) }} />])}
          <col style={{ width: 36 }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="bg-gray-900 text-white"></th><th className="bg-gray-900 text-white text-xs">DATA</th>
            {allCols.map((col, idx) => <th key={idx} colSpan={2} className={`text-sm font-bold py-1 border ${isRoadCol(col) ? 'bg-gray-500 text-white border-gray-700' : 'bg-gray-900 text-white border-gray-700'}`}>{isRoadCol(col) ? 'DROGA' : col}</th>)}
            <th className="bg-gray-900 text-white"></th>
          </tr>
          <tr>
            <th className="bg-gray-900 text-white text-[10px]"></th><th className="bg-gray-700 text-gray-200 text-[10px] font-normal"></th>
            {allCols.flatMap((col, idx) => [
              <th key={`${idx}-g`} className={`font-normal text-[10px] border ${isRoadCol(col) ? 'bg-gray-400 text-gray-100 border-gray-600' : 'bg-gray-700 text-gray-200 border-gray-600'}`}>góra</th>,
              <th key={`${idx}-d`} className={`font-normal text-[10px] border ${isRoadCol(col) ? 'bg-gray-400 text-gray-100 border-gray-600' : 'bg-gray-700 text-gray-200 border-gray-600'}`}>dół</th>,
            ])}
            <th className="bg-gray-700 text-gray-200 text-[10px] font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rowNumbers.map((rNum) => {
            if (rNum === 'M') return (
              <tr key="magazynek">
                <th className="bg-gray-900 text-white w-9 text-center align-middle text-xs">M</th>
                <th className="bg-amber-100 border text-xs font-semibold">Magazynek</th>
                <td colSpan={allCols.length * 2} className="border bg-amber-50 text-xs italic text-gray-500 px-2">(rząd specjalny - dane wpisuj jak zwykłe komórki magazynu w razie potrzeby)</td>
                <th className="bg-gray-900 text-white w-9 text-center align-middle text-xs">M</th>
              </tr>
            );
            const r = rNum as number;
            const nSubRows = hasMiddle ? 3 : 2;
            return (
              <>
                <tr key={`${r}-kwit`} className="border-t-2 border-t-gray-700">
                  <th rowSpan={nSubRows} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-r-2 border-gray-700">{r}</th>
                  <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">KWIT</th>
                  {allCols.map((col, idx) => renderTd(col, r, 2, `${idx}-${r}-kwit`, 'kwit'))}
                  <th rowSpan={nSubRows} className="bg-gray-900 text-white w-9 text-center align-middle text-base font-bold border-l-2 border-gray-700">{r}</th>
                </tr>
                {hasMiddle && (
                  <tr key={`${r}-starch`}>
                    <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">{middleLabel}</th>
                    {allCols.map((col, idx) => renderTd(col, r, 2, `${idx}-${r}-starch`, 'starch'))}
                  </tr>
                )}
                <tr key={`${r}-weight`}>
                  <th className="bg-gray-100 border border-gray-300 text-[10px] font-semibold uppercase text-gray-700 px-1">WAGA</th>
                  {allCols.flatMap((col, idx) => [
                    renderTd(col, r, 1, `${idx}-${r}-wt`, 'weight_top'),
                    renderTd(col, r, 1, `${idx}-${r}-wb`, 'weight_bot'),
                  ])}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-gray-500 px-2 py-1.5 border-t bg-gray-50">
        <strong>Skróty:</strong> ↓↑ jeden rząd · →← w bok · Enter = pole niżej · Tab = następne pole · zapis automatyczny ·
        <strong> Przytrzymaj Ctrl</strong> i przeciągnij myszką = zaznacz komórki · <strong>Delete</strong> = usuń zaznaczone · <strong>Esc</strong> = odznacz.
      </div>
    </div>
  );
}

function SaveBar({ states, saveStatus, flushAll, selected, ctrlHeld, onDeleteSelected, onClearSelected }: {
  states: Map<string, CellState>; saveStatus: Map<string, SaveStatus>; flushAll: () => void;
  selected: Set<string>; ctrlHeld: boolean; onDeleteSelected: () => void; onClearSelected: () => void;
}) {
  let dirty = 0; let saving = 0; let errors = 0;
  for (const st of states.values()) if (st.dirty) dirty++;
  for (const s of saveStatus.values()) { if (s === 'saving') saving++; else if (s === 'error') errors++; }

  if (selected.size > 0) return (
    <div className="px-2 py-1 text-xs bg-blue-50 border-b border-blue-300 text-blue-900 flex items-center gap-3">
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Zaznaczono: <strong>{selected.size}</strong> {selected.size === 1 ? 'komórkę' : 'komórek'}</span>
      <button onClick={onDeleteSelected} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[11px] font-semibold">🗑 Usuń zaznaczone (Delete)</button>
      <button onClick={onClearSelected} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-0.5 rounded text-[11px]">Odznacz (Esc)</button>
    </div>
  );

  if (ctrlHeld) return (
    <div className="px-2 py-1 text-xs bg-indigo-50 border-b border-indigo-200 text-indigo-800 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
      Tryb zaznaczania — przeciągnij myszką po komórkach które chcesz zaznaczyć
    </div>
  );

  if (dirty === 0 && saving === 0 && errors === 0) return (
    <div className="px-2 py-1 text-xs bg-green-50 border-b border-green-200 text-green-800 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500"></span>Wszystkie zmiany zapisane
    </div>
  );

  return (
    <div className="px-2 py-1 text-xs bg-yellow-50 border-b border-yellow-300 text-yellow-900 flex items-center gap-3 flex-wrap">
      {saving > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>Zapisuję {saving}...</span>}
      {dirty > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>Niesynchronizowanych: <strong>{dirty}</strong></span>}
      {errors > 0 && <span className="flex items-center gap-1 text-red-700 font-semibold"><span className="w-2 h-2 rounded-full bg-red-500"></span>Błędy: {errors}</span>}
      <button onClick={flushAll} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[11px] font-semibold">💾 Wymuś zapis teraz</button>
    </div>
  );
}
