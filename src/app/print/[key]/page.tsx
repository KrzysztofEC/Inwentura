import { createClient } from '@/lib/supabase/server';
import { WAREHOUSES, ROAD_COL_KEY, colsWithRoad } from '@/lib/warehouses';
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

  if (cfg.type === 'kontenery') {
    let containers: Container[][] = [];
    if (!empty) {
      const { data } = await supabase
        .from('containers').select('*')
        .eq('warehouse', 'kontenery')
        .order('container_no').order('line_no');
      for (let n = 1; n <= 6; n++) {
        containers.push(((data ?? []) as Container[]).filter((c) => c.container_no === n));
      }
    } else {
      for (let n = 1; n <= 6; n++) containers.push([]);
    }
    return <PrintKontenery containers={containers} today={todayStr} empty={empty} />;
  }

  let cells: Cell[] = [];
  if (!empty) {
    const { data } = await supabase.from('cells').select('*').eq('warehouse', key);
    cells = (data ?? []) as Cell[];
  }

  // Dla Blaszaka 1 dołącz kontenery
  let containers: Container[][] = [];
  if (key === 'blaszak1') {
    if (!empty) {
      const { data } = await supabase
        .from('containers').select('*')
        .eq('warehouse', 'kontenery')
        .order('container_no').order('line_no');
      for (let n = 1; n <= 6; n++) {
        containers.push(((data ?? []) as Container[]).filter((c) => c.container_no === n));
      }
    } else {
      for (let n = 1; n <= 6; n++) containers.push([]);
    }
  }

  return <PrintGrid cfg={cfg} cells={cells} containers={containers} today={todayStr} empty={empty} />;
}

