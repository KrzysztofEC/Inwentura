'use client';

import { useState } from 'react';
import { CellModal } from './CellModal';
import type { Cell } from '@/types/db';
import type { WarehouseConfig } from '@/lib/warehouses';

export function WarehouseGrid({ cfg, cells }: { cfg: WarehouseConfig; cells: Cell[] }) {
  const [editing, setEditing] = useState<{ col: string; row: number; slot: 'gora' | 'dol' } | null>(null);

  const cellMap = new Map<string, Cell>();
  for (const c of cells) cellMap.set(`${c.col}|${c.row}|${c.slot}`, c);

  const editingCell = editing ? cellMap.get(`${editing.col}|${editing.row}|${editing.slot}`) ?? null : null;

  return (
    <>
      <div className="bg-white rounded shadow-sm overflow-x-auto">
        <table className="border-collapse w-full text-xs">
          <thead>
            <tr>
              <th className="bg-gray-900 text-white w-8"></th>
              {cfg.cols!.map((col) => (
                <th key={col} colSpan={2} className="bg-gray-900 text-white border border-gray-700 px-1 py-1">{col}</th>
              ))}
            </tr>
            <tr>
              <th className="bg-gray-900"></th>
              {cfg.cols!.map((col) => (
                <>
                  <th key={`${col}-g`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">góra</th>
                  <th key={`${col}-d`} className="bg-gray-700 text-gray-200 font-normal text-[10px] py-0.5 border border-gray-600">dół</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cfg.rows! }, (_, i) => i + 1).map((r) => (
              <tr key={r}>
                <th className="bg-gray-900 text-white w-8 text-center">{r}</th>
                {cfg.cols!.flatMap((col) =>
                  (['gora', 'dol'] as const).map((slot) => {
                    const cell = cellMap.get(`${col}|${r}|${slot}`);
                    const filled = !!cell?.product_code;
                    const unknown = cell?.product_code === 'UNKNOWN';
                    return (
                      <td
                        key={`${col}-${r}-${slot}`}
                        onClick={() => setEditing({ col, row: r, slot })}
                        className={`border cursor-pointer p-1 align-top w-[70px] h-[60px] hover:bg-yellow-50 ${
                          unknown ? 'bg-red-100' : filled ? 'bg-green-50' : ''
                        }`}
                      >
                        {cell && (
                          <>
                            {cell.raw_label && <div className="font-medium text-[11px] leading-tight truncate">{cell.raw_label}</div>}
                            {cell.product_code && cell.product_code !== 'UNKNOWN' && (
                              <div className="text-indigo-700 font-mono text-[10px]">{cell.product_code}</div>
                            )}
                            {cell.weight !== null && cell.weight !== undefined && (
                              <div className="text-green-800 font-semibold text-[11px]">
                                {Math.round(Number(cell.weight)).toLocaleString('pl-PL').replace(/,/g, ' ')} kg
                              </div>
                            )}
                            {cell.note && <div className="text-amber-700 text-[10px] italic truncate">{cell.note}</div>}
                          </>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CellModal
          warehouse={cfg.key}
          col={editing.col}
          row={editing.row}
          slot={editing.slot}
          cell={editingCell}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
