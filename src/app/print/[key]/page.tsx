import { createClient } from '@/lib/supabase/server';
import { WAREHOUSES } from '@/lib/warehouses';
import { notFound } from 'next/navigation';
import type { Cell, Container, AmbroEntry } from '@/types/db';
import { PrintAutoLaunch } from '@/components/PrintAutoLaunch';

export const dynamic = 'force-dynamic';

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '';
  return Math.round(Number(n)).toLocaleString('pl-PL').replace(/,/g, ' ');
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ empty?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const cfg = WAREHOUSES[key];
  if (!cfg) notFound();
  const empty = sp.empty === '1';

  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toLocaleDateString('pl-PL');

  if (cfg.type === 'ambro') {
    let entries: AmbroEntry[] = [];
    if (!empty) {
      const { data } = await supabase
        .from('ambro').select('*')
        .order('issue_date', { ascending: false, nullsFirst: false });
      entries = (data ?? []) as AmbroEntry[];
    }
    return <PrintAmbro cfg={cfg} entries={entries} today={todayStr} empty={empty} />;
  }

  let cells: Cell[] = [];
  let containers: Container[][] = [];
  if (!empty) {
    const { data } = await supabase.from('cells').select('*').eq('warehouse', key);
    cells = (data ?? []) as Cell[];
    if (cfg.type === 'blaszak') {
      const { data: cdata } = await supabase
        .from('containers').select('*')
        .eq('warehouse', key)
        .order('container_no').order('line_no');
      for (let n = 1; n <= cfg.containers!; n++) {
        containers.push(((cdata ?? []) as Container[]).filter((c) => c.container_no === n));
      }
    }
  } else if (cfg.type === 'blaszak') {
    for (let n = 1; n <= cfg.containers!; n++) containers.push([]);
  }

  return <PrintGrid cfg={cfg} cells={cells} containers={containers} today={todayStr} empty={empty} />;
}

