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

function splitTopBot(s: string | null | undefined): { top: string; bot: string } {
  if (!s) return { top: '', bot: '' };
  if (s.includes('/')) {
    const [first, second] = s.split('/', 2).map((x) => x.trim());
    if (/^\d+$/.test(second)) return { top: s, bot: '' };
    return { top: first, bot: second };
  }
  return { top: s, bot: '' };
}

function PrintGrid({ cfg, cells, containers, today, empty }: any) {
  const map = new Map<string, Cell>();
  for (const c of cells) map.set(`${c.col}|${c.row}`, c);

  const subRows = cfg.noStarch ? ['kwit', 'weight'] : ['kwit', 'starch', 'weight'];
  const subLabels: Record<string, string> = { kwit: 'KWIT', starch: 'SKROBIA', weight: 'WAGA' };

  const rowNumbers: (number | 'M')[] = [];
  for (let i = 1; i <= cfg.rows; i++) rowNumbers.push(i);
  if (cfg.rowsReversed) rowNumbers.reverse();
  if (cfg.hasMagazynek) rowNumbers.push('M');

  return (
    <div className="p-2 print-page">
      <PrintStyles />
      <PrintAutoLaunch />

      <div className="print-header">
        <div className="left"><b>DATA:</b> {today}</div>
        <div className="title">{cfg.name} {empty && <span className="empty-tag">(pusty szablon)</span>}</div>
        <div className="right">{cfg.key === 'prawa' ? 'WYJŚCIE EW.' : ''}</div>
      </div>

      <table className="print-grid">
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '6%' }} />
          {cfg.cols.map((_: any, idx: number) => {
            const els: any[] = [
              <col key={`g-${idx}`} />,
              <col key={`d-${idx}`} />,
            ];
            if (cfg.roadAfter !== undefined && idx === cfg.roadAfter - 1) {
              els.push(<col key={`r-${idx}`} style={{ width: '2%' }} />);
            }
            return els;
          }).flat()}
          <col style={{ width: '3%' }} />
        </colgroup>

        <thead>
          <tr>
            <th></th>
            <th></th>
            {cfg.cols.flatMap((col: string, idx: number) => {
              const arr: any[] = [
                <th key={col} colSpan={2} className="colhead">{col}</th>,
              ];
              if (cfg.roadAfter !== undefined && idx === cfg.roadAfter - 1) {
                arr.push(<th key={`r-${idx}`} className="road-head" />);
              }
              return arr;
            })}
            <th></th>
          </tr>
          <tr>
            <th></th>
            <th></th>
            {cfg.cols.flatMap((col: string, idx: number) => {
              const arr: any[] = [
                <th key={`${col}-g`} className="sub">góra</th>,
                <th key={`${col}-d`} className="sub">dół</th>,
              ];
              if (cfg.roadAfter !== undefined && idx === cfg.roadAfter - 1) {
                arr.push(<th key={`r-${idx}`} className="road-cell">DROGA</th>);
              }
              return arr;
            })}
            <th></th>
          </tr>
        </thead>

        <tbody>
          {rowNumbers.map((rNum) => {
            if (rNum === 'M') {
              return (
                <tr key="magazynek">
                  <td className="rownum">M</td>
                  <td className="sub-label" style={{ background: '#fef3c7' }}>Magazynek</td>
                  <td colSpan={cfg.cols.length * 2 + (cfg.roadAfter !== undefined ? 1 : 0)} className="magazynek-cell">&nbsp;</td>
                  <td className="rownum">M</td>
                </tr>
              );
            }
            const r = rNum as number;
            return subRows.map((sub: string, subIdx: number) => (
              <tr key={`${r}-${sub}`} className={subIdx === 0 ? 'row-start' : ''}>
                {subIdx === 0 && (
                  <td rowSpan={subRows.length} className="rownum">{r}</td>
                )}
                <td className="sub-label">{subLabels[sub]}</td>
                {cfg.cols.flatMap((col: string, colIdx: number) => {
                  const c = map.get(`${col}|${r}`);
                  const tds: any[] = [];

                  if (sub === 'kwit') {
                    const { top, bot } = splitTopBot(c?.raw_label);
                    tds.push(<td key={`${col}-${r}-k-t`} className="lbl">{top}</td>);
                    tds.push(<td key={`${col}-${r}-k-b`} className="lbl">{bot}</td>);
                  } else if (sub === 'starch') {
                    const { top, bot } = splitTopBot(c?.starch);
                    tds.push(<td key={`${col}-${r}-s-t`} className="info">{top}</td>);
                    tds.push(<td key={`${col}-${r}-s-b`} className="info">{bot}</td>);
                  } else {
                    tds.push(<td key={`${col}-${r}-w-t`} className="w">{fmt(c?.weight_top)}</td>);
                    tds.push(<td key={`${col}-${r}-w-b`} className="w">{fmt(c?.weight_bot)}</td>);
                  }

                  if (cfg.roadAfter !== undefined && colIdx === cfg.roadAfter - 1) {
                    tds.push(<td key={`road-${r}-${sub}`} className="road-cell" />);
                  }

                  return tds;
                })}
                {subIdx === 0 && (
                  <td rowSpan={subRows.length} className="rownum">{r}</td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>

      {cfg.type === 'blaszak' && (
        <>
          <h3 className="containers-title">Kontenery</h3>
          <table className="container-print">
            <thead>
              <tr><th>Nr</th><th>Kod</th><th>Palety</th><th>Waga</th><th>Opis</th></tr>
            </thead>
            <tbody>
              {containers.map((lines: Container[], i: number) => {
                const cnum = i + 1;
                if (lines.length === 0) {
                  return (
                    <tr key={cnum}><td className="cnum">{cnum}</td><td className="empty-row"></td><td></td><td></td><td></td></tr>
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

      <div className="legend">
        <strong>Legenda:</strong>{' '}
        <span>K=Kostka</span> · <span>KD=Kostka duża</span> · <span>KC=Kostka C</span> · <span>KB=Kostka B</span> ·
        <span>KO=Kostka odsort</span> · <span>OK=Odzysk Kostka</span> · <span>ST=Sticksy</span> · <span>OS=Odzysk Sticksy</span> ·
        <span>S=Semolina</span> · <span>SR=Semolina SR</span> · <span>SPG=Semolina po grysie</span> · <span>SŻ=Semolina żółta</span> · <span>SB=Semolina B</span> ·
        <span>P=Proszek</span> · <span>PŻ=Proszek żółty</span> · <span>G=Grys</span> · <span>GR=Granulat</span> · <span>Grysik</span> ·
        warianty z dopiskiem <strong>BIO</strong> lub <strong>BB</strong>
      </div>
    </div>
  );
}

function PrintAmbro({ cfg, entries, today, empty }: any) {
  return (
    <div className="p-2 print-page">
      <PrintStyles />
      <PrintAutoLaunch />
      <div className="print-header">
        <div className="left"><b>DATA:</b> {today}</div>
        <div className="title">Magazyn AMBRO</div>
        <div className="right"></div>
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
      @page { size: A4 landscape; margin: 6mm; }
      .print-page { font-family: Arial, sans-serif; color: black; font-size: 9px; }

      .print-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 3px; border-bottom: 2px solid black; margin-bottom: 4px; }
      .print-header .title { font-weight: 700; font-size: 13px; text-transform: uppercase; }
      .print-header .left, .print-header .right { font-size: 10px; }
      .empty-tag { font-size: 9px; font-style: italic; font-weight: 400; }

      .print-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .print-grid th, .print-grid td { border: 1px solid black; padding: 1px 2px; text-align: center; vertical-align: middle; overflow: hidden; }
      .print-grid th.colhead { background: #1f2937; color: white; font-weight: 700; font-size: 11px; padding: 2px; }
      .print-grid th.sub { background: #e5e7eb; font-weight: 400; font-size: 8px; padding: 1px; }
      .print-grid td.rownum { background: #1f2937; color: white; font-weight: 700; text-align: center; font-size: 12px; }
      .print-grid td.sub-label { background: #f3f4f6; font-weight: 600; font-size: 8px; text-transform: uppercase; color: #444; }
      .print-grid td.lbl { font-size: 11px; font-weight: 700; height: 18px; }
      .print-grid td.info { font-size: 10px; color: #444; height: 16px; }
      .print-grid td.w { font-size: 11px; font-weight: 700; height: 18px; }
      .print-grid tr.row-start td { border-top: 2px solid black; }

      .print-grid td.road-cell, .print-grid th.road-head { background: #d1d5db; }
      .print-grid th.road-head { background: #9ca3af; color: white; font-size: 8px; }
      .print-grid td.magazynek-cell { background: #fef9c3; height: 22px; }

      .containers-title { margin: 6px 0 2px; font-size: 11px; font-weight: 700; }
      .container-print { width: 100%; border-collapse: collapse; font-size: 9px; }
      .container-print th, .container-print td { border: 1px solid black; padding: 2px 4px; }
      .container-print th { background: #fde68a; }
      .container-print td.cnum { background: #fef3c7; font-weight: 700; text-align: center; width: 24px; }
      .container-print td.empty-row { height: 14px; }
      .container-print .text-right { text-align: right; }

      .ambro-print { width: 100%; border-collapse: collapse; font-size: 10px; }
      .ambro-print th, .ambro-print td { border: 1px solid black; padding: 3px 5px; }
      .ambro-print th { background: #e5e7eb; }
      .ambro-print tr.empty td { height: 22px; }
      .ambro-print .text-right { text-align: right; }

      .legend { font-size: 7px; margin-top: 4px; line-height: 1.3; color: #333; }
      .legend span { white-space: nowrap; }

      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}
