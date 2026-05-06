export type WarehouseType = 'grid' | 'blaszak' | 'ambro';

export interface WarehouseConfig {
  key: string;
  name: string;
  type: WarehouseType;
  cols?: string[];
  rows?: number;
  containers?: number;
}

export const WAREHOUSES: Record<string, WarehouseConfig> = {
  lewa:    { key: 'lewa',    name: 'Magazyn Lewa Strona',  type: 'grid',    cols: ['A','B','C','D','E','F','G','H'], rows: 10 },
  prawa:   { key: 'prawa',   name: 'Magazyn Prawa Strona', type: 'grid',    cols: ['A','B','C','D','E','F','G','H'], rows: 10 },
  blaszak1:{ key: 'blaszak1',name: 'Blaszak 1',            type: 'blaszak', cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 5, containers: 6 },
  blaszak2:{ key: 'blaszak2',name: 'Blaszak 2',            type: 'blaszak', cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 5, containers: 6 },
  wiata:   { key: 'wiata',   name: 'Wiata',                type: 'grid',    cols: ['A','B','C','D','E','F','G','H'], rows: 10 },
  ambro:   { key: 'ambro',   name: 'Ambro (zewnętrzny)',   type: 'ambro' },
};

export const WAREHOUSE_KEYS = Object.keys(WAREHOUSES);
