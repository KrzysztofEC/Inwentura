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
        .eq('warehouse', 'blaszak1')
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

  return <PrintGrid cfg={cfg} cells={cells} containers={[]} today={todayStr} empty={empty} />;
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
        <span>KO=Kostka odsort</span> · <span>OK=Odzysk Kostka</span> · <span>S=Semolina</span> · <span>SR=Semolina SR</span> ·
        <span>SPG=Semolina po grysie</span> · <span>G=Grys</span> · <span>GR=Granulat</span> · <span>P=Proszek</span> ·
        <span>PŻ=Proszek żółty</span> · warianty z dopiskiem <strong>BIO</strong> lub <strong>BB</strong>
      </div>
    </div>
  );
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
            {allCols.map((col: string) => (
              <th key={col} colSpan={2} className={col === ROAD_COL_KEY ? 'colhead road-head' : 'colhead'}>{col}</th>
            ))}
            <th></th>
          </tr>
          <tr>
            <th></th>
            <th></th>
            {allCols.flatMap((col: string) => [
              <th key={`${col}-g`} className={col === ROAD_COL_KEY ? 'sub road-sub' : 'sub'}>góra</th>,
              <th key={`${col}-d`} className={col === ROAD_COL_KEY ? 'sub road-sub' : 'sub'}>dół</th>,
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
                {subIdx === 0 && (
                  <td rowSpan={subRows.length} className="rownum">{r}</td>
                )}
                <td className="sub-label">{subLabels[sub]}</td>
                {allCols.flatMap((col: string) => {
                  const isRoad = col === ROAD_COL_KEY;
                  const c = map.get(`${col}|${r}`);
                  const tds: any[] = [];
                  if (sub === 'kwit') {
                    tds.push(<td key={`${col}-${r}-k`} colSpan={2} className={isRoad ? 'lbl road-bg' : 'lbl'}>{c?.raw_label ?? ''}</td>);
                  } else if (sub === 'starch') {
                    tds.push(<td key={`${col}-${r}-s`} colSpan={2} className={isRoad ? 'info road-bg' : 'info'}>{c?.starch ?? ''}</td>);
                  } else {
                    tds.push(<td key={`${col}-${r}-w-t`} className={isRoad ? 'w road-bg' : 'w'}>{fmt(c?.weight_top)}</td>);
                    tds.push(<td key={`${col}-${r}-w-b`} className={isRoad ? 'w road-bg' : 'w'}>{fmt(c?.weight_bot)}</td>);
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
      .print-grid td.rownum { background: #1f2937; color: white; font-weight: 700; text-align:
