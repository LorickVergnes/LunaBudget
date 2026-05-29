-- ==========================================
-- MIGRATION : MULTI-DASHBOARD & SHARING
-- ==========================================

-- 1. CRÉATION DE LA TABLE DASHBOARDS
create table if not exists dashboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now()
);

-- 2. TABLE DE LIAISON POUR LES MEMBRES
create table if not exists dashboard_members (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references dashboards(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role text default 'editor', -- 'owner', 'editor', 'viewer'
  joined_at timestamp with time zone default now(),
  unique(dashboard_id, user_id)
);

-- 3. AJOUT DE LA COLONNE dashboard_id DANS TOUTES LES TABLES FINANCIÈRES
alter table envelopes add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table incomes add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table savings add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table expenses add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table envelope_expenses add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table saving_entries add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;
alter table recurrence_logs add column if not exists dashboard_id uuid references dashboards(id) on delete cascade;

-- 4. MIGRATION DES DONNÉES EXISTANTES
-- Pour chaque utilisateur, on crée un dashboard par défaut s'il n'en a pas déjà
do $$
declare
    user_record record;
    new_dashboard_id uuid;
begin
    for user_record in select id, full_name from profiles loop
        -- Vérifier si l'utilisateur a déjà un dashboard
        if not exists (select 1 from dashboard_members where user_id = user_record.id) then
            -- Créer le dashboard
            insert into dashboards (name, owner_id)
            values ('Mon Budget', user_record.id)
            returning id into new_dashboard_id;

            -- Ajouter l'utilisateur comme owner dans dashboard_members
            insert into dashboard_members (dashboard_id, user_id, role)
            values (new_dashboard_id, user_record.id, 'owner');

            -- Lier toutes ses données à ce nouveau dashboard
            update envelopes set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update incomes set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update savings set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update expenses set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update envelope_expenses set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update saving_entries set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
            update recurrence_logs set dashboard_id = new_dashboard_id where user_id = user_record.id and dashboard_id is null;
        end if;
    end loop;
end $$;

-- 5. MISE À JOUR DE LA FONCTION handle_new_user POUR LES FUTURS UTILISATEURS
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

-- 6. MISE À JOUR DE LA SÉCURITÉ RLS
-- On active RLS sur dashboards et dashboard_members
alter table dashboards enable row level security;
alter table dashboard_members enable row level security;

-- Politiques pour Dashboards
drop policy if exists "Users can see dashboards they are members of" on dashboards;
create policy "Users can see dashboards they are members of" on dashboards
  for select using (
    exists (
      select 1 from dashboard_members 
      where dashboard_members.dashboard_id = dashboards.id 
      and dashboard_members.user_id = auth.uid()
    )
  );

drop policy if exists "Owners can update their dashboards" on dashboards;
create policy "Owners can update their dashboards" on dashboards
  for update using (owner_id = auth.uid());

-- Politiques pour Dashboard Members
drop policy if exists "Members can see other members of their dashboards" on dashboard_members;
create policy "Members can see other members of their dashboards" on dashboard_members
  for select using (
    exists (
      select 1 from dashboard_members as self
      where self.dashboard_id = dashboard_members.dashboard_id 
      and self.user_id = auth.uid()
    )
  );

-- Nouvelles politiques pour les tables financières basées sur l'appartenance au dashboard
-- Supprimer les anciennes politiques basées sur user_id (ajuster selon les noms exacts dans ta DB)
drop policy if exists "Users can only access their own envelopes" on envelopes;
drop policy if exists "Users can only access their own incomes" on incomes;
drop policy if exists "Users can only access their own savings" on savings;
drop policy if exists "Users can only access their own expenses" on expenses;
drop policy if exists "Users can only access their own envelope_expenses" on envelope_expenses;
drop policy if exists "Users can only access their own saving_entries" on saving_entries;
drop policy if exists "Users can only access their own recurrence_logs" on recurrence_logs;

-- Créer les nouvelles politiques (Note: Elles utilisent dashboard_id)
create policy "Members can access envelopes" on envelopes for all
  using (exists (select 1 from dashboard_members where dashboard_id = envelopes.dashboard_id and user_id = auth.uid()));

create policy "Members can access incomes" on incomes for all
  using (exists (select 1 from dashboard_members where dashboard_id = incomes.dashboard_id and user_id = auth.uid()));

create policy "Members can access savings" on savings for all
  using (exists (select 1 from dashboard_members where dashboard_id = savings.dashboard_id and user_id = auth.uid()));

create policy "Members can access expenses" on expenses for all
  using (exists (select 1 from dashboard_members where dashboard_id = expenses.dashboard_id and user_id = auth.uid()));

create policy "Members can access envelope_expenses" on envelope_expenses for all
  using (exists (select 1 from dashboard_members where dashboard_id = envelope_expenses.dashboard_id and user_id = auth.uid()));

create policy "Members can access saving_entries" on saving_entries for all
  using (exists (select 1 from dashboard_members where dashboard_id = saving_entries.dashboard_id and user_id = auth.uid()));

create policy "Members can access recurrence_logs" on recurrence_logs for all
  using (exists (select 1 from dashboard_members where dashboard_id = recurrence_logs.dashboard_id and user_id = auth.uid()));
