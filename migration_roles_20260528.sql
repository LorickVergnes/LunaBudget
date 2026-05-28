-- ==========================================
-- MIGRATION : SYNC ROLES & PROFILES
-- À exécuter dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. S'assurer que la colonne 'role' existe sur 'profiles'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'free';
    END IF;
END $$;

-- 2. Mettre à jour tous les utilisateurs existants qui n'ont pas de rôle
UPDATE public.profiles SET role = 'free' WHERE role IS NULL;

-- 3. Mettre à jour le trigger handle_new_user pour les futures inscriptions
-- (Au cas où le script database_schema.sql n'a pas encore été ré-appliqué en entier)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'free');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. S'assurer que le trigger est bien lié (on le drop d'abord pour éviter les doublons)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Vérification : Récupérer la liste des utilisateurs et leurs rôles
SELECT email, full_name, role FROM public.profiles;