function PrintGrid({ cfg, cells, containers, today, empty }: any) {
  const map = new Map<string, Cell>();
  for (const c of cells) map.set(`${c.col}|${c.row}`, c);

  return (
    <div className="p-2 print-page">
      <PrintStyles />
      <PrintAutoLaunch />
      <div className="flex justify-between border-b-2 border-black pb-1 mb-2 items-center">
        <div className="text-xs"><b>DATA:</b> {today}</div>
        <div className="font-bold uppercase text-sm">{cfg.name} {empty && <span className="text-xs italic font-normal">(pusty szablon)</span>}</div>
        <div className="text-xs"><b>WYJŚCIE EW.</b></div>
      </div>

      <table className="print-grid">
        <thead>
          <tr>
            <th className="w-5"></th>
            {cfg.cols.map((col: string) => <th key={col} colSpan={4}>{col}</th>)}
            <th className="w-5"></th>
          </tr>
          <tr>
            <th></th>
            {cfg.cols.flatMap((col: string) => [
              <th key={`${col}-k`} className="sub">KWIT</th>,
              <th key={`${col}-s`} className="sub">SKROBIA</th>,
              <th key={`${col}-wt`} className="sub">góra</th>,
              <th key={`${col}-wb`} className="sub">dół</th>,
            ])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cfg.rows }, (_, i) => i + 1).map((r) => (
            <tr key={r}>
              <td className="rownum">{r}</td>
              {cfg.cols.flatMap((col: string) => {
                const c = map.get(`${col}|${r}`);
                return [
                  <td key={`${col}-${r}-k`} className="lbl"><b>{c?.raw_label ?? ''}</b></td>,
                  <td key={`${col}-${r}-s`} className="info">{c?.starch ?? ''}</td>,
                  <td key={`${col}-${r}-wt`} className="w"><b>{fmt(c?.weight_top)}</b></td>,
                  <td key={`${col}-${r}-wb`} className="w"><b>{fmt(c?.weight_bot)}</b></td>,
                ];
              })}
              <td className="rownum">{r}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {cfg.type === 'blaszak' && (
        <>
          <h3 className="text-xs font-bold mt-3 mb-1">Kontenery</h3>
          <table className="container-print">
            <thead>
              <tr><th>Nr</th><th>Kod</th><th>Palety</th><th>Waga</th><th>Opis</th></tr>
            </thead>
            <tbody>
              {containers.map((lines: Container[], i: number) => {
                const cnum = i + 1;
                if (lines.length === 0) {
                  return (
                    <>
                      <tr key={cnum}><td className="cnum">{cnum}</td><td className="empty-row"></td><td></td><td></td><td></td></tr>
                      <tr key={`${cnum}b`}><td></td><td className="empty-row"></td><td></td><td></td><td></td></tr>
                      <tr key={`${cnum}c`}><td></td><td className="empty-row"></td><td></td><td></td><td></td></tr>
                    </>
                  );
                }
                return lines.map((ln, idx) => (
                  <tr key={`${cnum}-${idx}`}>
                    {idx === 0 && <td rowSpan={lines.length} className="cnum">{cnum}</td>}
                    <td>{ln.raw_label ?? ''}</td>
                    <td>{ln.pallets ?? ''}</td>
                    <td className="text-right">{fmt(ln.weight)}</td>
                    <td>{ln.description ?? ''}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="legend mt-2 text-[7.5px] leading-tight text-gray-700">
        <strong>Legenda:</strong> K=Kostka · KD=Kostka duża · KC=Kostka C · KB=Kostka B · KO=Odsort · OK=Odzysk Kostka · ST=Sticksy · OS=Odzysk Sticksy
        · S=Semolina · SR=Semolina SR · SPG=Semolina po grysie · SŻ=Semolina żółta · SB=Semolina B
        · P=Proszek · PŻ=Proszek żółty · G=Grys · GR=Granulat · Grysik · BIO/BB warianty z dopiskiem
      </div>
    </div>
  );
}

function PrintAmbro({ cfg, entries, today, empty }: any) {
  return (
    <div className="p-2 print-page">
      <PrintStyles />
      <PrintAutoLaunch />
      <div className="flex justify-between border-b-2 border-black pb-1 mb-2 items-center">
        <div className="text-xs"><b>DATA:</b> {today}</div>
        <div className="font-bold uppercase text-sm">Magazyn AMBRO</div>
        <div></div>
      </div>
      <table className="ambro-print">
        <thead>
          <tr><th>Kod</th><th>Waga</th><th>Nr KW</th><th>Wydanie</th><th>Przyjęcie</th><th>Uwagi</th><th>Dodatkowe</th></tr>
        </thead>
        <tbody>
          {entries.map((e: AmbroEntry) => (
            <tr key={e.id}>
              <td>{e.raw_label ?? ''}</td>
              <td className="text-right">{fmt(e.weight)}</td>
              <td>{e.kwit ?? ''}</td>
              <td>{e.issue_date ?? ''}</td>
              <td>{e.receive_date ?? ''}</td>
              <td>{e.notes ?? ''}</td>
              <td>{e.extra ?? ''}</td>
            </tr>
          ))}
          {Array.from({ length: empty ? 25 : 8 }).map((_, i) => (
            <tr key={`e-${i}`} className="empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @page { size: A4 landscape; margin: 8mm; }
      .print-page { font-family: Arial, sans-serif; color: black; font-size: 10px; }
      .print-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .print-grid th, .print-grid td { border: 1px solid black; padding: 2px 3px; text-align: center; vertical-align: middle; overflow: hidden; }
      .print-grid th { background: #e5e7eb; font-weight: 600; font-size: 9px; }
      .print-grid th.sub { background: #f3f4f6; font-weight: 400; font-size: 7px; padding: 1px; }
      .print-grid td.lbl { font-size: 10px; font-weight: 600; height: 26px; }
      .print-grid td.info { font-size: 9px; color: #444; }
      .print-grid td.w { font-size: 10px; font-weight: 600; }
      .print-grid .rownum { background: #1f2937; color: white; font-weight: 700; width: 16px; }

      .container-print { width: 100%; border-collapse: collapse; font-size: 9px; }
      .container-print th, .container-print td { border: 1px solid black; padding: 2px 4px; }
      .container-print th { background: #fde68a; }
      .container-print td.cnum { background: #fef3c7; font-weight: 700; text-align: center; width: 24px; }
      .container-print td.empty-row { height: 14px; }

      .ambro-print { width: 100%; border-collapse: collapse; font-size: 10px; }
      .ambro-print th, .ambro-print td { border: 1px solid black; padding: 3px 5px; }
      .ambro-print th { background: #e5e7eb; }
      .ambro-print tr.empty td { height: 22px; }

      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}
