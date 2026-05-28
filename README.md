# 🌙 LunaBudget

LunaBudget est une application de gestion de budget personnelle, conçue pour être performante, sécurisée et évolutive. Ce projet est structuré pour passer d'une application personnelle à une plateforme SaaS (Software as a Service) complète, capable d'accompagner des dizaines de milliers d'utilisateurs.

## 🚀 Vision & RoadMap

L'objectif est de transformer la gestion budgétaire en une expérience engageante (gamification) tout en offrant des outils professionnels pour les utilisateurs avancés.

### 🎮 Gamification (Engagement & Rétention)
*   **Séries (Streaks) & Badges :** Récompenser la régularité du suivi.
*   **Défis Mensuels :** Micro-objectifs (ex: "Week-end sans dépenses") débloquant des récompenses visuelles.
*   **Récap' Mensuel (Style Spotify Wrapped) :** Résumé visuel et partageable des succès financiers du mois.
*   **Feedback Visuel :** Animations de célébration (confettis) lors de l'atteinte d'objectifs d'épargne.

### 💎 Modèle Freemium
*   **Version Gratuite :** Fonctions de base, 10 couleurs/icônes, suivi mensuel standard.
*   **Premium :**
    *   **Personnalisation Illimitée :** Palettes de couleurs complètes et icônes infinies.
    *   **Dashboards Partagés :** Collaboration en temps réel (couples, familles).
    *   **Export & Rapports :** PDF/CSV et graphiques prédictifs.
    *   **Smart Scan (IA) :** Saisie automatique via photos de reçus.
    *   **Répartition Automatique :** Ventilation intelligente des revenus selon des règles prédéfinies.

---

## 🏗️ Architecture Stratégique

La stack est choisie pour minimiser la maintenance tout en maximisant la scalabilité.

### 1. Stack Technique "Target"
*   **Frontend :** [React](https://react.dev/) (Vite) hébergé sur **Vercel** ou **Netlify** pour bénéficier du CDN mondial et des Serverless Functions.
*   **Backend Logique :** **Serverless Functions** (Vercel/Supabase Edge Functions) pour le code sensible (Stripe, IA).
*   **BaaS (Backend-as-a-Service) :** [Supabase](https://supabase.com/).
    *   **Database :** PostgreSQL standard (exportable à tout moment).
    *   **Realtime :** Synchronisation instantanée pour le mode collaboratif.
    *   **Auth & Storage :** Gestion native des utilisateurs et des fichiers (reçus).
*   **Paiements :** Intégration **Stripe** via Webhooks sécurisés.

### 2. Pourquoi ce choix ?
*   **Évolutivité :** Supporte 100 000+ utilisateurs sans refonte d'infrastructure.
*   **Coût :** Modèle "Pay-as-you-grow". Quasi gratuit au lancement.
*   **Focus Produit :** 0% de temps sur la maintenance serveur, 100% sur les fonctionnalités.

---

## 🛠️ Organisation du Code

### Frontend (`/src`)
*   `components/` : Composants UI atomiques et composants de mise en page.
*   `contexts/` : Gestion de l'état global (Mois, Authentification, Préférences).
*   `hooks/` : Logique métier réutilisable et hooks d'accès aux données.
*   `services/` : Seule couche autorisée à interagir avec les APIs externes (Supabase, Stripe).

### Backend & Infrastructure
*   `database_schema.sql` : Source de vérité du schéma PostgreSQL.
*   `supabase/functions/` : Logique serveur sécurisée (Edge Functions).

---

## 🔒 Sécurité
*   **Zéro Exposition :** Aucune clé secrète n'est présente dans le code client.
*   **RLS (Row Level Security) :** Isolation stricte des données au niveau de la base de données.
*   **Webhooks :** Validation serveur pour toutes les transactions financières.
