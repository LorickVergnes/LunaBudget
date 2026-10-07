-- ==========================================
-- SCRIPT DE CRÉATION DE LA BASE DE DONNÉES
-- LUNABUDGET - FULL SCHEMA (Updated with Dashboards & Collaboration)
-- ==========================================

-- Nettoyage des anciennes tables pour repartir sur une base saine
drop table if exists recurrence_logs cascade;
drop table if exists envelope_expenses cascade;
drop table if exists saving_entries cascade;
drop table if exists expenses cascade;
drop table if exists incomes cascade;
drop table if exists savings cascade;
drop table if exists envelopes cascade;
drop table if exists dashboard_members cascade;
drop table if exists dashboards cascade;
drop table if exists profiles cascade;

-- 1. PROFILS UTILISATEURS (Table de base liée à Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  avatar_url text,
  role text default 'free',
  updated_at timestamp with time zone default now()
);

-- 2. DASHBOARDS (Espaces de travail partagés)
create table dashboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now()
);

-- 3. MEMBRES DES DASHBOARDS (Table de liaison)
create table dashboard_members (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamp with time zone default now(),
  unique(dashboard_id, user_id)
);

-- 4. ENVELOPPES
create table envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  name text not null,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'Wallet',
  color text default '#3b82f6',
  max_amount numeric(12, 2) not null default 0,
  month_date date not null,
  created_at timestamp with time zone default now()
);

-- 5. REVENUS
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'ArrowUpCircle',
  color text default '#10b981',
  month_date date not null,
  created_at timestamp with time zone default now()
);

-- 6. ÉPARGNE (Objectifs)
create table savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  name text not null,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'PiggyBank',
  color text default '#8b5cf6',
  target_amount numeric(12, 2) not null default 0,
  month_date date not null,
  max_month date,
  created_at timestamp with time zone default now()
);

-- 7. DÉPENSES FIXES
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'ArrowDownCircle',
  color text default '#ef4444',
  month_date date not null,
  created_at timestamp with time zone default now()
);

-- 8. DÉPENSES D'ENVELOPPE
create table envelope_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  envelope_id uuid references envelopes(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  icon text default 'ShoppingCart',
  color text default '#3b82f6',
  month_date date not null,
  created_at timestamp with time zone default now()
);

-- 9. VERSEMENTS D'ÉPARGNE
create table saving_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade not null,
    dashboard_id uuid references dashboards(id) on delete cascade not null,
    saving_id uuid references savings(id) on delete cascade not null,
    amount numeric(12, 2) not null,
    date date not null default current_date,
    month_date date not null,
    created_at timestamp with time zone default now()
);

-- 10. LOGS DE RÉCURRENCE
create table recurrence_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade not null,
    dashboard_id uuid references dashboards(id) on delete cascade not null,
    table_name text not null,
    source_item_id uuid not null,
    target_month date not null,
    created_at timestamp with time zone default now(),
    unique(user_id, table_name, source_item_id, target_month)
);


-- ==========================================
-- FONCTIONS SÉCURISÉES (Anti-Recursion & Tools)
-- ==========================================
-- "set search_path = ''" : une fonction security definer ne doit jamais dépendre
-- du search_path de l'appelant (tous les objets sont donc préfixés par leur schéma).

