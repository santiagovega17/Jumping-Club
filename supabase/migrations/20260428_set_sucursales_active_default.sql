-- Mantener todas las franquicias/sucursales activas por ahora.
update public.sucursales
set estado = 'activa'
where estado is distinct from 'activa';

alter table public.sucursales
alter column estado set default 'activa';
