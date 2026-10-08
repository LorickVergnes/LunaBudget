-- Droits que l'export automatique du schéma (db pull) ne restitue pas fidèlement.
--
-- La migration précédente a été générée depuis la base de production. Rejouée sur une base
-- vide, elle laissait trois écarts par rapport à la production :
--   1. Supabase accorde par défaut l'exécution de toute nouvelle fonction au rôle "anon"
--      (visiteur non connecté). L'export ne retire ce droit qu'à PUBLIC, pas à "anon".
--   2. et 3. L'export retire le droit UPDATE sur profiles au niveau de la table APRÈS avoir
--      accordé les colonnes modifiables : dans Postgres, ce retrait efface aussi les droits par colonne.
--
-- Ces instructions sont sans effet sur la production, qui est déjà dans cet état.

-- Fonctions réservées aux utilisateurs connectés
revoke execute on function public.get_user_id_by_email(text) from public, anon;
revoke execute on function public.apply_recurrence(uuid, date) from public, anon;

-- Profil : seules ces colonnes sont modifiables par leur propriétaire (jamais "role" ni "email")
grant update (full_name, avatar_url, updated_at) on table public.profiles to authenticated;
