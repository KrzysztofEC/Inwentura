'use client';

import { useState, useTransition } from 'react';
import { saveContainer, deleteContainer } from '@/app/actions';
import { parseProductCode } from '@/lib/products';
import type { Container } from '@/types/db';

const FIXED_ROWS = 4;

export function ContainerEditor({
  warehouse,
  containerNo,
  initialLines,
}: {
  warehouse: string;
  containerNo: number;
  initialLines: Container[];
}) {
  // Zawsze 4 wiersze — uzupełnij pustymi jeśli mniej
  const padded = Array.from({ length: FIXED_ROWS }, (_, i) => initialLines[i] || {
    id: 0, warehouse, container_no: containerNo, line_no: i + 1,
    raw_label: '', product_code: null, pallets: '', weight: null, description: '', updated_at: '',
  });

  const [lines, setLines] = useState<Container[]>(padded);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<Container>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function persist(idx: number) {
    const line = lines[idx];
    // Nie zapisuj pustych wierszy
    if (!line.raw_label && !line.weight && !line.description && !line.pallets) return;
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

  return (
    <div className="rounded-lg p-4" style={{ background: '#1c2333', border: '1px solid #3d4a63' }}>
      <h3 className="font-semibold mb-3 text-base" style={{ color: '#e2e8f0' }}>
        Kontener {containerNo}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#232b3e', borderBottom: '2px solid #3d4a63' }}>
            <th className="text-left px-2 py-2 font-semibold" style={{ color: '#94a3b8' }}>Produkt</th>
            <th className="text-left px-2 py-2 font-semibold w-28" style={{ color: '#94a3b8' }}>Palety</th>
            <th className="text-left px-2 py-2 font-semibold w-28" style={{ color: '#94a3b8' }}>Waga (kg)</th>
            <th className="text-left px-2 py-2 font-semibold" style={{ color: '#94a3b8' }}>Opis / Klient</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const parsed = parseProductCode(line.raw_label ?? '');
            return (
              <tr key={idx} style={{ borderBottom: '1px solid #2d3748' }}>
                <td className="p-1">
                  <input
                    value={line.raw_label ?? ''}
                    onChange={(e) => update(idx, { raw_label: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1.5 rounded outline-none"
                    style={{ background: '#0f1117', border: '1px solid #3d4a63', color: '#e2e8f0' }}
                    placeholder="np. K, GR, Granulat BIO"
                  />
                  {parsed.code && (
                    <span className="text-[10px] font-mono" style={{ color: parsed.isUnknown ? '#f87171' : '#818cf8' }}>
                      {parsed.code}{parsed.kwit ? ` · kwit ${parsed.kwit}` : ''}
                    </span>
                  )}
                </td>
                <td className="p-1">
                  <input
                    value={line.pallets ?? ''}
                    onChange={(e) => update(idx, { pallets: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1.5 rounded outline-none"
                    style={{ background: '#0f1117', border: '1px solid #3d4a63', color: '#e2e8f0' }}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number" step="any"
                    value={line.weight ?? ''}
                    onChange={(e) => update(idx, { weight: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1.5 rounded outline-none text-right font-mono"
                    style={{ background: '#0f1117', border: '1px solid #3d4a63', color: '#38bdf8' }}
                  />
                </td>
                <td className="p-1">
                  <input
                    value={line.description ?? ''}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1.5 rounded outline-none"
                    style={{ background: '#0f1117', border: '1px solid #3d4a63', color: '#34d399' }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
