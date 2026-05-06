'use client';

import { useEffect, useState, useTransition } from 'react';
import { saveCell, clearCell } from '@/app/actions';
import { parseProductCode, productName } from '@/lib/products';
import type { Cell } from '@/types/db';

interface Props {
  warehouse: string;
  col: string;
  row: number;
  slot: 'gora' | 'dol';
  cell: Cell | null;
  onClose: () => void;
}

export function CellModal({ warehouse, col, row, slot, cell, onClose }: Props) {
  const [raw, setRaw] = useState(cell?.raw_label ?? '');
  const [starch, setStarch] = useState(cell?.starch ?? '');
  const [weight, setWeight] = useState<string>(cell?.weight?.toString() ?? '');
  const [note, setNote] = useState(cell?.note ?? '');
  const [pending, startTransition] = useTransition();

  const parsed = parseProductCode(raw);
  let resolvedText = '';
  if (raw) {
    if (parsed.code === 'UNKNOWN') resolvedText = '⚠ nierozpoznany kod';
    else if (parsed.code) {
      resolvedText = `→ ${parsed.code} (${productName(parsed.code)})`;
      if (parsed.kwit) resolvedText += ` · kwit ${parsed.kwit}`;
    }
  }

  function save() {
    startTransition(async () => {
      await saveCell({ warehouse, col, row, slot, raw_label: raw, starch, weight, note });
      onClose();
    });
  }

  function clear() {
    if (!confirm('Wyczyścić tę komórkę?')) return;
    startTransition(async () => {
      await clearCell({ warehouse, col, row, slot });
      onClose();
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        save();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-3">
          Komórka <span className="font-mono">{col}{row}</span> / {slot.toUpperCase()}
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm">Kod produktu / numer kwitu / alias</span>
            <input
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="np. K, KBIO, GBB / KBIO, 1580, Granulat BIO"
              className="w-full px-3 py-2 border rounded mt-1"
            />
            {resolvedText && (
              <small className={`block mt-1 font-mono ${parsed.isUnknown ? 'text-red-600' : 'text-indigo-600'}`}>
                {resolvedText}
              </small>
            )}
          </label>
          <label className="block">
            <span className="text-sm">Skrobia (info)</span>
            <input value={starch} onChange={(e) => setStarch(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" />
          </label>
          <label className="block">
            <span className="text-sm">Waga (kg)</span>
            <input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2 border rounded mt-1" />
          </label>
          <label className="block">
            <span className="text-sm">Notatka</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={clear} disabled={pending} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">🗑 Wyczyść</button>
          <button onClick={onClose} disabled={pending} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">Anuluj</button>
          <button onClick={save} disabled={pending} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50">
            {pending ? '...' : '💾 Zapisz'}
          </button>
        </div>
      </div>
    </div>
  );
}
