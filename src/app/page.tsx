import { createClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { WAREHOUSES, WAREHOUSE_KEYS } from '@/lib/warehouses';
import { PRODUCTS, productName } from '@/lib/products';
import { SnapshotButton } from '@/components/SnapshotButton';

interface Row { code: string; name: string; per: Record<string, number>; total: number; }

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  if (!n) return '';
  return Math.round(n).toLocaleString('pl-PL').replace(/,/g, ' ');
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: totals } = await supabase.from('totals_per_warehouse').select('*');

  const grouped: Record<string, Row> = {};
  for (const t of (totals ?? []) as any[]) {
    const code = t.product_code as string;
    if (!grouped[code]) {
      grouped[code] = { code, name: productName(code), per: {}, total: 0 };
    }
    grouped[code].per[t.warehouse] = (grouped[code].per[t.warehouse] ?? 0) + Number(t.total ?? 0);
    grouped[code].total += Number(t.total ?? 0);
  }
  const rows = Object.values(grouped)
    .filter((r) => r.total !== 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <Topbar user={user} />
      <main className="p-4 max-w-full">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-semibold">Podsumowanie produktów</h1>
            <p className="text-sm text-gray-500">Sumy wag (kg) ze wszystkich magazynów. Aktualizuje się automatycznie.</p>
          </div>
          <div className="flex gap-2">
            <SnapshotButton />
            <a href="/api/export" className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm">⬇ CSV</a>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white rounded p-8 text-center text-gray-500 border">
            <p>Brak danych. Wejdź do magazynu i zacznij wprowadzać produkty.</p>
          </div>
        ) : (
          <div className="bg-white rounded shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Kod</th>
                  <th className="text-left px-3 py-2">Nazwa</th>
                  {WAREHOUSE_KEYS.map((k) => (
                    <th key={k} className="text-right px-3 py-2">{WAREHOUSES[k].name.replace('Magazyn ', '').replace(' (zewnętrzny)', '')}</th>
                  ))}
                  <th className="text-right px-3 py-2 bg-yellow-100">SUMA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-medium">{r.code}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    {WAREHOUSE_KEYS.map((k) => (
                      <td key={k} className={`px-3 py-2 text-right tabular-nums ${(r.per[k] ?? 0) === 0 ? 'text-gray-300' : ''}`}>
                        {fmt(r.per[k] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums bg-yellow-50">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
