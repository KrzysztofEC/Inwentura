export interface Cell {
  id: number;
  warehouse: string;
  col: string;
  row: number;
  slot: 'gora' | 'dol';
  raw_label: string | null;
  product_code: string | null;
  kwit: string | null;
  starch: string | null;
  weight: number | null;
  note: string | null;
  updated_at: string;
}

export interface Container {
  id: number;
  warehouse: string;
  container_no: number;
  line_no: number;
  raw_label: string | null;
  product_code: string | null;
  pallets: string | null;
  weight: number | null;
  description: string | null;
  updated_at: string;
}

export interface AmbroEntry {
  id: number;
  raw_label: string | null;
  product_code: string | null;
  weight: number | null;
  kwit: string | null;
  issue_date: string | null;
  receive_date: string | null;
  notes: string | null;
  extra: string | null;
  updated_at: string;
}

export interface TotalRow {
  warehouse: string;
  product_code: string;
  total: number;
}
