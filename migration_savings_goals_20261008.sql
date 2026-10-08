-- ==========================================
-- MIGRATION : ÉPARGNE EN OBJECTIFS PERSISTANTS
-- Un objectif d'épargne n'est plus une ligne recopiée chaque mois :
-- il existe une seule fois et ses versements se cumulent d'un mois à l'autre.
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================
-- Tout est dans une transaction : si une étape échoue, rien n'est appliqué.
-- Les données d'origine sont copiées dans le schéma "backup" (non exposé par l'API).

begin;

-- 0. GARDE-FOU : ne pas rejouer la migration
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'savings' and column_name = 'start_month'
  ) then
    raise exception 'Migration déjà appliquée : la table savings a déjà une colonne start_month';
  end if;
end $$;


-- 1. SAUVEGARDE DES DONNÉES D'ORIGINE
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table backup.savings_20261008 as table public.savings;
create table backup.saving_entries_20261008 as table public.saving_entries;
create table backup.recurrence_logs_savings_20261008 as
  select * from public.recurrence_logs where table_name = 'savings';


-- 2. REGROUPEMENT : les copies mensuelles d'un même objectif (même dashboard, même nom)
--    deviennent un seul objectif. On garde la ligne du premier mois,
--    avec le nom, l'icône, la couleur et le montant du mois le plus récent.
create temp table goal_map on commit drop as
with numbered as (
  select s.*,
    first_value(s.id) over (partition by s.dashboard_id, lower(btrim(s.name)) order by s.month_date, s.created_at, s.id) as survivor_id,
    first_value(s.id) over (partition by s.dashboard_id, lower(btrim(s.name)) order by s.month_date desc, s.created_at desc, s.id desc) as latest_id,
    min(s.month_date) over (partition by s.dashboard_id, lower(btrim(s.name))) as first_month,
    max(s.month_date) over (partition by s.dashboard_id, lower(btrim(s.name))) as last_month
  from public.savings s
)
select n.id, n.survivor_id, n.first_month, n.last_month,
  l.name as latest_name, l.icon as latest_icon, l.color as latest_color, l.target_amount as latest_amount,
  -- Dernier mois de l'objectif :
  --  - objectif non récurrent, ou récurrence arrêtée (la copie du mois suivant a été créée puis supprimée) : son dernier mois existant
  --  - sinon : sa date de fin si elle était définie, ou aucune (objectif toujours en cours)
  case
    when not coalesce(l.is_recurrent, false) then n.last_month
    when exists (select 1 from public.recurrence_logs rl where rl.table_name = 'savings' and rl.source_item_id = l.id) then n.last_month
    when l.max_month is null then null
    else greatest(l.max_month, n.last_month)
  end as computed_end
from numbered n
join public.savings l on l.id = n.latest_id;

-- Les versements des copies sont rattachés à l'objectif conservé
update public.saving_entries e
set saving_id = m.survivor_id
from goal_map m
where e.saving_id = m.id and m.id <> m.survivor_id;

-- Les copies devenues inutiles sont supprimées (elles n'ont plus aucun versement)
delete from public.savings s
using goal_map m
where s.id = m.id and m.id <> m.survivor_id;


-- 3. NOUVELLE STRUCTURE DE LA TABLE
alter table public.savings rename column month_date to start_month;
alter table public.savings rename column max_month to end_month;
alter table public.savings rename column target_amount to monthly_amount;
alter table public.savings add column goal_amount numeric(12, 2);
alter table public.savings drop column is_recurrent;
alter table public.savings drop column is_hidden;

update public.savings s
set name = m.latest_name,
    icon = m.latest_icon,
    color = m.latest_color,
    monthly_amount = m.latest_amount,
    start_month = m.first_month,
    end_month = m.computed_end
from goal_map m
where s.id = m.survivor_id and m.id = m.survivor_id;

alter table public.savings
  add constraint savings_end_after_start check (end_month is null or end_month >= start_month);

comment on column public.savings.monthly_amount is 'Versement prévu chaque mois';
comment on column public.savings.goal_amount is 'Montant total à atteindre (optionnel)';
comment on column public.savings.start_month is 'Premier mois de l''objectif';
comment on column public.savings.end_month is 'Dernier mois de l''objectif (optionnel)';


-- 4. CONTRÔLE : aucun versement ne doit avoir été perdu ni modifié
do $$
declare
  before_count bigint; after_count bigint;
  before_sum numeric; after_sum numeric;
  orphans bigint;
begin
  select count(*), coalesce(sum(amount), 0) into before_count, before_sum from backup.saving_entries_20261008;
  select count(*), coalesce(sum(amount), 0) into after_count, after_sum from public.saving_entries;
  select count(*) into orphans from public.saving_entries e
    where not exists (select 1 from public.savings s where s.id = e.saving_id);
  if before_count <> after_count or before_sum <> after_sum or orphans > 0 then
    raise exception 'Contrôle des versements en échec : % lignes / % € avant, % lignes / % € après, % orphelins',
      before_count, before_sum, after_count, after_sum, orphans;
  end if;
end $$;


-- 5. RÉCURRENCE : l'épargne n'en fait plus partie
delete from public.recurrence_logs where table_name = 'savings';

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
end;
$$ language plpgsql security definer set search_path = '';

commit;

-- Vérification (optionnel) :
-- select name, monthly_amount, goal_amount, start_month, end_month from public.savings order by dashboard_id, name;
--
-- Une fois l'application vérifiée, les sauvegardes peuvent être supprimées :
-- drop table backup.savings_20261008, backup.saving_entries_20261008, backup.recurrence_logs_savings_20261008;
