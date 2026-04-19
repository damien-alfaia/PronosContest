-- =============================================================
--  Sprint 1 — Profils utilisateurs (extension de auth.users)
-- =============================================================
--
--  - enum user_role (user | admin)
--  - table profiles (1:1 avec auth.users)
--  - trigger handle_new_user() : crée un profile auto à l'inscription
--  - trigger set_updated_at() : maintient updated_at
--  - RLS : chaque user ne voit que son propre profil en lecture/écriture
--
-- =============================================================

-- ---------- ENUMS ----------
create type public.user_role as enum ('user', 'admin');

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  prenom text,
  nom text,
  avatar_url text,
  role public.user_role not null default 'user',
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles(email);

comment on table public.profiles is 'Profils utilisateurs (étend auth.users)';
comment on column public.profiles.role is 'Rôle applicatif (admin/user), indépendant du rôle Postgres';
comment on column public.profiles.locale is 'Code langue ISO 639-1 (fr, en, ...)';

-- ---------- HELPERS ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Trigger : crée automatiquement un profile quand un user est créé dans auth.users
-- (security definer pour pouvoir insérer malgré RLS sur `profiles`)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, prenom, nom, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'locale', 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.profiles enable row level security;

-- Lecture : chacun voit son propre profil
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Update : chacun peut modifier son propre profil
-- (le rôle ne peut pas être escaladé côté client : voir check plus bas)
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- empêche un user de se promouvoir admin
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Pas de policy INSERT : l'insertion passe exclusivement par le trigger
-- handle_new_user() en security definer.
-- Pas de policy DELETE : suppression cascade via auth.users.
