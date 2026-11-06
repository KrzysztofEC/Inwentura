'use client';

import { useRef, useState, useTransition, useMemo, useLayoutEffect } from 'react';
import { saveAmbro, deleteAmbro } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { AmbroEntry } from '@/types/db';

type AmbroRow = AmbroEntry & { _tmpId: string };

let tmpCounter = 0;
function newTmpId() { return `tmp-${++tmpCounter}`; }

function sortByDate(arr: AmbroRow[]): AmbroRow[] {
  return [...arr].sort((a, b) => {
    if (!a.issue_date && !b.issue_date) return 0;
    if (!a.issue_date) return 1;
    if (!b.issue_date) return -1;
    return a.issue_date.localeCompare(b.issue_date);
  });
}

function fieldMatches(value: string | null | undefined, filter: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === filter.toLowerCase();
}

function anyFieldMatches(r: AmbroRow, filter: string): boolean {
  if (!filter.trim()) return true;
  const f = filter.trim();
  // Tylko dokładne dopasowanie kodu produktu
  if (fieldMatches(r.product_code, f)) return true;
  // Dla kwitu, dat — tylko jeśli zaczyna się od szukanej frazy
  const looseFields = [r.kwit, r.issue_date, r.receive_date];
  return looseFields.some(v => v?.toLowerCase().startsWith(f.toLowerCase()));
}

function rowKey(r: AmbroRow): string {
  return r.id ? `id-${r.id}` : r._tmpId;
}

// Szerokości kolumn – JEDNA definicja dla nagłówka i wierszy, więc zawsze są w jednej linii
const COLS: { label: string; width?: number; align?: 'left' | 'center' }[] = [
  { label: 'Kod', width: 120 },
  { label: 'Waga Stan', width: 110, align: 'center' },
  { label: 'Wydanie do Ambro', width: 120 },
  { label: 'Przyjęcie do EC', width: 120 },
  { label: 'Ilość Palet', width: 90 },
  { label: 'Nr KW', width: 110 },
  { label: 'Wydanie', width: 140 },
  { label: 'Przyjęcie EC', width: 140 },
  { label: 'Uwagi' },            // reszta szerokości
  { label: '', width: 36 },
];
const MIN_TABLE_WIDTH = 1300;

