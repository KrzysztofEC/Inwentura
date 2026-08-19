'use client';

import { useRef, useState, useTransition } from 'react';
import { saveAmbro, deleteAmbro } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { AmbroEntry } from '@/types/db';

export function AmbroEditor({ initial }: { initial: AmbroEntry[] }) {
  const [rows, setRows] = useState<AmbroEntry[]>(initial);
  const rowsRef = useRef<AmbroEntry[]>(initial);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<AmbroEntry>) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      rowsRef.current = next;
      return next;
    });
  }

  function persist(idx: number) {
    const r = rowsRef.current[idx];
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
          const next = prev.map((row, i) => i === idx ? { ...row, id: res.id!, product_code: res.product_code ?? null } : row);
          rowsRef.current = next;
          return next;
        });
      }
    });
  }

  function addRow() {
    const newRow: AmbroEntry = {
      id: 0, raw_label: '', product_code: null, weight: null, kwit: '',
      issue_date: null, receive_date: null, notes: '', extra: '',
      wydanie_ambro: null, przyjecie_ec: null, ilosc_palet: null, updated_at: '',
    };
    setRows((prev) => { const next = [...prev, newRow]; rowsRef.current = next; return next; });
  }

  function removeRow(idx: number) {
    const r = rowsRef.current[idx];
    if (r.id) {
      if (!confirm('Usunąć ten wpis?')) return;
      startTransition(async () => {
        await deleteAmbro(r.id);
        setRows((prev) => { const next = prev.filter((_, i) => i !== idx); rowsRef.current = next; return next; });
      });
    } else {
      setRows((prev) => { const next = prev.filter((_, i) => i !== idx); rowsRef.current = next; return next; });
    }
  }

  const inputClass = "w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";
  const numInputClass = `${inputClass} text-right font-mono`;

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
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
        <tbody>
          {rows.map((r, idx) => {
            const parsed = parseProductCode(r.raw_label ?? '');
            const wydanie = Number(r.wydanie_ambro ?? 0);
            const przyjecie = Number(r.przyjecie_ec ?? 0);
            const stan = wydanie - przyjecie;
            const wydano = stan === 0 && wydanie > 0;

            return (
              <tr key={idx} className="border-t hover:bg-gray-50">
                {/* KOD */}
                <td className="p-1">
                  <input
                    value={r.raw_label ?? ''}
                    onChange={(e) => update(idx, { raw_label: e.target.value })}
                    onBlur={() => persist(idx)}
                    className={inputClass}
                    placeholder="np. K, GR"
                  />
                  {parsed.code && (
                    <span className={`text-[10px] font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                      {parsed.code}
                    </span>
                  )}
                </td>

                {/* WAGA STAN */}
                <td className="p-1 text-center">
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

                {/* WYDANIE DO AMBRO */}
                <td className="p-1">
                  <input
                    type="number" step="any"
                    value={r.wydanie_ambro ?? ''}
                    onChange={(e) => update(idx, { wydanie_ambro: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className={numInputClass}
                    style={{ color: '#b45309' }}
                    placeholder="0"
                  />
                </td>

                {/* PRZYJĘCIE DO EC */}
                <td className="p-1">
                  <input
                    type="number" step="any"
                    value={r.przyjecie_ec ?? ''}
                    onChange={(e) => update(idx, { przyjecie_ec: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className={numInputClass}
                    style={{ color: '#166534' }}
                    placeholder="0"
                  />
                </td>

                {/* ILOŚĆ PALET */}
                <td className="p-1">
                  <input
                    type="number" step="any"
                    value={r.ilosc_palet ?? ''}
                    onChange={(e) => update(idx, { ilosc_palet: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className={numInputClass}
                    style={{ color: '#374151' }}
                    placeholder="0"
                  />
                </td>

                {/* NR KW */}
                <td className="p-1">
                  <input
                    value={r.kwit ?? ''}
                    onChange={(e) => update(idx, { kwit: e.target.value })}
                    onBlur={() => persist(idx)}
                    className={inputClass}
                    placeholder="nr kwitu"
                  />
                </td>

                {/* WYDANIE (data) */}
                <td className="p-1">
                  <input
                    type="date"
                    value={r.issue_date ?? ''}
                    onChange={(e) => update(idx, { issue_date: e.target.value })}
                    onBlur={() => persist(idx)}
                    className={inputClass}
                  />
                </td>

                {/* PRZYJĘCIE EC (data) */}
                <td className="p-1">
                  <input
                    type="date"
                    value={r.receive_date ?? ''}
                    onChange={(e) => update(idx, { receive_date: e.target.value })}
                    onBlur={() => persist(idx)}
                    className={inputClass}
                  />
                </td>

                {/* UWAGI */}
                <td className="p-1">
                  <input
                    value={r.notes ?? ''}
                    onChange={(e) => update(idx, { notes: e.target.value })}
                    onBlur={() => persist(idx)}
                    className={inputClass}
                    placeholder="uwagi"
                  />
                </td>

                {/* USUŃ */}
                <td className="p-1 text-center">
                  <button onClick={() => removeRow(idx)} disabled={pending}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded px-1 transition-all">
                    ✖
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-2 border-t bg-gray-50">
        <button onClick={addRow}
          className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm transition-all">
          + Dodaj wpis
        </button>
      </div>
    </div>
  );
}
