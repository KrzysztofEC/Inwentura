'use client';

import { useState, useTransition } from 'react';
import { saveContainer, deleteContainer } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { Container } from '@/types/db';

export function ContainerEditor({
  warehouse,
  containerNo,
  initialLines,
}: {
  warehouse: string;
  containerNo: number;
  initialLines: Container[];
}) {
  const [lines, setLines] = useState<Container[]>(initialLines);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<Container>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function persist(idx: number) {
    const line = lines[idx];
    startTransition(async () => {
      const r = await saveContainer({
        id: line.id || undefined,
        warehouse,
        container_no: containerNo,
        line_no: line.line_no || idx + 1,
        raw_label: line.raw_label ?? '',
        pallets: line.pallets ?? '',
        weight: line.weight ?? '',
        description: line.description ?? '',
      });
      if (r.ok) {
        update(idx, { id: r.id!, product_code: r.product_code ?? null });
      }
    });
  }

  function addRow() {
    setLines((prev) => [
      ...prev,
      {
        id: 0, warehouse, container_no: containerNo, line_no: prev.length + 1,
        raw_label: '', product_code: null, pallets: '', weight: null, description: '', updated_at: '',
      },
    ]);
  }

  function removeRow(idx: number) {
    const line = lines[idx];
    if (line.id) {
      if (!confirm('Usunąć tę pozycję?')) return;
      startTransition(async () => {
        await deleteContainer(line.id, warehouse);
        setLines((prev) => prev.filter((_, i) => i !== idx));
      });
    } else {
      setLines((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  return (
    <div className="bg-white rounded shadow-sm p-4">
      <h3 className="font-semibold mb-2">Kontener {containerNo}</h3>
      <table className="w-full text-sm">
        <thead className="bg-amber-100">
          <tr>
            <th className="text-left px-2 py-1">Produkt</th>
            <th className="text-left px-2 py-1 w-32">Palety</th>
            <th className="text-left px-2 py-1 w-28">Waga (kg)</th>
            <th className="text-left px-2 py-1">Opis</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const parsed = parseProductCode(line.raw_label ?? '');
            return (
              <tr key={idx} className="border-t">
                <td className="p-1">
                  <input
                    value={line.raw_label ?? ''}
                    onChange={(e) => update(idx, { raw_label: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 border rounded"
                    placeholder="np. K, GR, Granulat BIO"
                  />
                  {parsed.code && (
                    <span className={`text-[10px] font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                      {parsed.code}{parsed.kwit ? ` · kwit ${parsed.kwit}` : ''}
                    </span>
                  )}
                </td>
                <td className="p-1">
                  <input
                    value={line.pallets ?? ''}
                    onChange={(e) => update(idx, { pallets: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 border rounded"
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number" step="any"
                    value={line.weight ?? ''}
                    onChange={(e) => update(idx, { weight: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 border rounded"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={line.description ?? ''}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 border rounded"
                  />
                </td>
                <td className="p-1 text-center">
                  <button
                    onClick={() => removeRow(idx)}
                    disabled={pending}
                    className="text-red-600 hover:bg-red-50 rounded px-1"
                  >✖</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="mt-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
      >+ dodaj wpis</button>
    </div>
  );
}
