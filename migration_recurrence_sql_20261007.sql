-- ==========================================
-- MIGRATION : RÉCURRENCE CÔTÉ BASE
-- Remplace la copie des éléments récurrents faite par le navigateur
-- par une fonction appelée via supabase.rpc('apply_recurrence')
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================

begin;

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

commit;
