'use client';

import { useRef, useState, useTransition, useMemo } from 'react';
import { saveAmbro, deleteAmbro } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { AmbroEntry } from '@/types/db';

function sortByDate(arr: AmbroEntry[]): AmbroEntry[] {
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

function anyFieldMatches(r: AmbroEntry, filter: string): boolean {
  if (!filter.trim()) return true;
  const f = filter.trim();
  if (fieldMatches(r.raw_label, f)) return true;
  if (fieldMatches(r.product_code, f)) return true;
  const looseFields = [r.kwit, r.notes, r.issue_date, r.receive_date,
    r.wydanie_ambro?.toString(), r.przyjecie_ec?.toString(), r.ilosc_palet?.toString()];
  return looseFields.some(v => v?.toLowerCase().includes(f.toLowerCase()));
}

export function AmbroEditor({ initial }: { initial: AmbroEntry[] }) {
  const [rows, setRows] = useState<AmbroEntry[]>(sortByDate(initial));
  const rowsRef = useRef<AmbroEntry[]>(sortByDate(initial));
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState('');
  const focusedInputRef = useRef<string | null>(null);

  function update(realIdx: number, patch: Partial<AmbroEntry>) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === realIdx ? { ...r, ...patch } : r));
      rowsRef.current = next;
      return next;
    });
  }

  function persist(realIdx: number) {
    const r = rowsRef.current[realIdx];
    // Zapamiętaj aktywny element przed zapisem
    const activeEl = document.activeElement as HTMLInputElement | null;
    const activeId = activeEl?.dataset?.inputId ?? null;
    focusedInputRef.current = activeId;

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
          const updated = prev.map((row, i) =>
            i === realIdx ? { ...row, id: res.id!, product_code: res.product_code ?? null } : row
          );
          const resorted = sortByDate(updated);
          rowsRef.current = resorted;
          return resorted;
        });
        // Przywróć fokus po re-renderze
        if (focusedInputRef.current) {
          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>(`[data-input-id="${focusedInputRef.current}"]`);
            if (el) el.focus();
          }, 50);
        }
      }
    });
  }

  function addRow() {
    const newRow: AmbroEntry = {
      id: 0, raw_label: '', product_code: null, weight: null, kwit: '',
      issue_date: null, receive_date: null, notes: '', extra: '',
      wydanie_ambro: null, przyjecie_ec: null, ilosc_palet: null, updated_at: '',
    };
    setRows((prev) => {
      const next = [...prev, newRow];
      rowsRef.current = next;
      return next;
    });
  }

  function removeRow(realIdx: number) {
    const r = rowsRef.current[realIdx];
    if (r.id) {
      if (!confirm('Usunąć ten wpis?')) return;
      startTransition(async () => {
        await deleteAmbro(r.id);
        setRows((prev) => {
          const next = prev.filter((_, i) => i !== realIdx);
          rowsRef.current = next;
          return next;
        });
      });
    } else {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== realIdx);
        rowsRef.current = next;
        return next;
      });
    }
  }

  const filteredRows = useMemo(() => {
    return rows
      .map((r, realIdx) => ({ r, realIdx }))
      .filter(({ r }) => anyFieldMatches(r, filter));
  }, [rows, filter]);

  const inputClass = "w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";
  const numInputClass = `${inputClass} text-right font-mono`;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      {/* GÓRNY PANEL — przyklejony */}
      <div className="flex-shrink-0 bg-white border-b">
        {/* Pasek filtra */}
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                ✕
              </button>
            )}
          </div>
          {filter && (
            <span className="text-xs text-gray-500">{filteredRows.length} z {rows.length} wpisów</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">Sortowanie: data wydania ↑</span>
        </div>

        {/* Nagłówek tabeli — przyklejony */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1050px' }}>
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="text-left p-2 w-32">Kod</th>
                <th className="text-center p-2 w-28">Waga Stan</th>
                <th className="text-left p-2 w-32">Wydanie do Ambro</th>
                <th className="text-left p-2 w-32">Przyjęcie do EC</th>
                <th className="text-left p-2 w-24">Ilość Palet</th>
                <th className="text-left p-2 w-28">Nr KW</th>
                <th className="text-left p-2 w-28">Wydanie</th>
                <th className="text-left p-2 w-28">Przyjęcie EC</th>
                <th className="text-left p-2">Uwagi</th>
                <th className="w-8"></th>
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* SCROLLOWALNA LISTA */}
      <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
        <table className="w-full text-sm" style={{ minWidth: '1050px' }}>
          <tbody>
            {filteredRows.map(({ r, realIdx }) => {
              const parsed = parseProductCode(r.raw_label ?? '');
              const wydanie = Number(r.wydanie_ambro ?? 0);
              const przyjecie = Number(r.przyjecie_ec ?? 0);
              const stan = wydanie - przyjecie;
              const wydano = stan === 0 && wydanie > 0;
              const rowKey = r.id ? `id-${r.id}` : `new-${realIdx}`;

              return (
                <tr key={rowKey} className="border-t hover:bg-gray-50">
                  <td className="p-1 w-32">
                    <input
                      data-input-id={`${rowKey}-kod`}
                      value={r.raw_label ?? ''}
                      onChange={(e) => update(realIdx, { raw_label: e.target.value })}
                      onBlur={() => persist(realIdx)}
                      className={inputClass} placeholder="np. K, GR" />
                    {parsed.code && (
                      <span className={`text-[10px] font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                        {parsed.code}
                      </span>
                    )}
                  </td>

                  <td className="p-1 w-28 text-center">
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

                  <td className="p-1 w-32">
                    <input
                      data-input-id={`${rowKey}-wydanie_ambro`}
                      type="number" step="any"
                      value={r.wydanie_ambro ?? ''}
                      onChange={(e) => update(realIdx, { wydanie_ambro: e.target.value ? Number(e.target.value) : null })}
                      onBlur={() => persist(realIdx)}
                      className={numInputClass} style={{ color: '#b45309' }} placeholder="0" />
                  </td>

                  <td className="p-1 w-32">
                    <input
                      data-input-id={`${rowKey}-przyjecie_ec`}
                      type="number" step="any"
                      value={r.przyjecie_ec ?? ''}
                      onChange={(e) => update(realIdx, { przyjecie_ec: e.target.value ? Number(e.target.value) : null })}
                      onBlur={() => persist(realIdx)}
                      className={numInputClass} style={{ color: '#166534' }} placeholder="0" />
                  </td>

                  <td className="p-1 w-24">
                    <input
                      data-input-id={`${rowKey}-ilosc_palet`}
                      type="number" step="any"
                      value={r.ilosc_palet ?? ''}
                      onChange={(e) => update(realIdx, { ilosc_palet: e.target.value ? Number(e.target.value) : null })}
                      onBlur={() => persist(realIdx)}
                      className={numInputClass} style={{ color: '#374151' }} placeholder="0" />
                  </td>

                  <td className="p-1 w-28">
                    <input
                      data-input-id={`${rowKey}-kwit`}
                      value={r.kwit ?? ''}
                      onChange={(e) => update(realIdx, { kwit: e.target.value })}
                      onBlur={() => persist(realIdx)}
                      className={inputClass} placeholder="nr kwitu" />
                  </td>

                  <td className="p-1 w-28">
                    <input
                      data-input-id={`${rowKey}-wydanie_data`}
                      type="date"
                      value={r.issue_date ?? ''}
                      onChange={(e) => update(realIdx, { issue_date: e.target.value })}
                      onBlur={() => persist(realIdx)}
                      className={inputClass} />
                  </td>

                  <td className="p-1 w-28">
                    <input
                      data-input-id={`${rowKey}-przyjecie_data`}
                      type="date"
                      value={r.receive_date ?? ''}
                      onChange={(e) => update(realIdx, { receive_date: e.target.value })}
                      onBlur={() => persist(realIdx)}
                      className={inputClass} />
                  </td>

                  <td className="p-1">
                    <input
                      data-input-id={`${rowKey}-notes`}
                      value={r.notes ?? ''}
                      onChange={(e) => update(realIdx, { notes: e.target.value })}
                      onBlur={() => persist(realIdx)}
                      className={inputClass} placeholder="uwagi" />
                  </td>

                  <td className="p-1 w-8 text-center">
                    <button onClick={() => removeRow(realIdx)} disabled={pending}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded px-1 transition-all">
                      ✖
                    </button>
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
