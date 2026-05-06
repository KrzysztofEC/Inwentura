import { createClient } from '@/lib/supabase/server';
import { WAREHOUSES, WAREHOUSE_KEYS } from '@/lib/warehouses';
import { productName } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: totals } = await supabase.from('totals_per_warehouse').select('*');

  const grouped: Record<string, Record<string, number>> = {};
  for (const t of (totals ?? []) as any[]) {
    const code = t.product_code as string;
    if (!grouped[code]) grouped[code] = {};
    grouped[code][t.warehouse] = Number(t.total ?? 0);
  }

  const lines: string[] = [];
  lines.push(['Kod', 'Nazwa', ...WAREHOUSE_KEYS.map((k) => WAREHOUSES[k].name), 'SUMA'].join(';'));
  const codes = Object.keys(grouped).sort();
  for (const code of codes) {
    const row = [code, productName(code)];
    let sum = 0;
    for (const k of WAREHOUSE_KEYS) {
      const v = grouped[code][k] ?? 0;
      row.push(String(Math.round(v)));
      sum += v;
    }
    row.push(String(Math.round(sum)));
    if (sum !== 0) lines.push(row.join(';'));
  }
  const body = '\uFEFF' + lines.join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stany_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
