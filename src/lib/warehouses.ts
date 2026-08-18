export type WarehouseType = 'grid' | 'blaszak' | 'ambro' | 'kontenery';
export interface WarehouseConfig {
  key: string;
  name: string;
  type: WarehouseType;
  cols?: string[];
  rows?: number;
  containers?: number;
  roadAfter?: number;
  hasMagazynek?: boolean;
  rowsReversed?: boolean;
  middleRow?: 'starch' | 'info';
}
export const ROAD_COL_KEY = 'DROGA';
export const WAREHOUSES: Record<string, WarehouseConfig> = {
  lewa:       { key: 'lewa',       name: 'Magazyn Lewa Strona',  type: 'grid',      cols: ['A','B','C','D','E','F','G','H'], rows: 12, middleRow: 'starch' },
  prawa:      { key: 'prawa',      name: 'Magazyn Prawa Strona', type: 'grid',      cols: ['A','B','C','D','E','F','G','H'], rows: 10, middleRow: 'starch' },
  blaszak1:   { key: 'blaszak1',   name: 'Blaszak 1',            type: 'blaszak',   cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 5, roadAfter: 5, hasMagazynek: true, rowsReversed: true, middleRow: 'info' },
  blaszak2:   { key: 'blaszak2',   name: 'Blaszak 2',            type: 'blaszak',   cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 8, roadAfter: 5, hasMagazynek: true, rowsReversed: true, middleRow: 'info' },
  wiata:      { key: 'wiata',      name: 'Wiata',                type: 'grid',      cols: ['A','B','C','D','E','F','G'], rows: 13, middleRow: 'info' },
  kontenery:  { key: 'kontenery',  name: 'Kontenery',            type: 'kontenery', containers: 6 },
  ambro:      { key: 'ambro',      name: 'Ambro (zewnętrzny)',   type: 'ambro' },
};
export const WAREHOUSE_KEYS = Object.keys(WAREHOUSES);
export const ROAD_COL_1 = 'DROGA_1';
export const ROAD_COL_2 = 'DROGA_2';

export function colsWithRoad(cfg: WarehouseConfig): string[] {
  if (cfg.roadAfter === undefined || !cfg.cols) return cfg.cols ?? [];
  const result: string[] = [];
  for (let i = 0; i < cfg.cols.length; i++) {
    result.push(cfg.cols[i]);
    if (i === cfg.roadAfter - 1) {
      result.push(ROAD_COL_1);
      result.push(ROAD_COL_2);
    }
  }
  return result;
}
export function middleRowLabel(cfg: WarehouseConfig): string {
  if (cfg.middleRow === 'starch') return 'SKROBIA';
  if (cfg.middleRow === 'info') return 'INFO';
  return '';
}
