-- Invitations acceptées par l'invité, et gestion des rôles des membres.
--
-- Avant : le propriétaire ajoutait directement n'importe quel compte à son dashboard,
-- sans accord, et la fonction get_user_id_by_email permettait à tout utilisateur connecté
-- de savoir si un email possédait un compte.
--
-- Après : le propriétaire crée une invitation pour un email. Elle reste en attente jusqu'à ce
-- que la personne connectée avec cet email l'accepte ou la refuse. La réponse est la même
-- que l'email ait un compte ou non.


-- 1. INVITATIONS EN ATTENTE
create table public.dashboard_invitations (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (dashboard_id, email)
);

alter table public.dashboard_invitations enable row level security;


-- 2. EMAIL CONFIRMÉ DE L'UTILISATEUR CONNECTÉ
-- Lu dans auth.users et non dans profiles : c'est l'adresse que Supabase a vérifiée.
create function public.current_user_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

revoke execute on function public.current_user_email() from public, anon;
grant execute on function public.current_user_email() to authenticated;


-- 3. DROITS SUR LES INVITATIONS : seul le propriétaire du dashboard les gère.
-- L'invité ne lit jamais cette table directement, il passe par les fonctions du point 4.
create policy "dashboard_invitations_owner_select" on public.dashboard_invitations
  for select to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid()));

create policy "dashboard_invitations_owner_insert" on public.dashboard_invitations
  for insert to authenticated
  with check (
    exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid())
    and invited_by = auth.uid()
    and email <> public.current_user_email()
  );

create policy "dashboard_invitations_owner_delete" on public.dashboard_invitations
  for delete to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid()));


-- 4. FONCTIONS DE L'INVITÉ
-- security definer : elles lisent le nom du dashboard et ajoutent le membre à la place de l'invité,
-- qui n'a encore aucun droit sur ce dashboard. Chacune vérifie que l'invitation lui est bien adressée.

-- Mes invitations en attente
create function public.get_my_invitations()
returns table (id uuid, dashboard_id uuid, dashboard_name text, invited_by_name text, role text, created_at timestamp with time zone)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.dashboard_id, d.name, coalesce(nullif(btrim(p.full_name), ''), 'Un utilisateur'), i.role, i.created_at
  from public.dashboard_invitations i
  join public.dashboards d on d.id = i.dashboard_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = public.current_user_email()
  order by i.created_at;
$$;

-- Accepter : je deviens membre avec le rôle prévu, l'invitation disparaît. Retourne l'id du dashboard.
create function public.accept_invitation(invitation_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  invitation public.dashboard_invitations;
begin
  select * into invitation from public.dashboard_invitations i
  where i.id = invitation_id and i.email = public.current_user_email();

  if not found then
    raise exception 'Invitation introuvable' using errcode = 'P0002';
  end if;

  insert into public.dashboard_members (dashboard_id, user_id, role)
  values (invitation.dashboard_id, auth.uid(), invitation.role)
  on conflict (dashboard_id, user_id) do nothing;

  delete from public.dashboard_invitations i where i.id = invitation.id;

  return invitation.dashboard_id;
end;
$$;

-- Refuser : l'invitation disparaît
create function public.decline_invitation(invitation_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.dashboard_invitations i
  where i.id = invitation_id and i.email = public.current_user_email();
$$;

revoke execute on function public.get_my_invitations() from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.get_my_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;


-- 5. MEMBRES : le propriétaire ne peut plus ajouter quelqu'un directement
drop policy "dashboard_members_owner_manage" on public.dashboard_members;

-- Création d'un dashboard : son propriétaire s'y inscrit lui-même. Tout autre ajout passe par une invitation.
create policy "dashboard_members_insert_self_as_owner" on public.dashboard_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid())
  );

-- Le propriétaire change le rôle des autres membres (éditeur <-> lecteur), jamais le sien
create policy "dashboard_members_owner_update_role" on public.dashboard_members
  for update to authenticated
  using (
    user_id <> auth.uid()
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid())
  )
  with check (
    user_id <> auth.uid()
    and role in ('editor', 'viewer')
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid())
  );

-- Le propriétaire retire les autres membres
create policy "dashboard_members_owner_remove" on public.dashboard_members
  for delete to authenticated
  using (
    user_id <> auth.uid()
    and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner_id = auth.uid())
  );

-- Un membre peut quitter un dashboard qui n'est pas le sien
create policy "dashboard_members_leave" on public.dashboard_members
  for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');


-- 6. Cette fonction révélait quels emails ont un compte : elle n'a plus d'usage
drop function public.get_user_id_by_email(text);
