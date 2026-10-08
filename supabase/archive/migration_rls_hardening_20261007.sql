-- ==========================================
-- MIGRATION : DURCISSEMENT RLS
-- (colonnes protégées sur profiles, rôles owner/editor/viewer, with check)
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================
-- Tout est dans une transaction : si une étape échoue, rien n'est appliqué.

begin;

-- 1. RÔLES DES MEMBRES : valeurs contrôlées par la base
update public.dashboard_members set role = 'editor' where role is null;
alter table public.dashboard_members alter column role set not null;
alter table public.dashboard_members drop constraint if exists dashboard_members_role_check;
alter table public.dashboard_members
  add constraint dashboard_members_role_check check (role in ('owner', 'editor', 'viewer'));


-- 2. FONCTIONS SÉCURISÉES
-- "set search_path = ''" : une fonction security definer ne doit jamais dépendre
-- du search_path de l'appelant (tous les objets sont donc préfixés par leur schéma).

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

-- Vérifier que l'utilisateur connecté a l'un des rôles donnés sur un dashboard
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


-- 3. PROFILES : droits par colonne
-- La RLS filtre des lignes, pas des colonnes. Sans ça, un utilisateur peut modifier
-- son propre "role" (free -> premium) ou son "email" depuis le navigateur.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;


-- 4. SUPPRESSION DE TOUTES LES ANCIENNES POLITIQUES
-- (par lecture de pg_policies, pour ne pas dépendre des noms réellement présents en base)
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
    and tablename in (
      'profiles', 'dashboards', 'dashboard_members', 'envelopes', 'incomes', 'savings',
      'expenses', 'envelope_expenses', 'saving_entries', 'recurrence_logs'
    )
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;


-- 5. NOUVELLES POLITIQUES

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

commit;

-- Vérification (optionnel) :
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
