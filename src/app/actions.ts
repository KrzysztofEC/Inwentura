'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = parseFloat(String(v).replace(',', '.'));
  return isNaN(x) ? null : x;
}

// Normalizacja tekstu do porównania z aliasami
function normalizeStr(s: string): string {
  return s.trim().toUpperCase()
    .replace(/Ą/g,'A').replace(/Ć/g,'C').replace(/Ę/g,'E')
    .replace(/Ł/g,'L').replace(/Ń/g,'N').replace(/Ó/g,'O')
    .replace(/Ś/g,'S').replace(/Ź/g,'Z').replace(/Ż/g,'Z');
}

// Pobierz mapę aliasów z bazy danych (serwer)
let cachedAliasMap: Map<string, string> | null = null;
let cacheTs = 0;

async function getAliasMap(supabase: any): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedAliasMap && now - cacheTs < 60_000) return cachedAliasMap;
  const { data } = await supabase.from('products').select('code, aliases');
  const map = new Map<string, string>();
  for (const p of (data ?? [])) {
    map.set(normalizeStr(p.code), p.code);
    for (const alias of (p.aliases ?? [])) {
      map.set(normalizeStr(alias), p.code);
    }
  }
  cachedAliasMap = map;
  cacheTs = now;
  return map;
}

function resolvePart(s: string, aliasMap: Map<string, string>): { code: string | null; codeBot: string | null; kwit: string | null; isUnknown: boolean } {
  if (!s) return { code: null, codeBot: null, kwit: null, isUnknown: false };
  if (/^\d+$/.test(s)) return { code: 'K', codeBot: null, kwit: s, isUnknown: false };

  const kwitMatch = s.match(/^(.+?)\s+(\d{3,})$/);
  if (kwitMatch) {
    const label = kwitMatch[1].trim();
    const kwit = kwitMatch[2];
    const code = aliasMap.get(normalizeStr(label)) ?? null;
    return code ? { code, codeBot: null, kwit, isUnknown: false } : { code: 'UNKNOWN', codeBot: null, kwit, isUnknown: true };
  }

  const code = aliasMap.get(normalizeStr(s)) ?? null;
  if (code) return { code, codeBot: null, kwit: null, isUnknown: false };
  return { code: 'UNKNOWN', codeBot: null, kwit: null, isUnknown: true };
}

async function parseRawLabel(raw: string, supabase: any) {
  if (!raw || !raw.trim()) return { code: null, codeBot: null, kwit: null };
  const aliasMap = await getAliasMap(supabase);
  const parts = raw.split('/').map((p: string) => p.trim());

  if (parts.length === 1) {
    const r = resolvePart(parts[0], aliasMap);
    return { code: r.code, codeBot: null, kwit: r.kwit };
  }

  const top = resolvePart(parts[0], aliasMap);
  const bot = resolvePart(parts[1], aliasMap);
  return {
    code: top.code,
    codeBot: bot.code !== top.code ? bot.code : null,
    kwit: top.kwit ?? bot.kwit,
  };
}

export async function saveCell(input: {
  warehouse: string; col: string; row: number;
  raw_label?: string; starch?: string;
  weight_top?: any; weight_bot?: any;
  note?: string; kwit?: string;
}) {
  const supabase = await createClient();
  const parsed = await parseRawLabel(input.raw_label ?? '', supabase);
  const payload = {
    warehouse: input.warehouse,
    col: input.col,
    row: input.row,
    raw_label: input.raw_label?.trim() || null,
    product_code: parsed.code,
    product_code_bot: parsed.codeBot,
    kwit: parsed.kwit ?? input.kwit?.trim() ?? null,
    starch: input.starch?.trim() || null,
    weight_top: num(input.weight_top),
    weight_bot: num(input.weight_bot),
    note: input.note?.trim() || null,
  };
  const { error } = await supabase
    .from('cells')
    .upsert(payload, { onConflict: 'warehouse,col,row' });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/warehouse/${input.warehouse}`);
  revalidatePath('/');
  return { ok: true, product_code: parsed.code, kwit: parsed.kwit };
}

export async function clearCell(input: { warehouse: string; col: string; row: number }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('cells')
    .delete()
    .match({ warehouse: input.warehouse, col: input.col, row: input.row });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/warehouse/${input.warehouse}`);
  revalidatePath('/');
  return { ok: true };
}

export async function saveContainer(input: {
  id?: number; warehouse: string; container_no: number; line_no?: number;
  raw_label?: string; pallets?: string; weight?: any; description?: string;
}) {
  const supabase = await createClient();
  const aliasMap = await getAliasMap(supabase);
  const parsed = resolvePart(input.raw_label ?? '', aliasMap);
  const payload: any = {
    warehouse: input.warehouse,
    container_no: input.container_no,
    line_no: input.line_no ?? 1,
    raw_label: input.raw_label?.trim() || null,
    product_code: parsed.code,
    pallets: input.pallets?.trim() || null,
    weight: num(input.weight),
    description: input.description?.trim() || null,
  };
  if (input.id) {
    const { data, error } = await supabase.from('containers').update(payload).eq('id', input.id).select().single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/warehouse/${input.warehouse}`);
    revalidatePath('/');
    return { ok: true, id: data.id, product_code: parsed.code };
  } else {
    const { data, error } = await supabase.from('containers').insert(payload).select().single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/warehouse/${input.warehouse}`);
    revalidatePath('/');
    return { ok: true, id: data.id, product_code: parsed.code };
  }
}

export async function deleteContainer(id: number, warehouse: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('containers').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/warehouse/${warehouse}`);
  revalidatePath('/');
  return { ok: true };
}

export async function saveAmbro(input: {
  id?: number; raw_label?: string; kwit?: string;
  wydanie_ambro?: any; przyjecie_ec?: any; ilosc_palet?: any;
  issue_date?: string; receive_date?: string; notes?: string;
}) {
  const supabase = await createClient();
  const aliasMap = await getAliasMap(supabase);
  const parsed = resolvePart(input.raw_label ?? '', aliasMap);
  const payload: any = {
    raw_label: input.raw_label?.trim() || null,
    product_code: parsed.code,
    kwit: input.kwit?.trim() || null,
    wydanie_ambro: num(input.wydanie_ambro),
    przyjecie_ec: num(input.przyjecie_ec),
    ilosc_palet: num(input.ilosc_palet),
    issue_date: input.issue_date || null,
    receive_date: input.receive_date || null,
    notes: input.notes?.trim() || null,
  };
  if (input.id) {
    const { data, error } = await supabase.from('ambro').update(payload).eq('id', input.id).select().single();
    if (error) return { ok: false, error: error.message };
    revalidatePath('/warehouse/ambro');
    revalidatePath('/');
    return { ok: true, id: data.id, product_code: parsed.code };
  } else {
    const { data, error } = await supabase.from('ambro').insert(payload).select().single();
    if (error) return { ok: false, error: error.message };
    revalidatePath('/warehouse/ambro');
    revalidatePath('/');
    return { ok: true, id: data.id, product_code: parsed.code };
  }
}

export async function deleteAmbro(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('ambro').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/warehouse/ambro');
  revalidatePath('/');
  return { ok: true };
}

export async function makeSnapshot() {
  const supabase = await createClient();
  const { data: totals } = await supabase.from('totals_per_warehouse').select('*');
  const { error } = await supabase.from('snapshots').insert({ payload: { totals } });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Wyczyść cache aliasów (wywołaj po dodaniu/edycji produktu)
export async function invalidateProductsCache() {
  cachedAliasMap = null;
  cacheTs = 0;
  return { ok: true };
}
