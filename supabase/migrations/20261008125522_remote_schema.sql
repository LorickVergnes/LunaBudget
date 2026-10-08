


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "backup";


ALTER SCHEMA "backup" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apply_recurrence"("dash_id" "uuid", "for_month" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."apply_recurrence"("dash_id" "uuid", "for_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_dashboard_member"("dash_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.dashboard_members
    where dashboard_id = dash_id
    and user_id = auth.uid()
  );
end;
$$;


ALTER FUNCTION "public"."check_is_dashboard_member"("dash_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("target_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    found_id uuid;
begin
    select id into found_id
    from public.profiles
    where email = lower(target_email);
    return found_id;
end;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("target_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  new_dashboard_id uuid;
begin
  -- 1. Créer le profil
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'free');

  -- 2. Créer le dashboard par défaut
  insert into public.dashboards (name, owner_id)
  values ('Mon Budget', new.id)
  returning id into new_dashboard_id;

  -- 3. Ajouter l'utilisateur comme owner du dashboard
  insert into public.dashboard_members (dashboard_id, user_id, role)
  values (new_dashboard_id, new.id, 'owner');

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_dashboard_role"("dash_id" "uuid", "allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.dashboard_members
    where dashboard_id = dash_id
    and user_id = auth.uid()
    and role = any(allowed_roles)
  );
end;
$$;


ALTER FUNCTION "public"."has_dashboard_role"("dash_id" "uuid", "allowed_roles" "text"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "backup"."recurrence_logs_savings_20261008" (
    "id" "uuid",
    "user_id" "uuid",
    "table_name" "text",
    "source_item_id" "uuid",
    "target_month" "date",
    "created_at" timestamp with time zone,
    "dashboard_id" "uuid"
);


ALTER TABLE "backup"."recurrence_logs_savings_20261008" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup"."saving_entries_20261008" (
    "id" "uuid",
    "user_id" "uuid",
    "saving_id" "uuid",
    "amount" numeric(12,2),
    "date" "date",
    "month_date" "date",
    "created_at" timestamp with time zone,
    "dashboard_id" "uuid"
);


ALTER TABLE "backup"."saving_entries_20261008" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup"."savings_20261008" (
    "id" "uuid",
    "user_id" "uuid",
    "name" "text",
    "is_recurrent" boolean,
    "is_hidden" boolean,
    "icon" "text",
    "color" "text",
    "target_amount" numeric(12,2),
    "month_date" "date",
    "max_month" "date",
    "created_at" timestamp with time zone,
    "dashboard_id" "uuid"
);


ALTER TABLE "backup"."savings_20261008" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dashboard_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dashboard_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."dashboard_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."envelope_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "envelope_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "icon" "text" DEFAULT 'ShoppingCart'::"text",
    "color" "text" DEFAULT '#3b82f6'::"text",
    "month_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);

ALTER TABLE ONLY "public"."envelope_expenses" REPLICA IDENTITY FULL;


ALTER TABLE "public"."envelope_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."envelopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_recurrent" boolean DEFAULT false,
    "is_hidden" boolean DEFAULT false,
    "icon" "text" DEFAULT 'Wallet'::"text",
    "color" "text" DEFAULT '#3b82f6'::"text",
    "max_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "month_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);

ALTER TABLE ONLY "public"."envelopes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."envelopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_recurrent" boolean DEFAULT false,
    "is_hidden" boolean DEFAULT false,
    "icon" "text" DEFAULT 'ArrowDownCircle'::"text",
    "color" "text" DEFAULT '#ef4444'::"text",
    "month_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);

ALTER TABLE ONLY "public"."expenses" REPLICA IDENTITY FULL;


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_recurrent" boolean DEFAULT false,
    "is_hidden" boolean DEFAULT false,
    "icon" "text" DEFAULT 'ArrowUpCircle'::"text",
    "color" "text" DEFAULT '#10b981'::"text",
    "month_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);