-- 1. Vérifier si un utilisateur est membre d'un dashboard (Casse la récursion RLS)
create or replace function public.check_is_dashboard_member(dash_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.dashboard_members
    where dashboard_id = dash_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql stable security definer set search_path = '';

-- 2. Vérifier que l'utilisateur connecté a l'un des rôles donnés sur un dashboard
create or replace function public.has_dashboard_role(dash_id uuid, allowed_roles text[])
returns boolean as $$
begin
  return exists (
    select 1 from public.dashboard_members
    where dashboard_id = dash_id
    and user_id = auth.uid()
    and role = any(allowed_roles)
  );
end;
$$ language plpgsql stable security definer set search_path = '';

-- 3. Trouver un ID utilisateur par son email (Sans exposer la table profiles)
create or replace function public.get_user_id_by_email(target_email text)
returns uuid as $$
declare
    found_id uuid;
begin
    select id into found_id
    from public.profiles
    where email = lower(target_email);
    return found_id;
end;
$$ language plpgsql stable security definer set search_path = '';

-- Par défaut une fonction est appelable par tout le monde, y compris sans être connecté
revoke execute on function public.get_user_id_by_email(text) from public, anon;
grant execute on function public.get_user_id_by_email(text) to authenticated;

-- 4. Récurrence
-- Copie les éléments récurrents du mois précédent vers le mois demandé.
-- Tout se passe dans une seule transaction : soit tout est copié, soit rien.
-- security definer : n'importe quel membre (même lecteur) peut déclencher la copie,
-- la fonction vérifie elle-même l'appartenance au dashboard.
create or replace function public.apply_recurrence(dash_id uuid, for_month date)
returns void as $$
declare
  cur_month date := date_trunc('month', for_month::timestamp)::date;
  prev_month date := (date_trunc('month', for_month::timestamp) - interval '1 month')::date;
  last_day int := extract(day from (date_trunc('month', for_month::timestamp) + interval '1 month - 1 day'))::int;
begin
  if not public.check_is_dashboard_member(dash_id) then
    raise exception 'Accès refusé à ce dashboard' using errcode = '42501';
  end if;

  -- Un seul appel à la fois par dashboard et par mois : deux onglets ou deux membres
  -- qui ouvrent le même mois en même temps ne peuvent plus créer de doublons.
  perform pg_advisory_xact_lock(hashtextextended(dash_id::text || ':' || cur_month::text, 0));

  -- Revenus (la date garde le même jour du mois, borné au dernier jour)
  with src as (
    select i.* from public.incomes i
    where i.dashboard_id = dash_id and i.month_date = prev_month and i.is_recurrent
    and not exists (
      select 1 from public.recurrence_logs l
      where l.dashboard_id = dash_id and l.table_name = 'incomes'
      and l.source_item_id = i.id and l.target_month = cur_month
    )
  ), ins as (
    insert into public.incomes (user_id, dashboard_id, name, amount, date, is_recurrent, is_hidden, icon, color, month_date)
    select s.user_id, s.dashboard_id, s.name, s.amount,
           cur_month + (least(extract(day from s.date)::int, last_day) - 1),
           true, false, s.icon, s.color, cur_month
    from src s
  )
  insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
  select s.user_id, dash_id, 'incomes', s.id, cur_month from src s
  on conflict do nothing;

  -- Dépenses fixes
  with src as (
    select e.* from public.expenses e
    where e.dashboard_id = dash_id and e.month_date = prev_month and e.is_recurrent
    and not exists (
      select 1 from public.recurrence_logs l
      where l.dashboard_id = dash_id and l.table_name = 'expenses'
      and l.source_item_id = e.id and l.target_month = cur_month
    )
  ), ins as (
    insert into public.expenses (user_id, dashboard_id, name, amount, date, is_recurrent, is_hidden, icon, color, month_date)
    select s.user_id, s.dashboard_id, s.name, s.amount,
           cur_month + (least(extract(day from s.date)::int, last_day) - 1),
           true, false, s.icon, s.color, cur_month
    from src s
  )
  insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
  select s.user_id, dash_id, 'expenses', s.id, cur_month from src s
  on conflict do nothing;

  -- Enveloppes
  with src as (
    select e.* from public.envelopes e
    where e.dashboard_id = dash_id and e.month_date = prev_month and e.is_recurrent
    and not exists (
      select 1 from public.recurrence_logs l
      where l.dashboard_id = dash_id and l.table_name = 'envelopes'
      and l.source_item_id = e.id and l.target_month = cur_month
    )
  ), ins as (
    insert into public.envelopes (user_id, dashboard_id, name, is_recurrent, is_hidden, icon, color, max_amount, month_date)
    select s.user_id, s.dashboard_id, s.name, true, false, s.icon, s.color, s.max_amount, cur_month
    from src s
  )
  insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
  select s.user_id, dash_id, 'envelopes', s.id, cur_month from src s
  on conflict do nothing;

  -- Épargne (s'arrête après max_month s'il est défini)
  with src as (
    select sv.* from public.savings sv
    where sv.dashboard_id = dash_id and sv.month_date = prev_month and sv.is_recurrent
    and (sv.max_month is null or cur_month <= sv.max_month)
    and not exists (
      select 1 from public.recurrence_logs l
      where l.dashboard_id = dash_id and l.table_name = 'savings'
      and l.source_item_id = sv.id and l.target_month = cur_month
    )
  ), ins as (
    insert into public.savings (user_id, dashboard_id, name, is_recurrent, is_hidden, icon, color, target_amount, month_date, max_month)
    select s.user_id, s.dashboard_id, s.name, true, false, s.icon, s.color, s.target_amount, cur_month, s.max_month
    from src s
  )
  insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
  select s.user_id, dash_id, 'savings', s.id, cur_month from src s
  on conflict do nothing;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.apply_recurrence(uuid, date) from public, anon;
grant execute on function public.apply_recurrence(uuid, date) to authenticated;


-- ==========================================
-- SÉCURITÉ RLS (Row Level Security)
-- ==========================================

alter table profiles enable row level security;
alter table dashboards enable row level security;
alter table dashboard_members enable row level security;
alter table envelopes enable row level security;
alter table incomes enable row level security;
alter table savings enable row level security;
alter table expenses enable row level security;
alter table envelope_expenses enable row level security;
alter table saving_entries enable row level security;
alter table recurrence_logs enable row level security;

-- Droits par colonne sur profiles : la RLS filtre des lignes, pas des colonnes.
-- Sans ça, un utilisateur peut modifier son propre "role" ou son "email" depuis le navigateur.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;

-- Profiles : lecture de son profil et de ceux des membres de ses dashboards,
-- modification de son propre profil uniquement (colonnes limitées par le grant ci-dessus)
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.dashboard_members
      where user_id = public.profiles.id
      and public.check_is_dashboard_member(dashboard_id)
    )
  );
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Dashboards
create policy "dashboards_select" on public.dashboards for select to authenticated
  using (owner_id = auth.uid() or public.check_is_dashboard_member(id));
