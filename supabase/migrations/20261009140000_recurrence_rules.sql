-- Récurrences : des règles, plus des copies de proche en proche.
--
-- Avant : un élément récurrent n'existait nulle part. C'était une ligne cochée « récurrent »,
-- recopiée chaque mois à partir de celle du mois précédent. Conséquences :
--   - modifier un montant ne corrigeait pas les mois suivants déjà créés ;
--   - « arrêter la récurrence » laissait les copies des mois suivants ;
--   - impossible d'avoir une autre fréquence que mensuelle, ni une date de fin.
--
-- Après : chaque récurrence est une règle (table recurrences) enregistrée une seule fois, comme le sont
-- déjà les objectifs d'épargne. Les lignes de chaque mois restent de vraies lignes dans incomes,
-- expenses et envelopes, créées à l'ouverture du mois, et chacune pointe vers sa règle (recurrence_id).
-- Une règle ne peut avoir qu'une ligne par mois : les doublons sont impossibles par construction.
--
-- Rien n'est supprimé : la colonne is_recurrent et la table recurrence_logs restent en place
-- (elles ne sont plus lues par l'application) et seront retirées dans une migration ultérieure.


-- 1. LES RÈGLES
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  -- Créateur de la règle (vide si son compte a été supprimé)
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('income', 'expense', 'envelope')),
  name text not null,
  -- Montant du revenu ou de la dépense, ou plafond de l'enveloppe
  amount numeric(12,2) not null,
  -- Jour de l'opération dans le mois, ramené au dernier jour pour les mois plus courts
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  icon text,
  color text,
  -- Une occurrence tous les N mois, comptés à partir de start_month
  interval_months integer not null default 1 check (interval_months in (1, 2, 3, 6, 12)),
  start_month date not null,
  -- Dernier mois inclus (vide = sans fin)
  end_month date,
  -- Dernier mois pour lequel les lignes ont été créées. La création ne revient jamais en arrière :
  -- une ligne retirée d'un mois déjà traité ne réapparaît pas.
  materialized_until date,
  created_at timestamp with time zone not null default now(),
  constraint recurrences_end_after_start check (end_month is null or end_month >= start_month)
);

comment on table public.recurrences is 'Règles de récurrence des revenus, dépenses fixes et enveloppes';

create index recurrences_dashboard_idx on public.recurrences (dashboard_id);

alter table public.recurrences enable row level security;

-- Lecture pour tous les membres. Les écritures passent uniquement par les fonctions ci-dessous,
-- qui modifient la règle et ses lignes ensemble.
create policy "recurrences_select" on public.recurrences
  for select to authenticated
  using (public.check_is_dashboard_member(dashboard_id));

revoke all on table public.recurrences from anon;
revoke insert, update, delete, truncate on table public.recurrences from authenticated;


-- 2. LIEN ENTRE UNE LIGNE ET SA RÈGLE
-- Si la règle est supprimée, ses lignes restent et redeviennent des lignes ordinaires.
alter table public.incomes add column recurrence_id uuid references public.recurrences(id) on delete set null;
alter table public.expenses add column recurrence_id uuid references public.recurrences(id) on delete set null;
alter table public.envelopes add column recurrence_id uuid references public.recurrences(id) on delete set null;

-- Une règle, un mois, une ligne (les lignes sans règle ne sont pas concernées)
create unique index incomes_recurrence_month_key on public.incomes (recurrence_id, month_date);
create unique index expenses_recurrence_month_key on public.expenses (recurrence_id, month_date);
create unique index envelopes_recurrence_month_key on public.envelopes (recurrence_id, month_date);


