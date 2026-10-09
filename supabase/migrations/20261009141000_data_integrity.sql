-- Garde-fous sur les données du budget.
--
-- Jusqu'ici la base acceptait à peu près tout : une ligne sans dashboard, un montant négatif,
-- une opération rangée dans un autre mois que celui de sa date, une dépense rattachée à
-- l'enveloppe d'un autre dashboard. L'application n'écrit rien de tel, mais rien ne l'en empêchait.
--
-- Les règles ci-dessous valent pour toute nouvelle écriture. Les lignes déjà présentes ne sont ni
-- vérifiées ni modifiées : une ancienne ligne incohérente reste lisible, masquable et supprimable ;
-- elle n'est contrôlée que le jour où l'on change la valeur concernée.


-- 1. SUPPRESSION D'UN COMPTE
-- Avant : supprimer le compte d'un membre supprimait en cascade tout ce qu'il avait saisi,
-- y compris dans le budget partagé de quelqu'un d'autre.
-- Après : ses lignes restent dans le dashboard, simplement sans auteur.
-- (Les dashboards dont il est propriétaire, eux, sont toujours supprimés avec son compte.)
alter table public.incomes alter column user_id drop not null;
alter table public.expenses alter column user_id drop not null;
alter table public.envelopes alter column user_id drop not null;
alter table public.envelope_expenses alter column user_id drop not null;
alter table public.savings alter column user_id drop not null;
alter table public.saving_entries alter column user_id drop not null;

alter table public.incomes
  drop constraint incomes_user_id_fkey,
  add constraint incomes_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.expenses
  drop constraint expenses_user_id_fkey,
  add constraint expenses_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.envelopes
  drop constraint envelopes_user_id_fkey,
  add constraint envelopes_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.envelope_expenses
  drop constraint envelope_expenses_user_id_fkey,
  add constraint envelope_expenses_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.savings
  drop constraint savings_user_id_fkey,
  add constraint savings_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.saving_entries
  drop constraint saving_entries_user_id_fkey,
  add constraint saving_entries_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;


-- 2. TOUTE LIGNE APPARTIENT À UN DASHBOARD
-- (not valid : d'éventuelles anciennes lignes sans dashboard ne bloquent pas la migration ;
--  elles sont de toute façon invisibles, les règles d'accès passant par le dashboard)
alter table public.incomes add constraint incomes_dashboard_required check (dashboard_id is not null) not valid;
alter table public.expenses add constraint expenses_dashboard_required check (dashboard_id is not null) not valid;
alter table public.envelopes add constraint envelopes_dashboard_required check (dashboard_id is not null) not valid;
alter table public.envelope_expenses add constraint envelope_expenses_dashboard_required check (dashboard_id is not null) not valid;
alter table public.savings add constraint savings_dashboard_required check (dashboard_id is not null) not valid;
alter table public.saving_entries add constraint saving_entries_dashboard_required check (dashboard_id is not null) not valid;


-- 3. COHÉRENCE DES MONTANTS, DES MOIS ET DES RATTACHEMENTS
-- Vérifiée à l'ajout d'une ligne, et à la modification des seules colonnes concernées.

create function public.first_day_of_month(day date)
returns date
language sql immutable set search_path = ''
as $$ select date_trunc('month', day::timestamp)::date $$;

-- Revenus et dépenses fixes : montant positif, mois = mois de la date
create function public.validate_operation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.amount < 0 then
    raise exception 'Le montant ne peut pas être négatif' using errcode = '23514';
  end if;
  if new.month_date <> public.first_day_of_month(new.date) then
    raise exception 'La date doit être dans le mois de l''opération' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger incomes_validate before insert or update of amount, date, month_date on public.incomes
  for each row execute function public.validate_operation();
create trigger expenses_validate before insert or update of amount, date, month_date on public.expenses
  for each row execute function public.validate_operation();

-- Enveloppes : plafond positif, mois au premier du mois
create function public.validate_envelope()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.max_amount < 0 then
    raise exception 'Le plafond ne peut pas être négatif' using errcode = '23514';
  end if;
  if new.month_date <> public.first_day_of_month(new.month_date) then
    raise exception 'Le mois d''une enveloppe doit être un premier du mois' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger envelopes_validate before insert or update of max_amount, month_date on public.envelopes
  for each row execute function public.validate_envelope();

-- Dépenses d'enveloppe : montant positif, même dashboard et même mois que l'enveloppe
create function public.validate_envelope_expense()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  envelope public.envelopes;
begin
  if new.amount < 0 then
    raise exception 'Le montant ne peut pas être négatif' using errcode = '23514';
  end if;

  select * into envelope from public.envelopes v where v.id = new.envelope_id;
  if not found or envelope.dashboard_id is distinct from new.dashboard_id then
    raise exception 'Cette enveloppe n''appartient pas à ce dashboard' using errcode = '23514';
  end if;
  if new.month_date <> envelope.month_date then
    raise exception 'Une dépense appartient au mois de son enveloppe' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger envelope_expenses_validate before insert or update of amount, envelope_id, dashboard_id, month_date on public.envelope_expenses
  for each row execute function public.validate_envelope_expense();

-- Objectifs d'épargne : montants positifs, mois au premier du mois
create function public.validate_saving()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.monthly_amount < 0 or new.goal_amount < 0 then
    raise exception 'Un montant d''épargne ne peut pas être négatif' using errcode = '23514';
  end if;
  if new.start_month <> public.first_day_of_month(new.start_month)
     or new.end_month <> public.first_day_of_month(new.end_month) then
    raise exception 'Les mois d''un objectif doivent être des premiers du mois' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger savings_validate before insert or update of monthly_amount, goal_amount, start_month, end_month on public.savings
  for each row execute function public.validate_saving();

-- Versements d'épargne : montant positif, mois = mois de la date, même dashboard que l'objectif
create function public.validate_saving_entry()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.amount < 0 then
    raise exception 'Le montant ne peut pas être négatif' using errcode = '23514';
  end if;
  if new.month_date <> public.first_day_of_month(new.date) then
    raise exception 'La date doit être dans le mois du versement' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.savings s where s.id = new.saving_id and s.dashboard_id is not distinct from new.dashboard_id
  ) then
    raise exception 'Cet objectif n''appartient pas à ce dashboard' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger saving_entries_validate before insert or update of amount, date, month_date, saving_id, dashboard_id on public.saving_entries
  for each row execute function public.validate_saving_entry();

-- Ces fonctions ne servent qu'aux déclencheurs : elles ne sont pas appelables par l'API
revoke execute on function public.validate_operation() from public, anon, authenticated;
revoke execute on function public.validate_envelope() from public, anon, authenticated;
revoke execute on function public.validate_envelope_expense() from public, anon, authenticated;
revoke execute on function public.validate_saving() from public, anon, authenticated;
revoke execute on function public.validate_saving_entry() from public, anon, authenticated;