function PrintKontenery({ containers, today, empty }: { containers: Container[][], today: string, empty: boolean }) {
  const EMPTY_ROWS = 4;
  return (
    <div className="p-2 print-page">
      <PrintStyles />
      <PrintAutoLaunch />
      <div className="print-header">
        <div className="left"><b>DATA:</b> {today}</div>
        <div className="title">KONTENERY {empty && <span className="empty-tag">(pusty szablon)</span>}</div>
        <div className="right"></div>
      </div>
      <div className="kontenery-grid">
        {containers.map((lines, i) => {
          const cnum = i + 1;
          const rowsToShow = empty
            ? Array(EMPTY_ROWS).fill(null)
            : lines.length > 0
              ? [...lines, ...Array(Math.max(0, 2 - lines.length)).fill(null)]
              : Array(EMPTY_ROWS).fill(null);
          return (
            <div key={cnum} className="kontener-box">
              <div className="kontener-title">Kontener {cnum}</div>
              <table className="container-print">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Produkt</th>
                    <th style={{ width: '15%' }}>Palety</th>
                    <th style={{ width: '20%' }}>Waga (kg)</th>
                    <th style={{ width: '35%' }}>Opis / Klient</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsToShow.map((ln: Container | null, idx: number) => (
                    <tr key={idx}>
                      <td className="data-cell">{ln?.raw_label ?? ''}</td>
                      <td className="data-cell">{ln?.pallets ?? ''}</td>
                      <td className="data-cell text-right">{ln ? fmt(ln.weight) : ''}</td>
                      <td className="data-cell">{ln?.description ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: '6px' }}>
        <strong>Legenda:</strong>{' '}
        <span>K=Kostka</span> · <span>KD=Kostka duża</span> · <span>KC=Kostka C</span> · <span>KB=Kostka B</span> ·
        <span>KO=Kostka odsort</span> · <span>S=Semolina</span> · <span>SR=Semolina SR</span> ·
        <span>G=Grys</span> · <span>GR=Granulat</span> · <span>P=Proszek</span> ·
        warianty z dopiskiem <strong>BIO</strong> lub <strong>BB</strong>
      </div>
    </div>
  );
}

function KontenerySection({ containers }: { containers: Container[][] }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid black', paddingBottom: '2px', marginBottom: '4px' }}>
        Kontenery
      </div>
      <div className="kontenery-grid">
        {containers.map((lines, i) => {
          const cnum = i + 1;
          const rowsToShow = lines.length > 4
            ? [...lines, ...Array(Math.max(0, 4 - lines.length)).fill(null)]
            : Array(3).fill(null);
          return (
            <div key={cnum} className="kontener-box">
              <div className="kontener-title">Kontener {cnum}</div>
              <table className="container-print">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Produkt</th>
                    <th style={{ width: '15%' }}>Palety</th>
                    <th style={{ width: '20%' }}>Waga (kg)</th>
                    <th style={{ width: '35%' }}>Opis / Klient</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsToShow.map((ln: Container | null, idx: number) => (
                    <tr key={idx}>
                      <td className="data-cell">{ln?.raw_label ?? ''}</td>
                      <td className="data-cell">{ln?.pallets ?? ''}</td>
                      <td className="data-cell text-right">{ln ? fmt(ln.weight) : ''}</td>
                      <td className="data-cell">{ln?.description ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrintGrid({ cfg, cells, containers, today, empty }: any) {
  const map = new Map<string, Cell>();
  for (const c of cells) map.set(`${c.col}|${c.row}`, c);
  const subRows = cfg.middleRow ? ['kwit', 'starch', 'weight'] : ['kwit', 'weight'];
  const middleLabel = cfg.middleRow === 'info' ? 'INFO' : 'SKROBIA';
  const subLabels: Record<string, string> = { kwit: 'KWIT', starch: middleLabel, weight: 'WAGA' };
  const rowNumbers: (number | 'M')[] = [];
  for (let i = 1; i <= cfg.rows; i++) rowNumbers.push(i);
  if (cfg.rowsReversed) rowNumbers.reverse();
  if (cfg.hasMagazynek) rowNumbers.push('M');
  const allCols = colsWithRoad(cfg);
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
          {allCols.flatMap((_: any, idx: number) => [
            <col key={`g-${idx}`} />,
            <col key={`d-${idx}`} />,
          ])}
          <col style={{ width: '3%' }} />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th></th>
            {allCols.map((col: string, idx: number) => (
              <th key={idx} colSpan={2} className={col === ROAD_COL_KEY ? 'colhead road-head' : 'colhead'}>
                {col === ROAD_COL_KEY ? 'DROGA' : col}
              </th>
            ))}
            <th></th>
          </tr>
          <tr>
            <th></th>
            <th></th>
            {allCols.flatMap((col: string, idx: number) => [
              <th key={`${idx}-g`} className={col === ROAD_COL_KEY ? 'sub road-sub' : 'sub'}>góra</th>,
              <th key={`${idx}-d`} className={col === ROAD_COL_KEY ? 'sub road-sub' : 'sub'}>dół</th>,
            ])}
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
                  <td colSpan={allCols.length * 2} className="magazynek-cell">&nbsp;</td>
                  <td className="rownum">M</td>
                </tr>
              );
            }
            const r = rNum as number;
            return subRows.map((sub: string, subIdx: number) => (
              <tr key={`${r}-${sub}`} className={subIdx === 0 ? 'row-start' : ''}>
                {subIdx === 0 && <td rowSpan={subRows.length} className="rownum">{r}</td>}
                <td className="sub-label">{subLabels[sub]}</td>
                {allCols.flatMap((col: string, idx: number) => {
                  const isRoad = col === ROAD_COL_KEY;
                  const c = map.get(`${col}|${r}`);
                  const tds: any[] = [];
                  if (sub === 'kwit') {
                    tds.push(<td key={`${idx}-${r}-k`} colSpan={2} className={isRoad ? 'lbl road-bg' : 'lbl'}>{c?.raw_label ?? ''}</td>);
                  } else if (sub === 'starch') {
                    tds.push(<td key={`${idx}-${r}-s`} colSpan={2} className={isRoad ? 'info road-bg' : 'info'}>{c?.starch ?? ''}</td>);
                  } else {
                    tds.push(<td key={`${idx}-${r}-w-t`} className={isRoad ? 'w road-bg' : 'w'}>{fmt(c?.weight_top)}</td>);
                    tds.push(<td key={`${idx}-${r}-w-b`} className={isRoad ? 'w road-bg' : 'w'}>{fmt(c?.weight_bot)}</td>);
                  }
                  return tds;
                })}
                {subIdx === 0 && <td rowSpan={subRows.length} className="rownum">{r}</td>}
              </tr>
            ));
          })}
        </tbody>
      </table>

      {containers && containers.length > 0 && (
        <KontenerySection containers={containers} />
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
      .print-grid th.road-head { background: #6b7280; color: white; }
      .print-grid th.road-sub { background: #9ca3af; color: white; }
      .print-grid td.road-bg { background: #f3f4f6; }
      .print-grid td.magazynek-cell { background: #fef9c3; height: 22px; }
      .kontenery-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
      .kontener-box { border: 1px solid #333; border-radius: 2px; overflow: hidden; }
      .kontener-title { background: #1f2937; color: white; font-weight: 700; font-size: 10px; padding: 3px 6px; }
      .container-print { width: 100%; border-collapse: collapse; font-size: 8px; }
      .container-print th { background: #e5e7eb; border: 1px solid #999; padding: 2px 3px; font-weight: 600; text-align: left; }
      .container-print td { border: 1px solid #ccc; padding: 0; }
      .container-print td.data-cell { height: 16px; padding: 1px 3px; }
      .container-print .text-right { text-align: right; }
      .ambro-print { width: 100%; border-collapse: collapse; font-size: 10px; }
      .ambro-print th, .ambro-print td { border: 1px solid black; padding: 3px 5px; }
      .ambro-print th { background: #e5e7eb; }
      .ambro-print tr.empty td { height: 22px; }
      .ambro-print .text-right { text-align: right; }
      .legend { font-size: 7px; margin-top: 4px; line-height: 1.3; color: #333; }
      .legend span { white-space: nowrap; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `}</style>
  );
}
