-- Index sur les colonnes par lesquelles l'application cherche ses données.
--
-- Sans index, Postgres doit lire toutes les lignes d'une table pour trouver celles d'un dashboard
-- et d'un mois. C'est invisible avec quelques centaines de lignes, mais le temps de réponse
-- augmente avec le nombre total d'utilisateurs. Un index permet d'aller directement aux bonnes lignes.
--
-- Jusqu'ici, seuls les identifiants (clés primaires) et les contraintes d'unicité étaient indexés.

-- Chaque page charge « les lignes de ce dashboard pour ce mois »
create index incomes_dashboard_month_idx on public.incomes (dashboard_id, month_date);
create index expenses_dashboard_month_idx on public.expenses (dashboard_id, month_date);
create index envelopes_dashboard_month_idx on public.envelopes (dashboard_id, month_date);
create index envelope_expenses_dashboard_month_idx on public.envelope_expenses (dashboard_id, month_date);
create index saving_entries_dashboard_month_idx on public.saving_entries (dashboard_id, month_date);

-- Objectifs d'épargne d'un dashboard (ils n'appartiennent à aucun mois)
create index savings_dashboard_idx on public.savings (dashboard_id);

-- Pages de détail et jauges : les dépenses d'une enveloppe, les versements d'un objectif.
-- Sert aussi quand on supprime une enveloppe ou un objectif (suppression en cascade).
create index envelope_expenses_envelope_idx on public.envelope_expenses (envelope_id);
create index saving_entries_saving_idx on public.saving_entries (saving_id);

-- Récurrence : « cet élément a-t-il déjà été copié vers ce mois ? »
create index recurrence_logs_source_month_idx on public.recurrence_logs (source_item_id, target_month);

-- Partage : les dashboards d'un utilisateur, et les invitations adressées à un email
create index dashboard_members_user_idx on public.dashboard_members (user_id);
create index dashboard_invitations_email_idx on public.dashboard_invitations (email);
