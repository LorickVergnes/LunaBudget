-- Deux fonctions appelées par l'application.
--
-- 1. create_dashboard : avant, l'application créait le dashboard puis y inscrivait son propriétaire
--    en deux requêtes séparées. Si la seconde échouait, il restait un dashboard dans lequel
--    personne ne pouvait écrire. Les deux écritures sont maintenant faites ensemble : tout ou rien.
--
-- 2. get_monthly_totals : avant, la Vue Globale téléchargeait toutes les lignes du dashboard depuis
--    le premier jour pour les additionner dans le navigateur. Au-delà de 1000 lignes par table
--    (limite de l'API), les totaux étaient tronqués sans erreur. La base renvoie maintenant
--    directement une ligne de totaux par mois.
--
-- Les deux fonctions s'exécutent avec les droits de l'utilisateur connecté (pas de security definer) :
-- les règles d'accès (RLS) des tables s'appliquent telles quelles.


-- 1. CRÉATION D'UN DASHBOARD
create function public.create_dashboard(dashboard_name text)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  new_dashboard_id uuid;
begin
  insert into public.dashboards (name, owner_id)
  values (dashboard_name, auth.uid())
  returning id into new_dashboard_id;

  insert into public.dashboard_members (dashboard_id, user_id, role)
  values (new_dashboard_id, auth.uid(), 'owner');

  return new_dashboard_id;
end;
$$;

revoke execute on function public.create_dashboard(text) from public, anon;
grant execute on function public.create_dashboard(text) to authenticated;


-- 2. TOTAUX PAR MOIS
-- `as_of` est la date du jour chez l'utilisateur. Elle sépare le « réel » du « prévu » :
--   - réel  : les mois passés en entier, et le mois en cours jusqu'à cette date ;
--   - prévu : tout ce qui est planifié sur le mois.
-- En prévu, une enveloppe compte pour son plafond, ou pour ce qui y est dépensé si le plafond est dépassé.
-- L'épargne prévue dépend des objectifs en cours : elle est calculée par l'application.
create function public.get_monthly_totals(dash_id uuid, as_of date)
returns table (
  month_date date,
  income_real numeric,
  income_planned numeric,
  fixed_real numeric,
  fixed_planned numeric,
  envelope_real numeric,
  envelope_planned numeric,
  savings_real numeric
)
language sql stable set search_path = ''
as $$
  with current_month as (
    select date_trunc('month', as_of::timestamp)::date as first_day
  ),
  income_totals as (
    select i.month_date,
           coalesce(sum(i.amount) filter (where i.month_date < c.first_day or (i.month_date = c.first_day and i.date <= as_of)), 0) as real_total,
           sum(i.amount) as planned_total
    from public.incomes i cross join current_month c
    where i.dashboard_id = dash_id and i.is_hidden = false
    group by i.month_date
  ),
  expense_totals as (
    select e.month_date,
           coalesce(sum(e.amount) filter (where e.month_date < c.first_day or (e.month_date = c.first_day and e.date <= as_of)), 0) as real_total,
           sum(e.amount) as planned_total
    from public.expenses e cross join current_month c
    where e.dashboard_id = dash_id and e.is_hidden = false
    group by e.month_date
  ),
  envelope_real_totals as (
    select x.month_date,
           coalesce(sum(x.amount) filter (where x.month_date < c.first_day or (x.month_date = c.first_day and x.date <= as_of)), 0) as real_total
    from public.envelope_expenses x cross join current_month c
    where x.dashboard_id = dash_id
    group by x.month_date
  ),
  envelope_spent as (
    select x.envelope_id, x.month_date, sum(x.amount) as spent
    from public.envelope_expenses x
    where x.dashboard_id = dash_id
    group by x.envelope_id, x.month_date
  ),
  envelope_planned_totals as (
    select v.month_date,
           sum(greatest(v.max_amount, coalesce(s.spent, 0))) as planned_total
    from public.envelopes v
    left join envelope_spent s on s.envelope_id = v.id and s.month_date = v.month_date
    where v.dashboard_id = dash_id and v.is_hidden = false
    group by v.month_date
  ),
  saving_totals as (
    select t.month_date,
           coalesce(sum(t.amount) filter (where t.month_date < c.first_day or (t.month_date = c.first_day and t.date <= as_of)), 0) as real_total
    from public.saving_entries t cross join current_month c
    where t.dashboard_id = dash_id
    group by t.month_date
  ),
  months as (
    select it.month_date from income_totals it
    union select et.month_date from expense_totals et
    union select rt.month_date from envelope_real_totals rt
    union select pt.month_date from envelope_planned_totals pt
    union select st.month_date from saving_totals st
  )
  select m.month_date,
         coalesce(it.real_total, 0), coalesce(it.planned_total, 0),
         coalesce(et.real_total, 0), coalesce(et.planned_total, 0),
         coalesce(rt.real_total, 0), coalesce(pt.planned_total, 0),
         coalesce(st.real_total, 0)
  from months m
  left join income_totals it on it.month_date = m.month_date
  left join expense_totals et on et.month_date = m.month_date
  left join envelope_real_totals rt on rt.month_date = m.month_date
  left join envelope_planned_totals pt on pt.month_date = m.month_date
  left join saving_totals st on st.month_date = m.month_date
  order by m.month_date;
$$;

revoke execute on function public.get_monthly_totals(uuid, date) from public, anon;
grant execute on function public.get_monthly_totals(uuid, date) to authenticated;