-- 3. REPRISE DES RÉCURRENCES EXISTANTES
-- L'historique ne dit pas quelle copie vient de quelle ligne : on reconstitue une règle par nom
-- d'élément récurrent dans un dashboard. Deux éléments de même nom dans le même mois (deux « Salaire »)
-- donnent deux règles, appariées d'un mois à l'autre par montant croissant.
--   - valeurs de la règle : celles de l'occurrence la plus récente ;
--   - jour du mois : celui de cette occurrence, sauf en fin de mois (28 et plus) où l'on reprend le jour
--     le plus élevé de l'historique : l'ancien système recopiait un 31 en 30 puis en 28 au fil des mois ;
--   - règle encore active si cette occurrence est dans le dernier mois rempli du dashboard,
--     sinon elle se termine au mois de cette occurrence ;
--   - les éléments à montant négatif ne sont pas repris (ils restent des lignes ordinaires).
do $$
declare
  src record;
begin
  for src in
    select * from (values
      ('incomes', 'income', 'amount', true),
      ('expenses', 'expense', 'amount', true),
      ('envelopes', 'envelope', 'max_amount', false)
    ) as t(table_name, kind, amount_column, has_date)
  loop
    execute format($sql$
      create temp table recurrence_chain on commit drop as
      with ranked as (
        select s.id, s.dashboard_id, lower(btrim(s.name)) as name_key, s.month_date, %3$s as day,
               row_number() over (
                 partition by s.dashboard_id, lower(btrim(s.name)), s.month_date
                 order by s.%1$I, s.created_at, s.id
               ) as slot
        from public.%2$I s
        where s.is_recurrent and s.dashboard_id is not null and s.%1$I >= 0
      ),
      chains as (
        select r.dashboard_id, r.name_key, r.slot, gen_random_uuid() as rule_id,
               min(r.month_date) as first_month, max(r.month_date) as last_month, max(r.day) as highest_day
        from ranked r
        group by r.dashboard_id, r.name_key, r.slot
      )
      select r.id as row_id, r.month_date, r.day, c.rule_id, c.first_month, c.last_month, c.highest_day
      from ranked r
      join chains c on c.dashboard_id = r.dashboard_id and c.name_key = r.name_key and c.slot = r.slot
    $sql$, src.amount_column, src.table_name,
      case when src.has_date then 'extract(day from s.date)::int' else '1' end);

    execute format($sql$
      insert into public.recurrences
        (id, dashboard_id, user_id, kind, name, amount, day_of_month, icon, color, start_month, end_month, materialized_until)
      select c.rule_id, s.dashboard_id, s.user_id, %3$L, btrim(s.name), s.%1$I,
             case when c.day >= 28 then c.highest_day else c.day end, s.icon, s.color,
             c.first_month,
             case when c.last_month < latest.month_date then c.last_month end,
             c.last_month
      from recurrence_chain c
      join public.%2$I s on s.id = c.row_id
      join (
        select t.dashboard_id, max(t.month_date) as month_date from public.%2$I t group by t.dashboard_id
      ) latest on latest.dashboard_id = s.dashboard_id
      where c.month_date = c.last_month
    $sql$, src.amount_column, src.table_name, src.kind);

    execute format($sql$
      update public.%1$I s set recurrence_id = c.rule_id
      from recurrence_chain c
      where s.id = c.row_id
    $sql$, src.table_name);

    drop table recurrence_chain;
  end loop;
end;
$$;

-- Garde-fous sur les règles, posés après la reprise : ils valent pour toute nouvelle écriture
alter table public.recurrences
  add constraint recurrences_amount_positive check (amount >= 0) not valid,
  add constraint recurrences_start_is_month check (start_month = date_trunc('month', start_month::timestamp)::date) not valid,
  add constraint recurrences_end_is_month check (end_month is null or end_month = date_trunc('month', end_month::timestamp)::date) not valid;


