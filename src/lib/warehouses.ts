export type WarehouseType = 'grid' | 'blaszak' | 'ambro';

export interface WarehouseConfig {
  key: string;
  name: string;
  type: WarehouseType;
  cols?: string[];
  rows?: number;
  containers?: number;
  // Indeks kolumny (0-based), po której jest droga (przerwa wizualna)
  // np. roadAfter=4 oznacza: A,B,C,D,E | DROGA | F,G,H,I,J
  roadAfter?: number;
  // Czy ostatni rząd to "Magazynek" (specjalny rząd przy wjeździe)
  hasMagazynek?: boolean;
  // Czy numery rzędów są odwrócone (w blaszaku liczy się od końca: 5,4,3,2,1)
  rowsReversed?: boolean;
  // Czy są 2 wiersze per rząd (Wiata - bez skrobi) zamiast 3
  noStarch?: boolean;
}

export const WAREHOUSES: Record<string, WarehouseConfig> = {
  lewa:    { key: 'lewa',    name: 'Magazyn Lewa Strona',  type: 'grid',    cols: ['A','B','C','D','E','F','G','H'], rows: 12 },
  prawa:   { key: 'prawa',   name: 'Magazyn Prawa Strona', type: 'grid',    cols: ['A','B','C','D','E','F','G','H'], rows: 10 },
  blaszak1:{ key: 'blaszak1',name: 'Blaszak 1',            type: 'blaszak', cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 5, containers: 6, roadAfter: 4, hasMagazynek: true, rowsReversed: true, noStarch: true },
  blaszak2:{ key: 'blaszak2',name: 'Blaszak 2',            type: 'blaszak', cols: ['A','B','C','D','E','F','G','H','I','J'], rows: 8, containers: 6, roadAfter: 4, hasMagazynek: true, rowsReversed: true, noStarch: true },
  wiata:   { key: 'wiata',   name: 'Wiata',                type: 'grid',    cols: ['A','B','C','D','E','F','G'], rows: 9, noStarch: true },
  ambro:   { key: 'ambro',   name: 'Ambro (zewnętrzny)',   type: 'ambro' },
};

export const WAREHOUSE_KEYS = Object.keys(WAREHOUSES);