ALTER TABLE ONLY "public"."incomes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."incomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'free'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurrence_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "source_item_id" "uuid" NOT NULL,
    "target_month" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);


ALTER TABLE "public"."recurrence_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saving_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "saving_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "month_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid"
);

ALTER TABLE ONLY "public"."saving_entries" REPLICA IDENTITY FULL;


ALTER TABLE "public"."saving_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."savings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT 'PiggyBank'::"text",
    "color" "text" DEFAULT '#8b5cf6'::"text",
    "monthly_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "start_month" "date" NOT NULL,
    "end_month" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_id" "uuid",
    "goal_amount" numeric(12,2),
    CONSTRAINT "savings_end_after_start" CHECK ((("end_month" IS NULL) OR ("end_month" >= "start_month")))
);

ALTER TABLE ONLY "public"."savings" REPLICA IDENTITY FULL;


ALTER TABLE "public"."savings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."savings"."monthly_amount" IS 'Versement prévu chaque mois';



COMMENT ON COLUMN "public"."savings"."start_month" IS 'Premier mois de l''objectif';



COMMENT ON COLUMN "public"."savings"."end_month" IS 'Dernier mois de l''objectif (optionnel)';



COMMENT ON COLUMN "public"."savings"."goal_amount" IS 'Montant total à atteindre (optionnel)';



ALTER TABLE ONLY "public"."dashboard_members"
    ADD CONSTRAINT "dashboard_members_dashboard_id_user_id_key" UNIQUE ("dashboard_id", "user_id");



ALTER TABLE ONLY "public"."dashboard_members"
    ADD CONSTRAINT "dashboard_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboards"
    ADD CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."envelope_expenses"
    ADD CONSTRAINT "envelope_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."envelopes"
    ADD CONSTRAINT "envelopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurrence_logs"
    ADD CONSTRAINT "recurrence_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurrence_logs"
    ADD CONSTRAINT "recurrence_logs_user_id_table_name_source_item_id_target_mo_key" UNIQUE ("user_id", "table_name", "source_item_id", "target_month");



ALTER TABLE ONLY "public"."saving_entries"
    ADD CONSTRAINT "saving_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."savings"
    ADD CONSTRAINT "savings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_members"
    ADD CONSTRAINT "dashboard_members_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_members"
    ADD CONSTRAINT "dashboard_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboards"
    ADD CONSTRAINT "dashboards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envelope_expenses"
    ADD CONSTRAINT "envelope_expenses_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envelope_expenses"
    ADD CONSTRAINT "envelope_expenses_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envelope_expenses"
    ADD CONSTRAINT "envelope_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envelopes"
    ADD CONSTRAINT "envelopes_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envelopes"
    ADD CONSTRAINT "envelopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurrence_logs"
    ADD CONSTRAINT "recurrence_logs_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurrence_logs"
    ADD CONSTRAINT "recurrence_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saving_entries"
    ADD CONSTRAINT "saving_entries_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saving_entries"
    ADD CONSTRAINT "saving_entries_saving_id_fkey" FOREIGN KEY ("saving_id") REFERENCES "public"."savings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saving_entries"
    ADD CONSTRAINT "saving_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."savings"
    ADD CONSTRAINT "savings_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."savings"
    ADD CONSTRAINT "savings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."dashboard_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_members_owner_manage" ON "public"."dashboard_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dashboards"
  WHERE (("dashboards"."id" = "dashboard_members"."dashboard_id") AND ("dashboards"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dashboards"
  WHERE (("dashboards"."id" = "dashboard_members"."dashboard_id") AND ("dashboards"."owner_id" = "auth"."uid"())))));



CREATE POLICY "dashboard_members_select" ON "public"."dashboard_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."check_is_dashboard_member"("dashboard_id")));



ALTER TABLE "public"."dashboards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboards_owner_manage" ON "public"."dashboards" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "dashboards_select" ON "public"."dashboards" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."check_is_dashboard_member"("id")));



