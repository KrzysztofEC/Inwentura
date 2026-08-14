import { createClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { WAREHOUSES } from '@/lib/warehouses';
import { WarehouseGrid } from '@/components/WarehouseGrid';
import { ContainerEditor } from '@/components/ContainerEditor';
import { AmbroEditor } from '@/components/AmbroEditor';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Cell, Container, AmbroEntry } from '@/types/db';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return Math.round(n).toLocaleString('pl-PL').replace(/,/g, ' ');
}

export default async function WarehousePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = WAREHOUSES[key];
  if (!cfg) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: totalsData } = await supabase
    .from('totals_per_warehouse')
    .select('product_code, total')
    .eq('warehouse', key);
  const totals: Record<string, number> = {};
  for (const t of (totalsData ?? []) as any[]) {
    totals[t.product_code] = (totals[t.product_code] ?? 0) + Number(t.total);
  }

  if (cfg.type === 'ambro') {
    const { data: entries } = await supabase
      .from('ambro')
      .select('*')
      .order('issue_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });
    return (
      <>
        <Topbar user={user} />
        <main className="p-4">
          <Header cfg={cfg} totals={totals} warehouseKey={key} />
          <p className="text-xs text-gray-500 mb-3">
            Wpisy z ujemną wagą oznaczają wydanie/zabranie z Ambro.
          </p>
          <AmbroEditor initial={(entries ?? []) as AmbroEntry[]} />
        </main>
      </>
    );
  }

  if (cfg.type === 'kontenery') {
    const { data } = await supabase
      .from('containers')
      .select('*')
      .eq('warehouse', 'blaszak1')
      .order('container_no')
      .order('line_no');
    const containers: Container[][] = [];
    for (let n = 1; n <= 6; n++) {
      containers.push(((data ?? []) as Container[]).filter((c) => c.container_no === n));
    }
    return (
      <>
        <Topbar user={user} />
        <main className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h1 className="text-2xl font-semibold">Kontenery</h1>
           <Link href="/print/kontenery" target="_blank"
  className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm no-print">
  🖨 Drukuj wypełnioną
</Link>
<Link href="/print/kontenery?empty=1" target="_blank"
  className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm no-print">
  📄 Drukuj pustą
</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {containers.map((lines, i) => (
              <ContainerEditor key={i + 1} warehouse="blaszak1" containerNo={i + 1} initialLines={lines} />
            ))}
          </div>
        </main>
      </>
    );
  }

  const { data: cells } = await supabase
    .from('cells')
    .select('*')
    .eq('warehouse', key)
    .order('row');

  return (
    <>
      <Topbar user={user} />
      <main className="p-4">
        <Header cfg={cfg} totals={totals} warehouseKey={key} />
        <WarehouseGrid cfg={cfg} cells={(cells ?? []) as Cell[]} />
      </main>
    </>
  );
}

function Header({ cfg, totals, warehouseKey }: { cfg: any; totals: Record<string, number>; warehouseKey: string }) {
  const items = Object.entries(totals).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-semibold">{cfg.name}</h1>
        <div className="flex gap-2 no-print">
          <Link href={`/print/${warehouseKey}`} target="_blank"
            className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm font-medium">
            🖨 Drukuj wypełnioną
          </Link>
          <Link href={`/print/${warehouseKey}?empty=1`} target="_blank"
            className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm font-medium">
            📄 Drukuj pustą
          </Link>
        </div>
      </div>
      <div className="bg-white rounded p-2 mb-3 flex flex-wrap gap-1 items-center text-sm">
        <strong className="mr-1">Suma:</strong>
        {items.length === 0
          ? <em className="text-gray-400">brak</em>
          : items.map(([code, w]) => (
            <span key={code} className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full text-xs">
              {code} <b>{fmt(w)} kg</b>
            </span>
          ))}
      </div>
    </>
  );
}
