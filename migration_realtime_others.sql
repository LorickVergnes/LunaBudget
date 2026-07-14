-- ==========================================
-- MIGRATION : Activer Supabase Realtime pour toutes les autres tables
-- À exécuter dans le SQL Editor de Supabase
-- ==========================================

-- 1. REPLICA IDENTITY FULL pour recevoir le payload 'old' lors des UPDATE/DELETE
ALTER TABLE expenses REPLICA IDENTITY FULL;
ALTER TABLE envelopes REPLICA IDENTITY FULL;
ALTER TABLE envelope_expenses REPLICA IDENTITY FULL;
ALTER TABLE savings REPLICA IDENTITY FULL;
ALTER TABLE saving_entries REPLICA IDENTITY FULL;

-- 2. Ajouter ces tables à la publication Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses, envelopes, envelope_expenses, savings, saving_entries;

-- Note : si 'incomes' n'a pas encore été ajouté, on peut aussi l'inclure ici :
-- ALTER PUBLICATION supabase_realtime ADD TABLE incomes, expenses, envelopes, envelope_expenses, savings, saving_entries;
