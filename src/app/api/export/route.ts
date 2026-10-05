import { createClient } from '@/lib/supabase/server';
import { buildInventoryWorkbook, type ExportCell, type ExportTotal } from '@/lib/exportWorkbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  // Wszystkie komórki map (stronicowanie, bo Supabase domyślnie zwraca max 1000 wierszy)
  const cells: ExportCell[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cells')
      .select('warehouse, col, row, raw_label, starch, weight_top, weight_bot, product_code, product_code_bot')
      .range(from, from + 999);
    if (error) return new Response('Błąd pobierania komórek: ' + error.message, { status: 500 });
    cells.push(...((data ?? []) as ExportCell[]));
    if (!data || data.length < 1000) break;
  }

  // Sumy dla Kontenerów i Ambro (te magazyny nie mają siatki)
  const { data: totalsData } = await supabase.from('totals_per_warehouse').select('*');
  const totals = (totalsData ?? []) as ExportTotal[];

  const { data: productsData } = await supabase.from('products').select('code, name');
  const names: Record<string, string> = {};
  for (const p of (productsData ?? []) as { code: string; name: string }[]) names[p.code] = p.name;

  const now = new Date();
  const dateStr = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' });
  const fileDate = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });

  const wb = await buildInventoryWorkbook(cells, totals, names, dateStr);
  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inwentura_${fileDate}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
