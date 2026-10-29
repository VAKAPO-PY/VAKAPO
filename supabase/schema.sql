-- ════════════════════════════════════════════════════════════════════
-- VAKAPO · Esquema de base de datos para Supabase (plan gratuito)
-- Pegar TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- ════════════════════════════════════════════════════════════════════

-- ───────── Funciones comunes ─────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────── Tablas ─────────
-- Todas usan id de texto (lo genera el celular), borrado lógico (deleted)
-- y updated_at con la hora del servidor (para sincronizar).

create table if not exists public.perfiles (
  id text primary key,                    -- = auth.users.id
  nombre text, email text,
  rol text not null default 'propietario' check (rol in ('admin','propietario')),
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.tambos (
  id text primary key, nombre text not null, ubicacion text, notas text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.miembros (
  id text primary key, tambo_id text not null, user_id text not null,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.lotes (
  id text primary key, tambo_id text not null, nombre text not null,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.categorias (
  id text primary key, nombre text not null, orden int default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.vacas (
  id text primary key, tambo_id text not null, numero text not null,
  lote_id text, categoria_id text, notas text, activa boolean default true,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.lesiones (
  id text primary key, codigo text not null, nombre text not null,
  zonas jsonb not null default '[]', grados jsonb not null default '[]',
  orden int default 0, activa boolean default true,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id text primary key, tipo text not null, nombre text not null, unidad text,
  precio numeric not null default 0, activo boolean default true, orden int default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.tarifas (
  id text primary key, tambo_id text not null, item_id text not null, precio numeric not null default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.jornadas (
  id text primary key, tambo_id text not null, fecha text not null, estado text default 'abierta',
  notas text, operador text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.examenes (
  id text primary key, tambo_id text not null, jornada_id text not null, vaca_id text not null, fecha text not null,
  preventivo boolean default false, revision_fecha text, revision_ok boolean default false, notas text, operador text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.hallazgos (
  id text primary key, tambo_id text not null, examen_id text not null, vaca_id text not null, fecha text not null,
  pata text not null, pezuna text, zona text not null, lesion_id text, codigo text not null, grado text not null,
  nivel int not null default 0, notas text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.cargos (
  id text primary key, tambo_id text not null, jornada_id text not null, examen_id text, vaca_id text,
  item_id text, tipo text, descripcion text, cantidad numeric not null default 1, precio_unit numeric not null default 0, fecha text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.recetas (
  id text primary key, tambo_id text not null, examen_id text not null, vaca_id text not null, fecha text,
  veterinario text, medicamento text not null, dosis text, via text, duracion text, indicaciones text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.fotos (
  id text primary key, tambo_id text not null, vaca_id text not null, examen_id text, hallazgo_id text,
  fecha text, path text, subida int default 0,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.notas_prop (
  id text primary key, tambo_id text not null, vaca_id text, autor_id text not null, autor_nombre text,
  tipo text, texto text not null, fecha text,
  deleted boolean not null default false, updated_at timestamptz not null default now()
);

-- ───────── updated_at automático + índices para sincronizar ─────────
do $$
declare t text;
begin
  foreach t in array array['perfiles','tambos','miembros','lotes','categorias','vacas','lesiones','items','tarifas',
                           'jornadas','examenes','hallazgos','cargos','recetas','fotos','notas_prop']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before insert or update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
    execute format('create index if not exists idx_%1$s_updated on public.%1$I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create index if not exists idx_miembros_user on public.miembros (user_id);
create index if not exists idx_vacas_tambo on public.vacas (tambo_id);
create index if not exists idx_hallazgos_tambo on public.hallazgos (tambo_id);
create index if not exists idx_examenes_tambo on public.examenes (tambo_id);

-- ───────── Permisos: quién es quién ─────────
-- Funciones internas en un esquema NO expuesto por la API (privado).
create schema if not exists privado;
grant usage on schema privado to authenticated;

create or replace function privado.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p
                 where p.id = auth.uid()::text and p.rol = 'admin' and not p.deleted)
$$;

create or replace function privado.es_miembro(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros m
                 where m.tambo_id = t and m.user_id = auth.uid()::text and not m.deleted)
$$;

revoke all on function privado.es_admin() from public, anon;
revoke all on function privado.es_miembro(text) from public, anon;
grant execute on function privado.es_admin() to authenticated;
grant execute on function privado.es_miembro(text) to authenticated;

-- Perfil automático para cada cuenta nueva.
-- La PRIMERA cuenta creada queda como administrador; las siguientes, como propietario.
create or replace function privado.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email, rol)
  values (new.id::text, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), new.email,
          case when exists (select 1 from public.perfiles where rol = 'admin' and not deleted) then 'propietario' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function privado.nuevo_usuario() from public, anon, authenticated;
drop trigger if exists trg_nuevo_usuario on auth.users;
create trigger trg_nuevo_usuario after insert on auth.users
  for each row execute function privado.nuevo_usuario();

-- Para el mantenimiento automático (evita la pausa del plan gratuito)
create or replace function public.ping() returns text language sql stable set search_path = public as $$ select 'ok' $$;

-- ───────── Reglas de acceso (RLS) ─────────
-- Administradores: todo, en todos los tambos.
-- Propietarios/encargados: solo leen su tambo y solo escriben sus notas.
do $$
declare t text;
begin
  foreach t in array array['perfiles','tambos','miembros','lotes','categorias','vacas','lesiones','items','tarifas',
                           'jornadas','examenes','hallazgos','cargos','recetas','fotos','notas_prop']
  loop
    execute format('drop policy if exists admin_todo on public.%I', t);
    execute format('create policy admin_todo on public.%I for all to authenticated
                    using (privado.es_admin()) with check (privado.es_admin())', t);
  end loop;

  foreach t in array array['lotes','vacas','tarifas','jornadas','examenes','hallazgos','cargos','recetas','fotos','notas_prop']
  loop
    execute format('drop policy if exists miembro_lee on public.%I', t);
    execute format('create policy miembro_lee on public.%I for select to authenticated
                    using (privado.es_miembro(tambo_id))', t);
  end loop;

  foreach t in array array['categorias','lesiones','items']
  loop
    execute format('drop policy if exists todos_leen on public.%I', t);
    execute format('create policy todos_leen on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists miembro_lee on public.tambos;
create policy miembro_lee on public.tambos for select to authenticated using (privado.es_miembro(id));

drop policy if exists propio_lee on public.miembros;
create policy propio_lee on public.miembros for select to authenticated using (user_id = (select auth.uid())::text);

drop policy if exists propio_lee on public.perfiles;
create policy propio_lee on public.perfiles for select to authenticated using (id = (select auth.uid())::text);

drop policy if exists autor_crea on public.notas_prop;
create policy autor_crea on public.notas_prop for insert to authenticated
  with check (privado.es_miembro(tambo_id) and autor_id = (select auth.uid())::text);

drop policy if exists autor_edita on public.notas_prop;
create policy autor_edita on public.notas_prop for update to authenticated
  using (autor_id = (select auth.uid())::text)
  with check (privado.es_miembro(tambo_id) and autor_id = (select auth.uid())::text);

-- ───────── Acceso a las tablas desde la app ─────────
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated;
-- ───────── Fotos (Storage) ─────────
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "vakapo fotos admin" on storage.objects;
create policy "vakapo fotos admin" on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and privado.es_admin())
  with check (bucket_id = 'fotos' and privado.es_admin());

drop policy if exists "vakapo fotos miembro" on storage.objects;
create policy "vakapo fotos miembro" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and privado.es_miembro((storage.foldername(name))[1]));

-- Limpieza de versiones anteriores de este esquema
drop function if exists public.es_admin();
drop function if exists public.es_miembro(text);
drop function if exists public.nuevo_usuario();

-- ════════════════════════════════════════════════════════════════════
-- PRIMER ADMINISTRADOR: la primera cuenta creada en la app es administrador.
-- Para nombrar otro a mano (cambiando el correo):
--
--   update public.perfiles set rol = 'admin' where email = 'otro-correo@gmail.com';
--
-- ════════════════════════════════════════════════════════════════════
