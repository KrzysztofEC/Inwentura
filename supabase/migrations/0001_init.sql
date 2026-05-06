-- ============================================================
-- SCHEMAT BAZY MAGAZYNU
-- Uruchom w Supabase Dashboard → SQL Editor (lub przez supabase migration up)
-- ============================================================

-- Tabela komórek (siatka magazynów: lewa, prawa, blaszak1, blaszak2, wiata)
create table if not exists public.cells (
  id          bigserial primary key,
  warehouse   text not null,
  col         text not null,
  row         int  not null,
  slot        text not null check (slot in ('gora', 'dol')),
  raw_label   text,
  product_code text,
  kwit        text,
  starch      text,
  weight      numeric,
  note        text,
  updated_at  timestamptz default now(),
  updated_by  uuid references auth.users(id),
  unique (warehouse, col, row, slot)
);
create index if not exists idx_cells_warehouse on public.cells(warehouse);
create index if not exists idx_cells_product on public.cells(product_code);

-- Tabela pozycji w kontenerach (Blaszaki)
create table if not exists public.containers (
  id            bigserial primary key,
  warehouse     text not null,
  container_no  int  not null,
  line_no       int  not null default 1,
  raw_label     text,
  product_code  text,
  pallets       text,
  weight        numeric,
  description   text,
  updated_at    timestamptz default now(),
  updated_by    uuid references auth.users(id)
);
create index if not exists idx_containers_warehouse on public.containers(warehouse);

-- Tabela wpisów Ambro (magazyn zewnętrzny)
create table if not exists public.ambro (
  id           bigserial primary key,
  raw_label    text,
  product_code text,
  weight       numeric,
  kwit         text,
  issue_date   date,
  receive_date date,
  notes        text,
  extra        text,
  updated_at   timestamptz default now(),
  updated_by   uuid references auth.users(id)
);
create index if not exists idx_ambro_product on public.ambro(product_code);

-- Tabela zrzutów dziennych (do historii)
create table if not exists public.snapshots (
  id         bigserial primary key,
  snap_date  date default current_date,
  payload    jsonb,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- ============================================================
-- TRIGGER: aktualizuj updated_at i updated_by
-- ============================================================
create or replace function public.set_updated_meta()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_cells_updated on public.cells;
create trigger trg_cells_updated before insert or update on public.cells
  for each row execute function public.set_updated_meta();

drop trigger if exists trg_containers_updated on public.containers;
create trigger trg_containers_updated before insert or update on public.containers
  for each row execute function public.set_updated_meta();

drop trigger if exists trg_ambro_updated on public.ambro;
create trigger trg_ambro_updated before insert or update on public.ambro
  for each row execute function public.set_updated_meta();

-- ============================================================
-- ROW LEVEL SECURITY
-- Reguła: tylko zalogowani użytkownicy mogą czytać/zapisywać
-- ============================================================
alter table public.cells       enable row level security;
alter table public.containers  enable row level security;
alter table public.ambro       enable row level security;
alter table public.snapshots   enable row level security;

drop policy if exists "auth_all_cells"      on public.cells;
drop policy if exists "auth_all_containers" on public.containers;
drop policy if exists "auth_all_ambro"      on public.ambro;
drop policy if exists "auth_all_snapshots"  on public.snapshots;

create policy "auth_all_cells"      on public.cells      for all to authenticated using (true) with check (true);
create policy "auth_all_containers" on public.containers for all to authenticated using (true) with check (true);
create policy "auth_all_ambro"      on public.ambro      for all to authenticated using (true) with check (true);
create policy "auth_all_snapshots"  on public.snapshots  for all to authenticated using (true) with check (true);

-- ============================================================
-- WIDOK: stany agregowane (dla strony głównej)
-- ============================================================
create or replace view public.totals_per_warehouse as
  select warehouse, product_code, sum(weight) as total
  from (
    select warehouse, product_code, weight from public.cells where product_code is not null and weight is not null
    union all
    select warehouse, product_code, weight from public.containers where product_code is not null and weight is not null
    union all
    select 'ambro' as warehouse, product_code, weight from public.ambro where product_code is not null and weight is not null
  ) t
  group by warehouse, product_code;