-- 4. CRÉATION DES LIGNES D'UN MOIS
-- Fonction interne : crée, pour chaque règle du dashboard, les lignes manquantes jusqu'au mois demandé.
create function public.materialize_recurrences(dash_id uuid, until_month date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  -- Après une très longue absence, on ne remplit pas plus de deux ans en arrière
  earliest date := (until_month - interval '23 months')::date;
begin
  -- Un seul appel à la fois par dashboard : deux onglets ou deux membres
  -- qui ouvrent l'application en même temps ne se marchent pas dessus.
  perform pg_advisory_xact_lock(hashtextextended(dash_id::text, 0));

  -- Revenus (la date garde le même jour du mois, borné au dernier jour)
  insert into public.incomes (user_id, dashboard_id, name, amount, date, is_recurrent, is_hidden, icon, color, month_date, recurrence_id)
  select r.user_id, r.dashboard_id, r.name, r.amount,
         d.month + (least(r.day_of_month, extract(day from (d.month + interval '1 month - 1 day'))::int) - 1),
         true, false, r.icon, r.color, d.month, r.id
  from public.recurrences r
  cross join lateral (
    select g::date as month
    from generate_series(
      greatest(r.start_month, coalesce((r.materialized_until + interval '1 month')::date, r.start_month), earliest)::timestamp,
      least(until_month, coalesce(r.end_month, until_month))::timestamp,
      interval '1 month') g
  ) d
  where r.dashboard_id = dash_id and r.kind = 'income'
    and ((extract(year from d.month) - extract(year from r.start_month)) * 12
         + extract(month from d.month) - extract(month from r.start_month))::int % r.interval_months = 0
  on conflict (recurrence_id, month_date) do nothing;

  -- Dépenses fixes
  insert into public.expenses (user_id, dashboard_id, name, amount, date, is_recurrent, is_hidden, icon, color, month_date, recurrence_id)
  select r.user_id, r.dashboard_id, r.name, r.amount,
         d.month + (least(r.day_of_month, extract(day from (d.month + interval '1 month - 1 day'))::int) - 1),
         true, false, r.icon, r.color, d.month, r.id
  from public.recurrences r
  cross join lateral (
    select g::date as month
    from generate_series(
      greatest(r.start_month, coalesce((r.materialized_until + interval '1 month')::date, r.start_month), earliest)::timestamp,
      least(until_month, coalesce(r.end_month, until_month))::timestamp,
      interval '1 month') g
  ) d
  where r.dashboard_id = dash_id and r.kind = 'expense'
    and ((extract(year from d.month) - extract(year from r.start_month)) * 12
         + extract(month from d.month) - extract(month from r.start_month))::int % r.interval_months = 0
  on conflict (recurrence_id, month_date) do nothing;

  -- Enveloppes
  insert into public.envelopes (user_id, dashboard_id, name, is_recurrent, is_hidden, icon, color, max_amount, month_date, recurrence_id)
  select r.user_id, r.dashboard_id, r.name, true, false, r.icon, r.color, r.amount, d.month, r.id
  from public.recurrences r
  cross join lateral (
    select g::date as month
    from generate_series(
      greatest(r.start_month, coalesce((r.materialized_until + interval '1 month')::date, r.start_month), earliest)::timestamp,
      least(until_month, coalesce(r.end_month, until_month))::timestamp,
      interval '1 month') g
  ) d
  where r.dashboard_id = dash_id and r.kind = 'envelope'
    and ((extract(year from d.month) - extract(year from r.start_month)) * 12
         + extract(month from d.month) - extract(month from r.start_month))::int % r.interval_months = 0
  on conflict (recurrence_id, month_date) do nothing;

  -- Ces mois sont traités : on n'y reviendra pas
  update public.recurrences r set materialized_until = until_month
  where r.dashboard_id = dash_id and r.start_month <= until_month
    and (r.materialized_until is null or r.materialized_until < until_month);
end;
$$;

revoke execute on function public.materialize_recurrences(uuid, date) from public, anon, authenticated;


-- Appelée par l'application à l'ouverture d'un mois (même nom et mêmes paramètres qu'avant)
create or replace function public.apply_recurrence(dash_id uuid, for_month date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  wanted_month date := date_trunc('month', for_month::timestamp)::date;
begin
  if not public.check_is_dashboard_member(dash_id) then
    raise exception 'Accès refusé à ce dashboard' using errcode = '42501';
  end if;

  -- Date aberrante : au-delà de deux ans dans le futur, rien n'est créé
  if wanted_month > (date_trunc('month', current_date::timestamp) + interval '24 months')::date then
    return;
  end if;

  perform public.materialize_recurrences(dash_id, wanted_month);
end;
$$;

revoke execute on function public.apply_recurrence(uuid, date) from public, anon;
grant execute on function public.apply_recurrence(uuid, date) to authenticated;


-- 5. OUTILS INTERNES

-- Vérifie que l'utilisateur connecté peut modifier ce dashboard (propriétaire ou éditeur)
create function public.assert_can_edit_dashboard(dash_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_dashboard_role(dash_id, array['owner', 'editor']) then
    raise exception 'Vous ne pouvez pas modifier ce dashboard' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_can_edit_dashboard(uuid) from public, anon, authenticated;

-- Retire les lignes d'une règle à partir d'un mois, quand elles ne correspondent plus à la règle :
-- toutes (stop_all), ou seulement celles hors du rythme ou après la fin de la règle.
-- Une enveloppe d'un mois suivant qui contient déjà des dépenses n'est jamais supprimée :
-- elle est détachée de la règle et reste une enveloppe ordinaire.
create function public.prune_recurrence_rows(rule_id uuid, from_month date, stop_all boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  rule public.recurrences;
begin
  select * into rule from public.recurrences r where r.id = rule_id;
  if not found then return; end if;

  if rule.kind = 'income' then
    delete from public.incomes i
    where i.recurrence_id = rule.id and i.month_date >= from_month
      and (stop_all
        or (rule.end_month is not null and i.month_date > rule.end_month)
        or ((extract(year from i.month_date) - extract(year from rule.start_month)) * 12
            + extract(month from i.month_date) - extract(month from rule.start_month))::int % rule.interval_months <> 0);

  elsif rule.kind = 'expense' then
    delete from public.expenses e
    where e.recurrence_id = rule.id and e.month_date >= from_month
      and (stop_all
        or (rule.end_month is not null and e.month_date > rule.end_month)
        or ((extract(year from e.month_date) - extract(year from rule.start_month)) * 12
            + extract(month from e.month_date) - extract(month from rule.start_month))::int % rule.interval_months <> 0);

  else
    -- Mois suivants qui ont déjà des dépenses : l'enveloppe est gardée, sans sa règle
    update public.envelopes v set recurrence_id = null, is_recurrent = false
    where v.recurrence_id = rule.id and v.month_date > from_month
      and (stop_all
        or (rule.end_month is not null and v.month_date > rule.end_month)
        or ((extract(year from v.month_date) - extract(year from rule.start_month)) * 12
            + extract(month from v.month_date) - extract(month from rule.start_month))::int % rule.interval_months <> 0)
      and exists (select 1 from public.envelope_expenses x where x.envelope_id = v.id);

    delete from public.envelopes v
    where v.recurrence_id = rule.id and v.month_date >= from_month
      and (stop_all
        or (rule.end_month is not null and v.month_date > rule.end_month)
        or ((extract(year from v.month_date) - extract(year from rule.start_month)) * 12
            + extract(month from v.month_date) - extract(month from rule.start_month))::int % rule.interval_months <> 0);
  end if;
end;
$$;

revoke execute on function public.prune_recurrence_rows(uuid, date, boolean) from public, anon, authenticated;


-- 6. FONCTIONS APPELÉES PAR L'APPLICATION
-- security definer : elles écrivent la règle et ses lignes ensemble. Chacune vérifie d'abord
-- que l'utilisateur connecté est propriétaire ou éditeur du dashboard.

-- Crée une règle à partir de `first_month` et les lignes des mois déjà commencés.
-- `existing_row` : ligne ordinaire du premier mois qui devient la première occurrence de la règle.
create function public.create_recurrence(
  dash_id uuid, rule_kind text, rule_name text, rule_amount numeric, rule_day integer,
  rule_icon text, rule_color text, rule_interval integer, first_month date,
  last_month date default null, existing_row uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  start_at date := date_trunc('month', first_month::timestamp)::date;
  end_at date := date_trunc('month', last_month::timestamp)::date;
  new_rule_id uuid;
  linked integer;
begin
  perform public.assert_can_edit_dashboard(dash_id);
  perform pg_advisory_xact_lock(hashtextextended(dash_id::text, 0));

  insert into public.recurrences (dashboard_id, user_id, kind, name, amount, day_of_month, icon, color, interval_months, start_month, end_month)
  values (dash_id, auth.uid(), rule_kind, rule_name, rule_amount, rule_day, rule_icon, rule_color, rule_interval, start_at, end_at)
  returning id into new_rule_id;

  if existing_row is not null then
    if rule_kind = 'income' then
      update public.incomes i set recurrence_id = new_rule_id, is_recurrent = true
      where i.id = existing_row and i.dashboard_id = dash_id and i.month_date = start_at and i.recurrence_id is null;
    elsif rule_kind = 'expense' then
      update public.expenses e set recurrence_id = new_rule_id, is_recurrent = true
      where e.id = existing_row and e.dashboard_id = dash_id and e.month_date = start_at and e.recurrence_id is null;
    else
      update public.envelopes v set recurrence_id = new_rule_id, is_recurrent = true
      where v.id = existing_row and v.dashboard_id = dash_id and v.month_date = start_at and v.recurrence_id is null;
    end if;
    get diagnostics linked = row_count;
    if linked = 0 then
      raise exception 'Élément introuvable pour ce mois' using errcode = 'P0002';
    end if;
  end if;

  -- Les mois déjà commencés sont remplis tout de suite ; les suivants le seront à leur ouverture
  perform public.materialize_recurrences(dash_id, greatest(start_at, date_trunc('month', current_date::timestamp)::date));

  return new_rule_id;
end;
$$;

-- « Ce mois et les suivants » : applique de nouvelles valeurs à la règle à partir de `from_month`.
-- Les lignes déjà créées à partir de ce mois sont mises à jour ; celles des mois précédents ne changent pas.
-- Si le rythme change en cours de route, la règle est coupée en deux : l'ancienne s'arrête au mois
-- précédent et une nouvelle démarre à `from_month`. Retourne la règle en vigueur à partir de ce mois.
create function public.update_recurrence_from(
  rule_id uuid, from_month date, rule_name text, rule_amount numeric, rule_day integer,
  rule_icon text, rule_color text, rule_interval integer, last_month date default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  rule public.recurrences;
  from_at date := date_trunc('month', from_month::timestamp)::date;
  end_at date := date_trunc('month', last_month::timestamp)::date;
  target_id uuid;
  filled_until date;
begin
  -- Même verrou que la création des lignes, pris en premier : pas d'interblocage avec l'ouverture d'un mois
  perform pg_advisory_xact_lock(hashtextextended(r.dashboard_id::text, 0)) from public.recurrences r where r.id = rule_id;

  select * into rule from public.recurrences r where r.id = rule_id for update;
  if not found then
    raise exception 'Récurrence introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_can_edit_dashboard(rule.dashboard_id);

  if end_at is not null and end_at < from_at then
    raise exception 'La fin de la récurrence ne peut pas précéder ce mois' using errcode = '22023';
  end if;

  filled_until := greatest(coalesce(rule.materialized_until, from_at), from_at);

  if rule_interval = rule.interval_months or from_at <= rule.start_month then
    -- Même rythme, ou changement dès le premier mois : la règle est modifiée sur place
    target_id := rule.id;
    update public.recurrences r
    set name = rule_name, amount = rule_amount, day_of_month = rule_day, icon = rule_icon, color = rule_color,
        interval_months = rule_interval, end_month = end_at,
        materialized_until = (greatest(from_at, r.start_month) - interval '1 month')::date
    where r.id = rule.id;
  else
    -- Nouveau rythme en cours de route : l'ancienne règle s'arrête, une nouvelle commence ce mois-ci
    update public.recurrences r set end_month = (from_at - interval '1 month')::date where r.id = rule.id;

    insert into public.recurrences (dashboard_id, user_id, kind, name, amount, day_of_month, icon, color, interval_months, start_month, end_month, materialized_until)
    values (rule.dashboard_id, auth.uid(), rule.kind, rule_name, rule_amount, rule_day, rule_icon, rule_color, rule_interval, from_at, end_at, (from_at - interval '1 month')::date)
    returning id into target_id;

    if rule.kind = 'income' then
      update public.incomes i set recurrence_id = target_id where i.recurrence_id = rule.id and i.month_date >= from_at;
    elsif rule.kind = 'expense' then
      update public.expenses e set recurrence_id = target_id where e.recurrence_id = rule.id and e.month_date >= from_at;
    else
      update public.envelopes v set recurrence_id = target_id where v.recurrence_id = rule.id and v.month_date >= from_at;
    end if;
  end if;

  -- Lignes qui ne correspondent plus au rythme ou dépassent la nouvelle fin
  perform public.prune_recurrence_rows(target_id, from_at, false);

  -- Les lignes restantes à partir de ce mois prennent les nouvelles valeurs
  if rule.kind = 'income' then
    update public.incomes i
    set name = rule_name, amount = rule_amount, icon = rule_icon, color = rule_color,
        date = i.month_date + (least(rule_day, extract(day from (i.month_date + interval '1 month - 1 day'))::int) - 1)
    where i.recurrence_id = target_id and i.month_date >= from_at;
  elsif rule.kind = 'expense' then
    update public.expenses e
    set name = rule_name, amount = rule_amount, icon = rule_icon, color = rule_color,
        date = e.month_date + (least(rule_day, extract(day from (e.month_date + interval '1 month - 1 day'))::int) - 1)
    where e.recurrence_id = target_id and e.month_date >= from_at;
  else
    update public.envelopes v
    set name = rule_name, max_amount = rule_amount, icon = rule_icon, color = rule_color
    where v.recurrence_id = target_id and v.month_date >= from_at;
  end if;

  -- Mois déjà ouverts que le nouveau rythme ou la nouvelle fin rendent nécessaires
  perform public.materialize_recurrences(rule.dashboard_id, filled_until);

  return target_id;
end;
$$;

-- « Arrêter la récurrence » à partir de `from_month` : la règle se termine au mois précédent,
-- et ses lignes de ce mois et des suivants sont supprimées.
create function public.stop_recurrence(rule_id uuid, from_month date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  rule public.recurrences;
  from_at date := date_trunc('month', from_month::timestamp)::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(r.dashboard_id::text, 0)) from public.recurrences r where r.id = rule_id;

  select * into rule from public.recurrences r where r.id = rule_id for update;
  if not found then
    raise exception 'Récurrence introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_can_edit_dashboard(rule.dashboard_id);

  perform public.prune_recurrence_rows(rule.id, from_at, true);

  if from_at <= rule.start_month then
    -- Arrêtée dès son premier mois : la règle n'a plus lieu d'être
    delete from public.recurrences r where r.id = rule.id;
  elsif rule.end_month is null or rule.end_month >= from_at then
    update public.recurrences r set end_month = (from_at - interval '1 month')::date where r.id = rule.id;
  end if;
end;
$$;

revoke execute on function public.create_recurrence(uuid, text, text, numeric, integer, text, text, integer, date, date, uuid) from public, anon;
revoke execute on function public.update_recurrence_from(uuid, date, text, numeric, integer, text, text, integer, date) from public, anon;
revoke execute on function public.stop_recurrence(uuid, date) from public, anon;
grant execute on function public.create_recurrence(uuid, text, text, numeric, integer, text, text, integer, date, date, uuid) to authenticated;
grant execute on function public.update_recurrence_from(uuid, date, text, numeric, integer, text, text, integer, date) to authenticated;
grant execute on function public.stop_recurrence(uuid, date) to authenticated;
