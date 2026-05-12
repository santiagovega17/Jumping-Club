alter table public.movimientos_caja
add column if not exists fecha_vencimiento date;

create index if not exists idx_movimientos_caja_estado_vencimiento
  on public.movimientos_caja (estado, fecha_vencimiento);