// Pole tekstowe, które samo rośnie w dół, gdy tekst się nie mieści
function AutoGrowTextarea({ value, onChange, className, placeholder, inputId }: {
  value: string; onChange: (v: string) => void; className: string; placeholder?: string; inputId: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useLayoutEffect(resize, [value]);
  useLayoutEffect(() => {
    // Przelicz po zmianie szerokości okna (inna rozdzielczość / zmiana rozmiaru)
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return (
    <textarea
      ref={ref}
      data-input-id={inputId}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={value || undefined}
      placeholder={placeholder}
      className={`${className} resize-none overflow-hidden leading-snug block group-hover:border-blue-400`}
      style={{ minHeight: 30 }}
    />
  );
}

export function AmbroEditor({ initial }: { initial: AmbroEntry[] }) {
  const initRows: AmbroRow[] = sortByDate(initial.map(r => ({ ...r, _tmpId: newTmpId() })));
  const [rows, setRows] = useState<AmbroRow[]>(initRows);
  const rowsRef = useRef<AmbroRow[]>(initRows);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState('');
  // Timery debounce per wiersz
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function update(rKey: string, patch: Partial<AmbroRow>) {
    setRows((prev) => {
      const next = prev.map(r => rowKey(r) === rKey ? { ...r, ...patch } : r);
      rowsRef.current = next;
      return next;
    });
    // Debounced save — zapisz 1.5s po ostatniej zmianie w tym wierszu
    scheduleSave(rKey);
  }

  function scheduleSave(rKey: string) {
    const existing = saveTimers.current.get(rKey);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.current.delete(rKey);
      doSave(rKey);
    }, 1500);
    saveTimers.current.set(rKey, timer);
  }

  function doSave(rKey: string) {
    const r = rowsRef.current.find(row => rowKey(row) === rKey);
    if (!r) return;
    startTransition(async () => {
      const res = await saveAmbro({
        id: r.id || undefined,
        raw_label: r.raw_label ?? '',
        kwit: r.kwit ?? '',
        wydanie_ambro: r.wydanie_ambro ?? '',
        przyjecie_ec: r.przyjecie_ec ?? '',
        ilosc_palet: r.ilosc_palet ?? '',
        issue_date: r.issue_date ?? '',
        receive_date: r.receive_date ?? '',
        notes: r.notes ?? '',
      });
      if (res.ok) {
        setRows((prev) => {
          const updated = prev.map(row =>
            rowKey(row) === rKey
              ? { ...row, id: res.id!, product_code: res.product_code ?? null }
              : row
          );
          // Sortujemy TYLKO jeśli data się zmieniła — sprawdzamy czy kolejność się zmieni
          const needsSort = updated.some((row, i) => {
            if (i === 0) return false;
            const prev2 = updated[i - 1];
            if (!prev2.issue_date || !row.issue_date) return false;
            return prev2.issue_date > row.issue_date;
          });
          const result = needsSort ? sortByDate(updated) : updated;
          rowsRef.current = result;
          return result;
        });
      }
    });
  }

  function addRow() {
    const tmpId = newTmpId();
    const newRow: AmbroRow = {
      id: 0, raw_label: '', product_code: null, weight: null, kwit: '',
      issue_date: null, receive_date: null, notes: '', extra: '',
      wydanie_ambro: null, przyjecie_ec: null, ilosc_palet: null,
      updated_at: '', _tmpId: tmpId,
    };
    setRows((prev) => {
      const next = [...prev, newRow];
      rowsRef.current = next;
      return next;
    });
    setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-input-id="${tmpId}-kod"]`)?.focus();
    }, 30);
  }

  function removeRow(rKey: string) {
    const existing = saveTimers.current.get(rKey);
    if (existing) clearTimeout(existing);
    const r = rowsRef.current.find(row => rowKey(row) === rKey);
    if (!r) return;
    if (r.id) {
      const confirmed = window.confirm(`Czy na pewno chcesz usunąć wiersz "${r.raw_label ?? ''}"?\n\nTej operacji nie można cofnąć.`);
      if (!confirmed) return;
      startTransition(async () => {
        await deleteAmbro(r.id);
        setRows((prev) => { const next = prev.filter(row => rowKey(row) !== rKey); rowsRef.current = next; return next; });
      });
    } else {
      setRows((prev) => { const next = prev.filter(row => rowKey(row) !== rKey); rowsRef.current = next; return next; });
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter(r => anyFieldMatches(r, filter));
  }, [rows, filter]);

  const inputClass = "w-full min-w-0 px-2 py-1 border border-gray-300 rounded text-sm outline-none bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200";
  const numInputClass = `${inputClass} text-right font-mono`;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      {/* GÓRNY PANEL */}
      <div className="flex-shrink-0 bg-white border-b">
        <div className="flex items-center gap-3 px-2 py-2 bg-gray-50 border-b">
          <div className="relative flex-1 max-w-sm">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 Szukaj — kod (dokładny), data, kwit, uwagi..."
              className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-blue-400"
            />
            {filter && (
              <button onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>
          {filter && <span className="text-xs text-gray-500">{filteredRows.length} z {rows.length} wpisów</span>}
          <span className="text-xs text-gray-400 ml-auto">Zapis automatyczny · Sortowanie: data wydania ↑</span>
        </div>
      </div>

      {/* LISTA – jedna tabela, nagłówek przyklejony u góry przewijanego obszaru */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm" style={{ minWidth: MIN_TABLE_WIDTH, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <colgroup>
            {COLS.map((c, i) => <col key={i} style={c.width ? { width: c.width } : undefined} />)}
          </colgroup>
          <thead className="text-white sticky top-0 z-10">
            <tr>
              {COLS.map((c, i) => (
                <th key={i} className={`p-2 font-semibold leading-tight bg-gray-900 ${c.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const rKey = rowKey(r);
              const parsed = parseProductCode(r.raw_label ?? '');
              const wydanie = Number(r.wydanie_ambro ?? 0);
              const przyjecie = Number(r.przyjecie_ec ?? 0);
              const stan = wydanie - przyjecie;
              const wydano = stan === 0 && wydanie > 0;

              return (
                <tr key={rKey} className="group transition-colors hover:bg-blue-100 [&>td]:border-t [&>td]:border-gray-200 hover:[&>td:first-child]:shadow-[inset_4px_0_0_#3b82f6]">
                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-kod`}
                      value={r.raw_label ?? ''}
                      onChange={(e) => update(rKey, { raw_label: e.target.value })}
                      className={inputClass} placeholder="np. K, GR" />
                    {parsed.code && (
                      <span className={`text-[10px] font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                        {parsed.code}
                      </span>
                    )}
                  </td>

                  <td className="p-1 align-top text-center pt-2">
                    {wydano ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                        WYDANO
                      </span>
                    ) : wydanie > 0 ? (
                      <span className="font-mono font-semibold text-sm" style={{ color: stan > 0 ? '#b45309' : '#6b7280' }}>
                        {stan.toLocaleString('pl-PL')} kg
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-wydanie_ambro`}
                      type="number" step="any" value={r.wydanie_ambro ?? ''}
                      onChange={(e) => update(rKey, { wydanie_ambro: e.target.value ? Number(e.target.value) : null })}
                      className={numInputClass} style={{ color: '#b45309' }} placeholder="0" />
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-przyjecie_ec`}
                      type="number" step="any" value={r.przyjecie_ec ?? ''}
                      onChange={(e) => update(rKey, { przyjecie_ec: e.target.value ? Number(e.target.value) : null })}
                      className={numInputClass} style={{ color: '#166534' }} placeholder="0" />
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-ilosc_palet`}
                      type="number" step="any" value={r.ilosc_palet ?? ''}
                      onChange={(e) => update(rKey, { ilosc_palet: e.target.value ? Number(e.target.value) : null })}
                      className={numInputClass} style={{ color: '#374151' }} placeholder="0" />
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-kwit`}
                      value={r.kwit ?? ''}
                      onChange={(e) => update(rKey, { kwit: e.target.value })}
                      className={inputClass} placeholder="nr kwitu" />
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-wydanie_data`}
                      type="date" value={r.issue_date ?? ''}
                      onChange={(e) => update(rKey, { issue_date: e.target.value })}
                      className={inputClass} />
                  </td>

                  <td className="p-1 align-top">
                    <input data-input-id={`${rKey}-przyjecie_data`}
                      type="date" value={r.receive_date ?? ''}
                      onChange={(e) => update(rKey, { receive_date: e.target.value })}
                      className={inputClass} />
                  </td>

                  <td className="p-1 align-top">
                    <AutoGrowTextarea inputId={`${rKey}-notes`}
                      value={r.notes ?? ''}
                      onChange={(v) => update(rKey, { notes: v })}
                      className={inputClass} placeholder="uwagi" />
                  </td>

                  <td className="p-1 align-top text-center pt-2">
                    <button onClick={() => removeRow(rKey)} disabled={pending}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded px-1 transition-all">✖</button>
                  </td>
                </tr>
              );
            })}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-400 text-sm">
                  {filter ? `Brak wyników dla "${filter}"` : 'Brak wpisów'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* STOPKA */}
      <div className="flex-shrink-0 p-2 border-t bg-gray-50">
        <button onClick={addRow}
          className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm transition-all">
          + Dodaj wpis
        </button>
      </div>
    </div>
  );
}
