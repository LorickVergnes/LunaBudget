-- Récurrence : rattrapage des mois jamais ouverts.
--
-- Avant : ouvrir un mois ne copiait que les éléments récurrents du mois précédent. Si ce mois
-- précédent n'avait jamais été ouvert, il était vide, et tous les récurrents disparaissaient.
--
-- Après : la fonction repart du dernier mois qui contient des données et recopie, mois par mois,
-- jusqu'au mois demandé. Les mois sautés sont donc remplis après coup.
--
-- Deux garde-fous :
--   - au-delà de 24 mois d'écart, rien n'est copié (date aberrante ou très longue absence) ;
--   - une copie créée dans un mois dont le mois suivant contient déjà des données n'est pas
--     recopiée dans ce mois suivant : l'utilisateur y avait déjà ressaisi ses éléments.

create or replace function public.apply_recurrence(dash_id uuid, for_month date)
returns void as $$
declare
  wanted_month date := date_trunc('month', for_month::timestamp)::date;  -- mois demandé
  last_filled date;   -- dernier mois avant le mois demandé qui contient des données
  cur_month date;     -- mois en cours de remplissage
  prev_month date;    -- mois d'où viennent les copies
  next_month date;
  last_day int;
  next_has_data boolean;
begin
  if not public.check_is_dashboard_member(dash_id) then
    raise exception 'Accès refusé à ce dashboard' using errcode = '42501';
  end if;

  -- Un seul appel à la fois par dashboard : deux onglets ou deux membres
  -- qui ouvrent l'application en même temps ne peuvent pas créer de doublons.
  perform pg_advisory_xact_lock(hashtextextended(dash_id::text, 0));

  select max(m) into last_filled from (
    select max(i.month_date) as m from public.incomes i where i.dashboard_id = dash_id and i.month_date < wanted_month
    union all
    select max(e.month_date) from public.expenses e where e.dashboard_id = dash_id and e.month_date < wanted_month
    union all
    select max(v.month_date) from public.envelopes v where v.dashboard_id = dash_id and v.month_date < wanted_month
  ) months;

  -- Rien avant le mois demandé, ou écart de plus de deux ans : rien à copier
  if last_filled is null or wanted_month > (last_filled + interval '24 months')::date then
    return;
  end if;

  cur_month := (last_filled + interval '1 month')::date;

  while cur_month <= wanted_month loop
    prev_month := (cur_month - interval '1 month')::date;
    next_month := (cur_month + interval '1 month')::date;
    last_day := extract(day from (cur_month + interval '1 month - 1 day'))::int;

    -- Revenus (la date garde le même jour du mois, borné au dernier jour)
    next_has_data := exists (select 1 from public.incomes i where i.dashboard_id = dash_id and i.month_date = next_month);
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
      returning id, user_id
    ), log_sources as (
      insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
      select s.user_id, dash_id, 'incomes', s.id, cur_month from src s
      on conflict do nothing
    )
    -- Le mois suivant existe déjà : ces copies n'ont pas à y être recopiées
    insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
    select n.user_id, dash_id, 'incomes', n.id, next_month from ins n where next_has_data
    on conflict do nothing;

    -- Dépenses fixes
    next_has_data := exists (select 1 from public.expenses e where e.dashboard_id = dash_id and e.month_date = next_month);
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
      returning id, user_id
    ), log_sources as (
      insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
      select s.user_id, dash_id, 'expenses', s.id, cur_month from src s
      on conflict do nothing
    )
    insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
    select n.user_id, dash_id, 'expenses', n.id, next_month from ins n where next_has_data
    on conflict do nothing;

    -- Enveloppes
    next_has_data := exists (select 1 from public.envelopes v where v.dashboard_id = dash_id and v.month_date = next_month);
    with src as (
      select v.* from public.envelopes v
      where v.dashboard_id = dash_id and v.month_date = prev_month and v.is_recurrent
      and not exists (
        select 1 from public.recurrence_logs l
        where l.dashboard_id = dash_id and l.table_name = 'envelopes'
        and l.source_item_id = v.id and l.target_month = cur_month
      )
    ), ins as (
      insert into public.envelopes (user_id, dashboard_id, name, is_recurrent, is_hidden, icon, color, max_amount, month_date)
      select s.user_id, s.dashboard_id, s.name, true, false, s.icon, s.color, s.max_amount, cur_month
      from src s
      returning id, user_id
    ), log_sources as (
      insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
      select s.user_id, dash_id, 'envelopes', s.id, cur_month from src s
      on conflict do nothing
    )
    insert into public.recurrence_logs (user_id, dashboard_id, table_name, source_item_id, target_month)
    select n.user_id, dash_id, 'envelopes', n.id, next_month from ins n where next_has_data
    on conflict do nothing;

    cur_month := next_month;
  end loop;
end;
$$ language plpgsql security definer set search_path = '';
