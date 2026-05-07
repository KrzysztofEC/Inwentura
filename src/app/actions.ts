'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseProductCode } from '@/lib/products';

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = parseFloat(String(v).replace(',', '.'));
  return isNaN(x) ? null : x;
}

export async function saveCell(input: {
  warehouse: string; col: string; row: number;
  raw_label?: string; starch?: string;
  weight_top?: any; weight_bot?: any;
  note?: string; kwit?: string;
}) {
  const supabase = await createClient();
  const parsed = parseProductCode(input.raw_label ?? '');
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
  const parsed = parseProductCode(input.raw_label ?? '');
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
  id?: number; raw_label?: string; weight?: any; kwit?: string;
  issue_date?: string; receive_date?: string; notes?: string; extra?: string;
}) {
  const supabase = await createClient();
  const parsed = parseProductCode(input.raw_label ?? '');
  const payload: any = {
    raw_label: input.raw_label?.trim() || null,
    product_code: parsed.code,
    weight: num(input.weight),
    kwit: input.kwit?.trim() || null,
    issue_date: input.issue_date || null,
    receive_date: input.receive_date || null,
    notes: input.notes?.trim() || null,
    extra: input.extra?.trim() || null,
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
