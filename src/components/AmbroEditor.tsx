'use client';

import { useState, useTransition } from 'react';
import { saveAmbro, deleteAmbro } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { AmbroEntry } from '@/types/db';

export function AmbroEditor({ initial }: { initial: AmbroEntry[] }) {
  const [rows, setRows] = useState<AmbroEntry[]>(initial);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<AmbroEntry>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function persist(idx: number) {
    const r = rows[idx];
    startTransition(async () => {
      const res = await saveAmbro({
        id: r.id || undefined,
        raw_label: r.raw_label ?? '',
        weight: r.weight ?? '',
        kwit: r.kwit ?? '',
        issue_date: r.issue_date ?? '',
        receive_date: r.receive_date ?? '',
        notes: r.notes ?? '',
        extra: r.extra ?? '',
      });
      if (res.ok) update(idx, { id: res.id!, product_code: res.product_code ?? null });
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: 0, raw_label: '', product_code: null, weight: null, kwit: '',
        issue_date: null, receive_date: null, notes: '', extra: '', updated_at: '' },
    ]);
  }

  function removeRow(idx: number) {
    const r = rows[idx];
    if (r.id) {
      if (!confirm('Usunąć ten wpis?')) return;
      startTransition(async () => {
        await deleteAmbro(r.id);
        setRows((prev) => prev.filter((_, i) => i !== idx));
      });
    } else {
      setRows((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  return (
    <div className="bg-white rounded shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-white">
          <tr>
            <th className="text-left p-2">Kod</th>
            <th className="text-left p-2 w-28">Waga</th>
            <th className="text-left p-2 w-28">Nr KW</th>
            <th className="text-left p-2 w-36">Wydanie</th>
            <th className="text-left p-2 w-36">Przyjęcie EC</th>
            <th className="text-left p-2">Uwagi</th>
            <th className="text-left p-2">Dodatkowe</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const parsed = parseProductCode(r.raw_label ?? '');
            return (
              <tr key={idx} className="border-t">
                <td className="p-1">
                  <input value={r.raw_label ?? ''} onChange={(e) => update(idx, { raw_label: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                  {parsed.code && (
                    <span className={`text-[10px] font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                      {parsed.code}
                    </span>
                  )}
                </td>
                <td className="p-1">
                  <input type="number" step="any" value={r.weight ?? ''}
                    onChange={(e) => update(idx, { weight: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1">
                  <input value={r.kwit ?? ''} onChange={(e) => update(idx, { kwit: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1">
                  <input type="date" value={r.issue_date ?? ''}
                    onChange={(e) => update(idx, { issue_date: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1">
                  <input type="date" value={r.receive_date ?? ''}
                    onChange={(e) => update(idx, { receive_date: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1">
                  <input value={r.notes ?? ''} onChange={(e) => update(idx, { notes: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1">
                  <input value={r.extra ?? ''} onChange={(e) => update(idx, { extra: e.target.value })}
                    onBlur={() => persist(idx)} className="w-full px-2 py-1 border rounded" />
                </td>
                <td className="p-1 text-center">
                  <button onClick={() => removeRow(idx)} disabled={pending}
                    className="text-red-600 hover:bg-red-50 rounded px-1">✖</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-2">
        <button onClick={addRow} className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm">
          + Dodaj wpis
        </button>
      </div>
    </div>
  );
}
