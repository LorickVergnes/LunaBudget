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
  role text default 'editor', -- 'owner', 'editor', 'viewer'
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
$$ language plpgsql security definer;

-- 2. Trouver un ID utilisateur par son email (Sans exposer la table profiles)
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
$$ language plpgsql security definer;

grant execute on function public.get_user_id_by_email(text) to authenticated;


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

-- 1. Politiques Profiles
create policy "Users can only access their own profile" on profiles for all using (auth.uid() = id);
create policy "View fellow members profiles" on public.profiles
  for select using (
    id = auth.uid()
    or 
    exists (
      select 1 from public.dashboard_members
      where user_id = public.profiles.id
      and public.check_is_dashboard_member(dashboard_id)
    )
  );

-- 2. Politiques Dashboards
create policy "dashboards_select" on dashboards for select 
  using (owner_id = auth.uid() or public.check_is_dashboard_member(id));
create policy "dashboards_owner_manage" on dashboards for all 
  using (owner_id = auth.uid());

-- 3. Politiques Dashboard Members
create policy "dashboard_members_select" on dashboard_members for select 
  using (user_id = auth.uid() or public.check_is_dashboard_member(dashboard_id));
create policy "dashboard_members_owner_manage" on dashboard_members for all 
  using (exists (select 1 from dashboards where id = dashboard_members.dashboard_id and owner_id = auth.uid()));

-- 4. Politiques Données Financières (Filtrées par dashboard_id)
create policy "Members can access envelopes" on envelopes for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access incomes" on incomes for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access savings" on savings for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access expenses" on expenses for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access envelope_expenses" on envelope_expenses for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access saving_entries" on saving_entries for all
  using (public.check_is_dashboard_member(dashboard_id));
create policy "Members can access recurrence_logs" on recurrence_logs for all
  using (public.check_is_dashboard_member(dashboard_id));


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