ALTER TABLE "public"."envelope_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "envelope_expenses_delete" ON "public"."envelope_expenses" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "envelope_expenses_insert" ON "public"."envelope_expenses" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "envelope_expenses_select" ON "public"."envelope_expenses" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "envelope_expenses_update" ON "public"."envelope_expenses" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."envelopes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "envelopes_delete" ON "public"."envelopes" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "envelopes_insert" ON "public"."envelopes" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "envelopes_select" ON "public"."envelopes" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "envelopes_update" ON "public"."envelopes" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_delete" ON "public"."expenses" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "expenses_insert" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "expenses_select" ON "public"."expenses" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "expenses_update" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."incomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incomes_delete" ON "public"."incomes" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "incomes_insert" ON "public"."incomes" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "incomes_select" ON "public"."incomes" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "incomes_update" ON "public"."incomes" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."dashboard_members"
  WHERE (("dashboard_members"."user_id" = "profiles"."id") AND "public"."check_is_dashboard_member"("dashboard_members"."dashboard_id"))))));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."recurrence_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurrence_logs_delete" ON "public"."recurrence_logs" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "recurrence_logs_insert" ON "public"."recurrence_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "recurrence_logs_select" ON "public"."recurrence_logs" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "recurrence_logs_update" ON "public"."recurrence_logs" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."saving_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saving_entries_delete" ON "public"."saving_entries" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "saving_entries_insert" ON "public"."saving_entries" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "saving_entries_select" ON "public"."saving_entries" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "saving_entries_update" ON "public"."saving_entries" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



ALTER TABLE "public"."savings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "savings_delete" ON "public"."savings" FOR DELETE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));



CREATE POLICY "savings_insert" ON "public"."savings" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "savings_select" ON "public"."savings" FOR SELECT TO "authenticated" USING ("public"."check_is_dashboard_member"("dashboard_id"));



CREATE POLICY "savings_update" ON "public"."savings" FOR UPDATE TO "authenticated" USING ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"])) WITH CHECK ("public"."has_dashboard_role"("dashboard_id", ARRAY['owner'::"text", 'editor'::"text"]));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."envelope_expenses";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."envelopes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."expenses";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."incomes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."saving_entries";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."savings";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."apply_recurrence"("dash_id" "uuid", "for_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_recurrence"("dash_id" "uuid", "for_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_recurrence"("dash_id" "uuid", "for_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_dashboard_member"("dash_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_dashboard_member"("dash_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_dashboard_member"("dash_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_id_by_email"("target_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("target_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("target_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_dashboard_role"("dash_id" "uuid", "allowed_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_dashboard_role"("dash_id" "uuid", "allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_dashboard_role"("dash_id" "uuid", "allowed_roles" "text"[]) TO "service_role";


















GRANT ALL ON TABLE "public"."dashboard_members" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_members" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_members" TO "service_role";



GRANT ALL ON TABLE "public"."dashboards" TO "anon";
GRANT ALL ON TABLE "public"."dashboards" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboards" TO "service_role";



GRANT ALL ON TABLE "public"."envelope_expenses" TO "anon";
GRANT ALL ON TABLE "public"."envelope_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."envelope_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."envelopes" TO "anon";
GRANT ALL ON TABLE "public"."envelopes" TO "authenticated";
GRANT ALL ON TABLE "public"."envelopes" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."incomes" TO "anon";
GRANT ALL ON TABLE "public"."incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."incomes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."recurrence_logs" TO "anon";
GRANT ALL ON TABLE "public"."recurrence_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."recurrence_logs" TO "service_role";



GRANT ALL ON TABLE "public"."saving_entries" TO "anon";
GRANT ALL ON TABLE "public"."saving_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."saving_entries" TO "service_role";



GRANT ALL ON TABLE "public"."savings" TO "anon";
GRANT ALL ON TABLE "public"."savings" TO "authenticated";
GRANT ALL ON TABLE "public"."savings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


