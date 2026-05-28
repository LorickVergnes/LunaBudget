-- ==========================================
-- SCRIPT DE CRÉATION DE LA BASE DE DONNÉES
-- LUNABUDGET - FULL SCHEMA
-- ==========================================

-- Nettoyage des anciennes tables pour repartir sur une base saine
-- L'utilisation de CASCADE permet de supprimer les tables même si d'autres objets (vues, contraintes) en dépendent.
drop table if exists recurrence_logs cascade;
drop table if exists envelope_expenses cascade;
drop table if exists saving_entries cascade;
drop table if exists expenses cascade;
drop table if exists incomes cascade;
drop table if exists savings cascade;
drop table if exists envelopes cascade;
drop table if exists profiles cascade;

-- 1. PROFILS UTILISATEURS (Table de base liée à Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default now()
);

-- 2. ENVELOPPES (Système de "Buckets" mensuels avec seuil)
create table envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  is_recurrent boolean default false,
  is_hidden boolean default false, -- Pour masquer l'élément sans le supprimer (gestion des récurrences)
  icon text default 'Wallet',
  color text default '#3b82f6',
  max_amount numeric(12, 2) not null default 0, -- Seuil à ne pas dépasser
  month_date date not null, -- Format YYYY-MM-01 (ex: 2026-03-01) pour identifier le mois
  created_at timestamp with time zone default now()
);

-- 3. REVENUS (Entrées d'argent mensuelles)
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'ArrowUpCircle',
  color text default '#10b981',
  month_date date not null, -- Format YYYY-MM-01
  created_at timestamp with time zone default now()
);

-- 4. ÉPARGNE (Objectifs d'épargne mensuels)
create table savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'PiggyBank',
  color text default '#8b5cf6',
  target_amount numeric(12, 2) not null default 0, -- Montant objectif par mois
  month_date date not null, -- Format YYYY-MM-01
  max_month date, -- Format YYYY-MM-01 (Optionnel : date de fin de la récurrence)
  created_at timestamp with time zone default now()
);

-- 5. DÉPENSES FIXES (Sorties d'argent non liées à une enveloppe : loyer, abonnements...)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  is_recurrent boolean default false,
  is_hidden boolean default false,
  icon text default 'ArrowDownCircle',
  color text default '#ef4444',
  month_date date not null, -- Format YYYY-MM-01
  created_at timestamp with time zone default now()
);

-- 6. DÉPENSES D'ENVELOPPE (Sorties d'argent consommant le budget d'une enveloppe)
create table envelope_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  envelope_id uuid references envelopes(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  icon text default 'ShoppingCart',
  color text default '#3b82f6',
  month_date date not null, -- Format YYYY-MM-01
  created_at timestamp with time zone default now()
);

-- 7. VERSEMENTS D'ÉPARGNE (Contributions à un objectif d'épargne)
create table saving_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade not null,
    saving_id uuid references savings(id) on delete cascade not null,
    amount numeric(12, 2) not null,
    date date not null default current_date,
    month_date date not null, -- Format YYYY-MM-01
    created_at timestamp with time zone default now()
);

-- 8. LOGS DE RÉCURRENCE (Évite les doublons lors de la copie automatique d'un mois à l'autre)
create table recurrence_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade not null,
    table_name text not null,
    source_item_id uuid not null, -- ID de l'élément d'origine du mois précédent
    target_month date not null, -- Mois pour lequel la récurrence a été appliquée
    created_at timestamp with time zone default now(),
    unique(user_id, table_name, source_item_id, target_month)
);


-- ==========================================
-- SÉCURITÉ RLS (Row Level Security)
-- ==========================================

alter table profiles enable row level security;
alter table envelopes enable row level security;
alter table incomes enable row level security;
alter table savings enable row level security;
alter table expenses enable row level security;
alter table envelope_expenses enable row level security;
alter table saving_entries enable row level security;
alter table recurrence_logs enable row level security;

-- Création des politiques : Seul le propriétaire peut lire/écrire ses données
create policy "Users can only access their own profile" on profiles for all using (auth.uid() = id);
create policy "Users can only access their own envelopes" on envelopes for all using (auth.uid() = user_id);
create policy "Users can only access their own incomes" on incomes for all using (auth.uid() = user_id);
create policy "Users can only access their own savings" on savings for all using (auth.uid() = user_id);
create policy "Users can only access their own expenses" on expenses for all using (auth.uid() = user_id);
create policy "Users can only access their own envelope_expenses" on envelope_expenses for all using (auth.uid() = user_id);
create policy "Users can only access their own saving_entries" on saving_entries for all using (auth.uid() = user_id);
create policy "Users can only access their own recurrence_logs" on recurrence_logs for all using (auth.uid() = user_id);


-- ==========================================
-- AUTOMATISATION DU PROFIL (Triggers)
-- ==========================================

-- Fonction pour créer un profil automatiquement lors d'une nouvelle inscription Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger déclenché APRÈS l'insertion dans auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
