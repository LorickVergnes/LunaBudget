# Archive : anciens scripts SQL

Ces fichiers ont été exécutés à la main dans l'éditeur SQL de Supabase, avant la mise en place
des migrations (`supabase/migrations/`). Ils sont conservés pour l'historique.

**Ne plus les exécuter.** Leur effet est déjà contenu dans la première migration,
générée à partir de la base de production. En particulier, `database_schema.sql`
commence par supprimer toutes les tables.

Ordre dans lequel ils ont été appliqués :

1. `database_schema.sql` (version d'origine)
2. `migration_dashboards_20260528.sql`
3. `migration_roles_20260528.sql`
4. `migration_realtime_incomes.sql`
5. `migration_realtime_others.sql`
6. `migration_rls_hardening_20261007.sql`
7. `migration_recurrence_sql_20261007.sql`
8. `migration_savings_goals_20261008.sql`