create policy "dashboards_owner_manage" on public.dashboards for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Dashboard Members
create policy "dashboard_members_select" on public.dashboard_members for select to authenticated
  using (user_id = auth.uid() or public.check_is_dashboard_member(dashboard_id));
create policy "dashboard_members_owner_manage" on public.dashboard_members for all to authenticated
  using (exists (select 1 from public.dashboards where id = dashboard_members.dashboard_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.dashboards where id = dashboard_members.dashboard_id and owner_id = auth.uid()));

-- Données financières : tous les membres lisent, seuls owner/editor écrivent,
-- et on ne peut créer une ligne qu'en son propre nom.
do $$
declare
  t text;
begin
  foreach t in array array[
    'envelopes', 'incomes', 'savings', 'expenses',
    'envelope_expenses', 'saving_entries', 'recurrence_logs'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.check_is_dashboard_member(dashboard_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.has_dashboard_role(dashboard_id, array[''owner'', ''editor'']) and user_id = auth.uid())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.has_dashboard_role(dashboard_id, array[''owner'', ''editor'']))
         with check (public.has_dashboard_role(dashboard_id, array[''owner'', ''editor'']))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.has_dashboard_role(dashboard_id, array[''owner'', ''editor'']))',
      t || '_delete', t);
  end loop;
end $$;


-- ==========================================
-- AUTOMATISATION (Triggers)
-- ==========================================

-- Fonction pour créer un profil ET un dashboard par défaut lors d'une inscription
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_dashboard_id uuid;
begin
  -- 1. Créer le profil
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'free');

  -- 2. Créer le dashboard par défaut
  insert into public.dashboards (name, owner_id)
  values ('Mon Budget', new.id)
  returning id into new_dashboard_id;

  -- 3. Ajouter l'utilisateur comme owner du dashboard
  insert into public.dashboard_members (dashboard_id, user_id, role)
  values (new_dashboard_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

-- Trigger auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
