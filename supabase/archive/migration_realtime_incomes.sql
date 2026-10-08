-- ==========================================
-- MIGRATION : Activer Supabase Realtime sur la table incomes
-- À exécuter dans le SQL Editor de Supabase
-- ==========================================

-- 1. REPLICA IDENTITY FULL permet de recevoir les données complètes
--    de l'ancien enregistrement lors d'un UPDATE ou DELETE.
--    Sans ça, on ne reçoit que la clé primaire dans le payload "old".
ALTER TABLE incomes REPLICA IDENTITY FULL;

-- 2. Activer la publication Realtime pour la table incomes.
--    Supabase a une publication "supabase_realtime" par défaut.
--    On y ajoute la table incomes.
--
--    NOTE: Si votre projet a déjà d'autres tables dans la publication,
--    cette commande les retirera. Dans ce cas, listez TOUTES les tables :
--    ALTER PUBLICATION supabase_realtime SET TABLE incomes, expenses, ...;
--
--    Pour AJOUTER sans retirer les existantes :
ALTER PUBLICATION supabase_realtime ADD TABLE incomes;

-- Vérification (optionnel) :
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
