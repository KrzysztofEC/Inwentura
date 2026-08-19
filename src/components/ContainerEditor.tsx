'use client';

import { useRef, useState, useTransition } from 'react';
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
  const hasExtra = initialLines.length > FIXED_ROWS;

  const padded = Array.from({ length: hasExtra ? FIXED_ROWS + 1 : FIXED_ROWS }, (_, i) =>
    initialLines[i] || {
      id: 0, warehouse, container_no: containerNo, line_no: i + 1,
      raw_label: '', product_code: null, pallets: '', weight: null, description: '', updated_at: '',
    }
  );

  const [lines, setLines] = useState<Container[]>(padded);
  const linesRef = useRef<Container[]>(padded);
  const [showExtra, setShowExtra] = useState(hasExtra);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<Container>) {
    setLines((prev) => {
      const next = prev.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      linesRef.current = next;
      return next;
    });
  }

  function persist(idx: number) {
    const line = linesRef.current[idx];
    if (!line.raw_label && !line.weight && !line.description && !line.pallets) {
      // Jeśli wiersz ma id — usuń go z bazy
      if (line.id) {
        startTransition(async () => {
          await deleteContainer(line.id, warehouse);
          setLines((prev) => {
            const next = prev.map((l, i) => i === idx ? {
              ...l, id: 0, raw_label: '', product_code: null,
              pallets: '', weight: null, description: '',
            } : l);
            linesRef.current = next;
            return next;
          });
        });
      }
      return;
    }
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
        setLines((prev) => {
          const next = prev.map((l, i) => i === idx ? { ...l, id: r.id!, product_code: r.product_code ?? null } : l);
          linesRef.current = next;
          return next;
        });
      }
    });
  }

  function addExtraRow() {
    const extra = initialLines[FIXED_ROWS] || {
      id: 0, warehouse, container_no: containerNo, line_no: FIXED_ROWS + 1,
      raw_label: '', product_code: null, pallets: '', weight: null, description: '', updated_at: '',
    };
    setLines((prev) => {
      const next = [...prev.slice(0, FIXED_ROWS), extra];
      linesRef.current = next;
      return next;
    });
    setShowExtra(true);
  }

  const visibleLines = showExtra ? lines : lines.slice(0, FIXED_ROWS);
  const rowBg = (idx: number) => idx % 2 === 0 ? '#f8fafc' : '#f1f5f9';

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
        <span className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Kontener {containerNo}</span>
        {!showExtra && (
          <button onClick={addExtraRow}
            className="text-xs px-2 py-0.5 rounded transition-all"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
            + wiersz awaryjny
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
            <th className="text-left px-3 py-2 font-semibold text-xs" style={{ color: '#475569' }}>Produkt</th>
            <th className="text-left px-3 py-2 font-semibold text-xs w-24" style={{ color: '#475569' }}>Palety</th>
            <th className="text-left px-3 py-2 font-semibold text-xs w-28" style={{ color: '#475569' }}>Waga (kg)</th>
            <th className="text-left px-3 py-2 font-semibold text-xs" style={{ color: '#475569' }}>Opis / Klient</th>
          </tr>
        </thead>
        <tbody>
          {visibleLines.map((line, idx) => {
            const parsed = parseProductCode(line.raw_label ?? '');
            const isExtra = idx === FIXED_ROWS;
            return (
              <tr key={idx} style={{ background: isExtra ? '#fffbeb' : rowBg(idx), borderBottom: '1px solid #e2e8f0' }}>
                <td className="px-2 py-1">
                  <input
                    value={line.raw_label ?? ''}
                    onChange={(e) => update(idx, { raw_label: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 rounded outline-none text-sm"
                    style={{
                      background: isExtra ? '#fef9c3' : 'white',
                      border: `1px solid ${isExtra ? '#fcd34d' : '#cbd5e1'}`,
                      color: '#1e293b',
                    }}
                    placeholder="np. K, GR, Granulat BIO"
                  />
                  {parsed.code && (
                    <span className="text-[10px] font-mono" style={{ color: parsed.isUnknown ? '#ef4444' : '#6366f1' }}>
                      {parsed.code}{parsed.kwit ? ` · kwit ${parsed.kwit}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <input
                    value={line.pallets ?? ''}
                    onChange={(e) => update(idx, { pallets: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 rounded outline-none text-sm"
                    style={{ background: isExtra ? '#fef9c3' : 'white', border: `1px solid ${isExtra ? '#fcd34d' : '#cbd5e1'}`, color: '#1e293b' }}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number" step="any"
                    value={line.weight ?? ''}
                    onChange={(e) => update(idx, { weight: e.target.value ? Number(e.target.value) : null })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 rounded outline-none text-sm text-right font-mono"
                    style={{ background: isExtra ? '#fef9c3' : 'white', border: `1px solid ${isExtra ? '#fcd34d' : '#cbd5e1'}`, color: '#0369a1' }}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={line.description ?? ''}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    onBlur={() => persist(idx)}
                    className="w-full px-2 py-1 rounded outline-none text-sm"
                    style={{ background: isExtra ? '#fef9c3' : 'white', border: `1px solid ${isExtra ? '#fcd34d' : '#cbd5e1'}`, color: '#047857' }}
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
