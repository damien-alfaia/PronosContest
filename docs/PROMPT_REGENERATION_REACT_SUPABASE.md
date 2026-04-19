# 🏆 PronosticsContest v2 — Prompt de régénération complet (React + Supabase)

> Document de spécification exhaustif pour la reconstruction de l'application **PronosticsContest** (actuellement en ASP.NET MVC 5 / Entity Framework / SQL Server) vers une stack moderne **React + TypeScript + Supabase**.

---

## 📋 Table des matières

1. [Analyse de l'existant](#1-analyse-de-lexistant)
2. [Modèle de données détaillé](#2-modèle-de-données-détaillé)
3. [Logique métier et scoring](#3-logique-métier-et-scoring)
4. [Fonctionnalités utilisateur actuelles](#4-fonctionnalités-utilisateur-actuelles)
5. [Nouvelles fonctionnalités proposées](#5-nouvelles-fonctionnalités-proposées)
6. [Prompt de régénération complet](#6-prompt-de-régénération-complet)
7. [Schéma Supabase (SQL)](#7-schéma-supabase-sql)
8. [Roadmap d'implémentation](#8-roadmap-dimplémentation)

---

## 1. Analyse de l'existant

### 1.1 Architecture actuelle (.NET)

L'application est structurée en **4 projets .NET** suivant une architecture en couches classique :

| Projet | Rôle | Techno |
|---|---|---|
| **PronosContest** (Web) | Front-end ASP.NET MVC 5 (contrôleurs + vues Razor) | ASP.NET MVC 5.2.3 / .NET 4.5.2 |
| **PronosContest.BLL** | Services métier (PronosService, AuthentificationService, StartService) | C# |
| **PronosContest.DAL** | Entités Code-First + DbContext + 22 migrations EF | Entity Framework 6.1.3 |
| **PronosContest.Core** | Helpers & extensions (hash SHA1, conversions) | C# |

**Auth** : OWIN Cookies + Claims Identity, mot de passe hashé en **SHA1** (⚠️ à moderniser).
**DB** : SQL Server (`PronosContestBdd`), connection string en clair dans Web.config (⚠️).

### 1.2 Domaine métier

Application de **concours de pronostics sportifs** (football / rugby) autour de compétitions type **Euro, Coupe du Monde**. Un utilisateur peut créer un **Concours** basé sur une **Compétition**, inviter d'autres joueurs, configurer un barème de points personnalisé (14+ coefficients), puis voir évoluer un **classement en temps réel** au fil des résultats. Des **sous-groupes de classement** permettent des mini-ligues privées (bureau, amis, famille).

---

## 2. Modèle de données détaillé

### 2.1 Entités principales

**CompteUtilisateur**
- `ID`, `Email` (unique), `Prenom`, `Nom`, `Password` (byte[] SHA1)
- `Role` : Administrateur / Utilisateur
- `Adresse` (value object inline : Ligne1/2/3, CodePostal, Ville, Pays)
- Relations : concours créés, inscriptions aux concours

**Competition**
- `ID`, `Libelle`, `TypeSport` (Football/Rugby), `DateDebut`, `DateFin`
- Relations : `PhaseGroupe[]`, `PhaseFinale[]`
- Propriétés calculées : `AllMatchs`, `Equipes`, `TableauCombinaisons` (15 combinaisons hardcodées pour les 3èmes)

**PhaseGroupe**
- `ID`, `Lettre` (A–F), `CompetitionID`
- Relations : `Equipes[]`, `Matchs[]`
- Méthodes : `Classement()`, `ClassementWithPronostics(pronos)`

**Equipe**
- `ID`, `PhaseGroupeID?`, `Libelle`, `ShortName`, `Logo`

**Match**
- `ID`, `NumeroMatch`, `EquipeAID?`, `EquipeBID?`
- `PhaseGroupeID?` XOR `PhaseFinaleID?`
- `Date`, `Stade`
- `ButsEquipeDomicile?`, `ButsEquipeExterieur?` (null avant fin)
- `ButsPenaltiesEquipeDomicile?`, `ButsPenaltiesEquipeExterieur?`
- `CoteDomicile?`, `CoteNul?`, `CoteExterieur?` (cotes betting pour scoring pondéré)
- `EquipePossibleDomicile_*` / `EquipePossibleExterieur_*` (équipes potentielles avant fin de phase)
- `InformationsMatchURL`
- Calculés : `VainqueurID`, `CoteVainqueur`

**PhaseFinale**
- `ID`, `CompetitionID`, `TypePhaseFinale` (32e, 16e, 8e, Quart, Demi, Finale, PetiteFinale)

**Pronostic**
- `ID`, `CompteUtilisateurID`, `MatchID`, `ConcoursID`
- `TypePronostic` (ResultatFinal / ScoreExact)
- `EtatPronostic` (Empty / EnCours / Gagne / GagneScoreExact / Perdu)
- `DateCreation`, `EquipeAID?`, `EquipeBID?`
- `ButsEquipeDomicile`, `ButsEquipeExterieur`
- `ButsPenaltiesEquipeDomicile`, `ButsPenaltiesEquipeExterieur`
- `IsNouveauProno` : distingue **ancien prono** (saisi avant la phase finale) vs **nouveau prono** (saisi pendant)

**Concours**
- `ID`, `CompetitionID`, `CompteUtilisateurID` (créateur)
- `EtatConcours` (EnCours / Termine), `DateDebut`, `DateFin?`, `DateLimiteSaisie`
- **14+ coefficients de scoring** (voir §3)
- Méthodes : `Classement()`, `AutresClassements(groupes)`, `ClassementAvantDate(dt)`, `ClassementParMatch()`, `ClassementProvisoire()`

**ConcoursCompteUtilisateur** (N-N inscription) — PK composite (CompteUtilisateurID, ConcoursID) + Date

**ConcoursGroupeClassement** (sous-groupes privés)
- `ID`, `ConcoursID`, `CompteUtilisateurID` (créateur), `Titre`

**ConcoursGroupeClassementUtilisateur** (membres d'un sous-groupe)
- `ID`, `ConcoursGroupeClassementID`, `CompteUtilisateurID`

### 2.2 Enums clés

```
TypeDeSport         : Football, Rugby
TypePhaseFinale     : TrenteDeuxieme=32, Seizieme=16, Huitieme=8, Quart=4, Demi=2, Finale=1, PetiteFinale=0
EtatConcours        : EnCours, Termine
EtatPronostic       : Empty, EnCours, Gagne, GagneScoreExact, Perdu
TypeDePronostic     : ResultatFinal, ScoreExact
CompteUtilisateurRole : Administrateur, Utilisateur
TypeSaisiePronostics : ReadOnly, SaisieAvantDateLimite, SaisieAvantDateMatch, SaisieOnly
```

---

## 3. Logique métier et scoring

### 3.1 Les 14+ coefficients du Concours

| Coefficient | Quand | Description |
|---|---|---|
| `CoefBonProno` | Phase groupes | Points si bon vainqueur (pondéré par cote) |
| `CoefScoreExact` | Phase groupes | Bonus score exact |
| `CoefBonnesEquipesQualifiees` | Phase groupes | Bonne équipe qualifiée |
| `CoefBonnesPositionsPoules` | Phase groupes | Bonne position dans la poule |
| `CoefPouleComplete` | Phase groupes | Poule entière correcte |
| `CoefBonPronoNouveauProno` | Phase finale (nouveau) | Bon vainqueur |
| `CoefScoreExactNouveauProno` | Phase finale (nouveau) | Score exact |
| `CoefPronosGagnesPenaltyNouveauProno` | Phase finale (nouveau) | Bon prono penalties |
| `CoefScoreExactPenaltyNouveauProno` | Phase finale (nouveau) | Score exact penalties |
| `CoefBonnesEquipesQualifieesEnQuartsAncienProno` | Phase finale (ancien) | Équipe qualifiée pour quarts |
| `CoefBonnesEquipesQualifieesEnDemisAncienProno` | Phase finale (ancien) | Équipe qualifiée pour demis |
| `CoefBonnesEquipesQualifieesEnFinaleAncienProno` | Phase finale (ancien) | Équipe qualifiée pour finale |
| `CoefVainqueurCompetitionAncienProno` | Phase finale (ancien) | Bon gagnant de la compétition |
| `CoefScoreExactHuitiemesAncienProno` | Phase finale (ancien) | Score exact huitièmes |
| `CoefScoreExactQuartsAncienProno` | Phase finale (ancien) | Score exact quarts |
| `CoefScoreExactDemisAncienProno` | Phase finale (ancien) | Score exact demis |
| `CoefScoreExactFinaleAncienProno` | Phase finale (ancien) | Score exact finale |
| `CoefBonnesEquipesQualifieesNouveauProno` | Phase finale (nouveau) | Bonne équipe qualifiée |

### 3.2 Algorithme de classement (Concours.`_classement()`)

Méthode de ~500 lignes qui, pour chaque utilisateur du concours :
1. Parcourt tous ses pronos finalisés
2. **Phase groupes** : accumule points pronos + score exact + équipes qualifiées + positions + poules complètes
3. **Phase finale ancien prono** : vérifie équipes attendues en quarts/demis/finale, score exact par phase, gagnant global
4. **Phase finale nouveau prono** : direction du score + score exact + penalties
5. Pondère par les **cotes betting** (bonus si on gagne contre la cote)
6. Trie le classement par : `NombrePronosNouveaux DESC` → `NombrePronosGagnes DESC` → `Points DESC`

### 3.3 Classement d'un groupe (PhaseGroupe.Classement)

- Tri : Points (V=3, N=1, D=0) → Différence de buts → Buts marqués
- Identifie les 2 premiers qualifiés + les **4 meilleurs 3èmes** (tableau de 15 combinaisons hardcodées)

---

## 4. Fonctionnalités utilisateur actuelles

### 4.1 Parcours utilisateur

1. **Inscription** (email + mdp + adresse)
2. **Connexion** (SHA1 ⚠️, OWIN cookies)
3. **Tableau de bord** : liste de mes concours
4. **Rechercher un concours** (par compétition ou créateur) et **s'inscrire**
5. **Saisir mes pronos** (selon la règle `TypeSaisiePronostics`)
6. **Consulter le classement** (global, provisoire, par match, avant une date)
7. **Créer/rejoindre des sous-groupes** (mini-ligues privées)
8. **Statistiques** (séries en cours, % bon prono, cotes gagnées/perdues)
9. **Administration** : saisie des résultats des matchs (rôle admin)

### 4.2 Vues Razor existantes (28 fichiers)

- Auth : `LogIn.cshtml`, `Inscription.cshtml`
- Concours : `Concours.cshtml`, `SearchConcours.cshtml`
- Pronos : `SaisirPronostics.cshtml`, `_Pronostic.cshtml`, `Pronostics.cshtml`
- Scores admin : `ScoresMatch.cshtml`
- Classements : `ClassementConcours.cshtml`, `_ClassementConcours.cshtml`, `_Classement.cshtml`
- Stats : `StatsConcours.cshtml`
- Groupes : `SaisirGroupesClassements.cshtml`, `_GroupeClassement.cshtml`
- Détails : `InformationsPronostic.cshtml`, `InformationsMatch.cshtml`

---

## 5. Nouvelles fonctionnalités proposées

Au-delà du simple portage, voici des ajouts à fort impact pour v2 :

### 🎯 Expérience utilisateur

- **Mode sombre / clair** avec préférence persistée.
- **Dashboard personnalisé** : prochains matchs à pronostiquer, classement en direct, notifications non lues.
- **Onboarding guidé** la première fois (tour interactif).
- **Progressive Web App** (installable, offline-first pour consulter scores sans réseau).
- **Responsive mobile-first** avec gestes tactiles (swipe pour valider un prono).
- **Saisie rapide par clavier** (navigation tab entre matchs, raccourcis ↑↓ pour ajuster scores).

### 🔔 Temps réel & notifications

- **Realtime Supabase** : le classement se met à jour en live quand l'admin saisit un résultat (plus besoin de refresh).
- **Notifications push** (Web Push API) avant la clôture de saisie d'un match.
- **Emails transactionnels** : rappel J-1 des matchs non pronostiqués, récap hebdomadaire du classement.
- **Notifications in-app** : "Tu as été dépassé par X au classement", "Nouveau membre dans ton groupe".

### 🏆 Gamification

- **Badges** et achievements : "Score exact 5 fois de suite", "Roi des outsiders" (gagner contre une cote > 5), "100 % d'une poule", etc.
- **Niveaux et XP** transverses à tous les concours.
- **Streaks** : séries de bons pronos consécutifs, affichées en flamme 🔥.
- **Trophées** de fin de concours (export image sociale).
- **Challenges hebdomadaires** : "Pronostique tous les matchs du week-end".

### 👥 Social

- **Commentaires par match** et trash-talk modéré.
- **Réactions emoji** sur les pronos des autres (visibles après clôture de saisie).
- **Feed d'activité** du concours (qui a pronostiqué quoi, qui a gagné des points).
- **Partage social** : carte image du classement et de ses pronos sur Twitter/Facebook/WhatsApp.
- **Invitations par lien** (pas besoin de chercher un concours, juste cliquer un lien).
- **Chat par concours / par sous-groupe** (optionnel, Supabase Realtime).

### 🤖 Intelligence & data

- **Suggestions IA** : "Statistiquement l'équipe A a 68 % de chances" (via data externe ou modèle simple).
- **Historique personnel** : évolution de mon % de réussite par compétition/sport/type de match.
- **Heatmap des pronos** : quelles équipes je sous-estime systématiquement.
- **Mode "auto-prono par défaut"** : remplit mes pronos avec la cote favorite si j'oublie.
- **Comparateur de pronos** entre deux utilisateurs.

### ⚙️ Administration & données

- **Import automatique des matchs** via API externe (API-Football, Football-Data.org, RapidAPI).
- **Mise à jour automatique des scores** en direct (plus de saisie manuelle).
- **Éditeur visuel de compétition** : drag & drop des équipes dans les groupes, génération automatique des matchs.
- **Templates de concours** (Euro 2024, Coupe du Monde, Champions League) réutilisables.
- **Éditeur visuel de barème** avec preview du classement simulé.
- **Audit trail** : qui a modifié quel score et quand.
- **Export** des pronos et classements en CSV/Excel/PDF.

### 💸 Monétisation (optionnel)

- **Concours privés payants** avec cagnotte (Stripe Connect) — attention à la réglementation jeux d'argent.
- **Version Pro** sans pub, avec statistiques avancées.
- **Abonnement "Créateur"** : limiter les concours gratuits à X participants.

### 🌐 Technique

- **Multi-langue** (i18n) : FR, EN, ES, PT au minimum.
- **Multi-devise / multi-fuseau** pour concours internationaux.
- **API publique** (Supabase Edge Functions) pour intégrations tierces.
- **Extension de sports** : au-delà du foot/rugby, possibilité d'ajouter basket, tennis, F1 (championnat saisonnier).
- **Formats de compétition custom** : ligue toutes rondes, Swiss system, tournoi à élimination.
- **Sécurité** : passage à `bcrypt`/Argon2 via Supabase Auth, 2FA optionnel, RLS strict.
- **Monitoring** : Sentry, PostHog pour analytics produit.

---

## 6. Prompt de régénération complet

> Copie-colle le bloc ci-dessous dans Claude / Cursor / v0 / Bolt / un IDE agentique pour démarrer le projet.

```
Tu es un développeur senior full-stack. Je veux que tu bootstrappes une application web
moderne appelée "PronosticsContest v2", qui est la réécriture complète d'une app .NET
MVC existante en React + Supabase.

═══════════════════════════════════════════════════════════════════════════════
📚 CONTEXTE FONCTIONNEL
═══════════════════════════════════════════════════════════════════════════════
C'est une plateforme de concours de pronostics sportifs (foot/rugby, extensible).
Des utilisateurs créent des "concours" autour d'une "compétition" (Euro, Coupe du
Monde…), configurent un barème de points (14+ coefficients), invitent d'autres
joueurs, saisissent des pronos avant chaque match, et voient évoluer un
classement en temps réel. Des sous-groupes de classement permettent des
mini-ligues privées.

Le scoring distingue :
• Phase de groupes : bon prono, score exact, équipes qualifiées, position de
  poule, poule complète (bonus), pondération par la cote betting.
• Phase finale — "anciens pronos" (saisis avant la phase finale) : équipes
  attendues en quarts/demis/finale, score exact par tour, bon gagnant global.
• Phase finale — "nouveaux pronos" (saisis pendant) : bon vainqueur, score
  exact, penalties si égalité.

═══════════════════════════════════════════════════════════════════════════════
🛠️  STACK TECHNIQUE IMPOSÉE
═══════════════════════════════════════════════════════════════════════════════
• Frontend  : React 18 + TypeScript, Vite, React Router v6
• UI        : Tailwind CSS + shadcn/ui + lucide-react + framer-motion
• State     : Zustand (global léger) + TanStack Query (server state & cache)
• Forms     : React Hook Form + Zod (validation)
• Backend   : Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
• Auth      : Supabase Auth (email/mdp + magic link + Google OAuth)
• Tests     : Vitest + React Testing Library + Playwright (E2E)
• Qualité   : ESLint, Prettier, Husky + lint-staged, commitlint (conventional)
• Déploy    : Vercel (front), Supabase (back), GitHub Actions (CI)
• i18n      : react-i18next (FR par défaut, EN en complément)
• Dates     : date-fns + date-fns-tz
• Charts    : Recharts pour les stats
• Analytics : PostHog (optionnel)

═══════════════════════════════════════════════════════════════════════════════
🎨 DESIGN SYSTEM
═══════════════════════════════════════════════════════════════════════════════
• Style général : moderne, sportif, énergique. Inspirations : Sofascore, FotMob,
  Sorare, Linear.
• Thème clair + thème sombre, basculable et persistant.
• Palette : une couleur primaire vibrante (ex. bleu électrique #2563eb ou
  orange vif #f97316), neutres gris-zinc, accents or/argent/bronze pour
  podium.
• Typo : Inter (UI) + un display font type "Sora" ou "Space Grotesk" pour
  les titres et les chiffres de scores.
• Micro-interactions : animations framer-motion sur validation de prono
  (confetti quand score exact), transitions de lignes dans les classements.
• Mobile-first, breakpoints Tailwind standards, navigation bottom-tabs sur
  mobile, sidebar sur desktop.
• Cartes de match riches (logos SVG des équipes, drapeaux, cotes affichées,
  indicateur du délai de saisie restant).

═══════════════════════════════════════════════════════════════════════════════
🗄️  SCHÉMA SUPABASE (à créer via migrations SQL)
═══════════════════════════════════════════════════════════════════════════════
(Voir section 7 du doc, tables principales résumées :)
• profiles (extends auth.users)          — prénom, nom, avatar, rôle, adresse
• competitions                           — id, libelle, type_sport, dates
• phase_groupes (A–F)
• equipes                                — libelle, short_name, logo
• phases_finales                         — type (32, 16, 8, quart, demi, finale)
• matchs                                 — équipes, date, stade, scores, cotes
• concours                               — compétition, créateur, état, dates,
                                           14+ coefficients de scoring
• concours_participants (N-N)
• pronostics                             — user, match, concours, scores,
                                           penalties, is_nouveau_prono, état
• concours_groupes_classement            — sous-groupes privés
• concours_groupes_classement_membres
• badges / user_badges                   — gamification
• notifications
• comments                               — par match ou par concours

Active Row Level Security partout, avec policies :
• lecture publique des compétitions/équipes/matchs
• pronos visibles uniquement du propriétaire avant clôture de la saisie,
  puis publics dans le concours
• classement calculé côté Postgres (vue matérialisée ou fonction) et
  rafraîchi via trigger quand un résultat de match est saisi

═══════════════════════════════════════════════════════════════════════════════
🧮 LOGIQUE DE SCORING
═══════════════════════════════════════════════════════════════════════════════
Implémente l'algorithme de classement en Postgres (fonction PL/pgSQL
`compute_classement(concours_id uuid)`) pour rester performant et
cohérent. Prévoir :
• une fonction `evaluate_pronostic(prono_id)` qui met à jour l'état du prono
  quand le match est finalisé ;
• un trigger sur `matchs` (UPDATE des scores) qui recalcule tous les pronos
  concernés ;
• une vue `v_classement_concours` exposée en lecture au front ;
• Realtime Supabase sur cette vue pour un live feed.

Respecte scrupuleusement la sémantique d'origine :
• tri final : nb nouveaux pronos DESC → nb pronos gagnés DESC → points DESC
• bonus pondéré par la cote du vainqueur (points = coef * cote)
• distinction ancien prono (saisi avant phase finale) vs nouveau prono
• règle des 4 meilleurs 3èmes avec tableau de 15 combinaisons

═══════════════════════════════════════════════════════════════════════════════
🖼️  PAGES & COMPOSANTS À LIVRER
═══════════════════════════════════════════════════════════════════════════════
Routing (React Router) :
  /                          Landing page (marketing, CTA)
  /auth/login                Login (email/mdp + OAuth + magic link)
  /auth/signup               Inscription
  /auth/forgot               Reset password
  /app                       Layout authentifié (sidebar + topbar)
  /app/dashboard             Dashboard : prochains matchs, ranking, notifs
  /app/concours              Mes concours
  /app/concours/new          Création d'un concours (wizard multi-steps)
  /app/concours/search       Recherche/explore
  /app/concours/:id          Détail : onglets [Pronos] [Classement] [Stats]
                                              [Groupes] [Membres] [Chat]
  /app/concours/:id/pronos   Saisie groupée par phase/groupe
  /app/concours/:id/match/:m Détail d'un match + prono + historique
  /app/concours/:id/groups   Gestion sous-groupes de classement
  /app/profile               Profil + préférences + badges
  /app/admin/*               Pour rôle admin : gestion compétitions, scores…

Composants clés :
  <MatchCard />              avec logos, cotes, date, état
  <ScorePronoInput />        saisie score + penalties, stepper +/-
  <ClassementTable />        realtime, virtualized pour N grands
  <BadgeShowcase />
  <CoefEditor />             édition visuelle des 14 coefficients + preview
  <CompetitionTemplate />    bracket phase finale
  <NotificationCenter />
  <ThemeToggle />

═══════════════════════════════════════════════════════════════════════════════
🚀 FONCTIONNALITÉS CLÉS (v1 de la v2)
═══════════════════════════════════════════════════════════════════════════════
Obligatoires (parité + +) :
1.  Inscription/connexion sécurisée (Supabase Auth, plus de SHA1)
2.  Création/recherche/inscription à un concours (lien d'invitation)
3.  Wizard de création : choix de compétition, dates limites, barème (preset
    "Classique", "Tout ou rien", "Cotes max" + custom)
4.  Saisie de pronos : rapide, au clavier, avec sauvegarde automatique
5.  Classement live en temps réel (Supabase Realtime)
6.  Sous-groupes de classement privés
7.  Statistiques personnelles : % réussite, séries, cotes gagnées
8.  Administration : saisie ou import automatique des résultats
9.  Responsive complet + PWA installable
10. Notifications in-app + emails (rappel J-1, changement de classement)

Nice-to-have (v1.1) :
11. Badges et achievements
12. Chat par concours
13. Import auto des matchs via API-Football
14. Partage social (image générée)
15. Dark mode
16. Multi-langue FR/EN

═══════════════════════════════════════════════════════════════════════════════
📐 ARCHITECTURE DE CODE
═══════════════════════════════════════════════════════════════════════════════
src/
  app/                  providers (query, auth, theme, i18n, router)
  features/
    auth/
    concours/
    pronos/
    classement/
    admin/
    profile/
    notifications/
    badges/
  components/
    ui/                 shadcn (button, card, dialog, etc.)
    layout/             Sidebar, Topbar, BottomNav
    common/
  hooks/                useAuth, useConcours, useRealtimeClassement…
  lib/
    supabase.ts         client typé
    scoring.ts          helpers côté client (le calcul reste en BDD)
    api/                wrappers
  types/                types DB générés par `supabase gen types`
  stores/               zustand
  i18n/
  styles/

═══════════════════════════════════════════════════════════════════════════════
✅ LIVRABLE MINIMUM DE DÉPART
═══════════════════════════════════════════════════════════════════════════════
1. Repo Git initialisé + .gitignore + README détaillé
2. Vite + React + TS + Tailwind + shadcn/ui bootstrappés
3. Supabase : projet + migrations SQL complètes + seed d'exemple
   (Euro 2024 complète : équipes, groupes, matchs, phases finales)
4. Auth fonctionnelle (login/signup + garde de routes)
5. Page /app/concours avec données réelles (TanStack Query + types)
6. Un concours de démo + saisie de pronos + classement qui se met à
   jour en Realtime
7. CI GitHub Actions (lint + typecheck + test + build)
8. Docs : ARCHITECTURE.md, SCORING.md, DEPLOY.md

Commence par poser les questions qui restent ambiguës, puis génère le
code étape par étape. Ne livre pas un seul gros dump : procède par petits
commits logiques (auth → DB → concours list → création → pronos →
classement realtime → admin → polish).
```

---

## 7. Schéma Supabase (SQL)

```sql
-- ============================================================
--  PRONOSTICSCONTEST v2 — Schéma Supabase (Postgres)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type sport_type         as enum ('football', 'rugby', 'basket', 'tennis');
create type competition_status as enum ('draft', 'ongoing', 'finished');
create type concours_status    as enum ('draft', 'ongoing', 'finished');
create type phase_finale_type  as enum ('32e', '16e', '8e', 'quart', 'demi', 'finale', 'petite_finale');
create type prono_type         as enum ('resultat', 'score_exact');
create type prono_state        as enum ('empty', 'pending', 'won', 'won_exact', 'lost');
create type user_role          as enum ('admin', 'user');
create type saisie_mode        as enum ('readonly','avant_date_limite','avant_date_match','saisie_only');

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  prenom      text,
  nom         text,
  avatar_url  text,
  role        user_role not null default 'user',
  -- adresse inline (value object)
  adresse_ligne1 text, adresse_ligne2 text, adresse_ligne3 text,
  code_postal text, ville text, pays text,
  locale      text default 'fr',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- COMPETITIONS ----------
create table competitions (
  id          uuid primary key default uuid_generate_v4(),
  libelle     text not null,
  type_sport  sport_type not null default 'football',
  status      competition_status not null default 'draft',
  logo_url    text,
  date_debut  timestamptz not null,
  date_fin    timestamptz not null,
  created_at  timestamptz default now()
);

create table phases_groupes (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references competitions(id) on delete cascade,
  lettre text not null,
  ordre int not null default 0,
  unique (competition_id, lettre)
);

create table phases_finales (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references competitions(id) on delete cascade,
  type phase_finale_type not null,
  ordre int not null default 0
);

create table equipes (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid references competitions(id) on delete cascade,
  phase_groupe_id uuid references phases_groupes(id) on delete set null,
  libelle text not null,
  short_name text,
  logo_url text,
  pays_iso2 text
);

-- ---------- MATCHS ----------
create table matchs (
  id uuid primary key default uuid_generate_v4(),
  numero int,
  competition_id uuid not null references competitions(id) on delete cascade,
  phase_groupe_id uuid references phases_groupes(id) on delete set null,
  phase_finale_id uuid references phases_finales(id) on delete set null,
  equipe_a_id uuid references equipes(id),
  equipe_b_id uuid references equipes(id),
  date timestamptz not null,
  stade text,
  -- scores (null avant fin du match)
  buts_a int, buts_b int,
  buts_pen_a int, buts_pen_b int,
  -- cotes betting (pour scoring pondéré)
  cote_domicile numeric(6,2),
  cote_nul      numeric(6,2),
  cote_exterieur numeric(6,2),
  -- meta
  url_infos text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (phase_groupe_id is not null or phase_finale_id is not null)
);

create index on matchs (competition_id);
create index on matchs (date);

-- ---------- CONCOURS ----------
create table concours (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references competitions(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  titre text not null,
  description text,
  status concours_status not null default 'ongoing',
  date_debut timestamptz default now(),
  date_fin timestamptz,
  date_limite_saisie timestamptz,
  saisie_mode saisie_mode not null default 'avant_date_match',
  -- 14+ coefficients
  coef_bon_prono int default 1,
  coef_score_exact int default 2,
  coef_bonnes_equipes_qualifiees int default 1,
  coef_bonnes_positions_poules int default 1,
  coef_poule_complete int default 2,
  coef_bon_prono_nouveau int default 2,
  coef_score_exact_nouveau int default 2,
  coef_penalty_nouveau int default 1,
  coef_score_exact_penalty_nouveau int default 2,
  coef_equipes_qualif_quarts_ancien int default 2,
  coef_equipes_qualif_demis_ancien int default 3,
  coef_equipes_qualif_finale_ancien int default 4,
  coef_vainqueur_competition_ancien int default 5,
  coef_score_exact_huitiemes_ancien int default 2,
  coef_score_exact_quarts_ancien int default 3,
  coef_score_exact_demis_ancien int default 4,
  coef_score_exact_finale_ancien int default 5,
  coef_equipes_qualif_nouveau int default 1,
  invite_code text unique default encode(gen_random_bytes(6),'base64'),
  created_at timestamptz default now()
);

create table concours_participants (
  concours_id uuid references concours(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (concours_id, user_id)
);

-- ---------- PRONOSTICS ----------
create table pronostics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  concours_id uuid not null references concours(id) on delete cascade,
  match_id uuid not null references matchs(id) on delete cascade,
  type prono_type not null default 'score_exact',
  state prono_state not null default 'empty',
  buts_a int, buts_b int,
  buts_pen_a int, buts_pen_b int,
  equipe_a_id uuid references equipes(id),
  equipe_b_id uuid references equipes(id),
  is_nouveau_prono bool not null default true,
  points_calcules int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, concours_id, match_id)
);

-- ---------- SOUS-GROUPES ----------
create table concours_groupes (
  id uuid primary key default uuid_generate_v4(),
  concours_id uuid references concours(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  titre text not null
);

create table concours_groupes_membres (
  groupe_id uuid references concours_groupes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (groupe_id, user_id)
);

-- ---------- GAMIFICATION ----------
create table badges (
  code text primary key,
  libelle text not null,
  description text,
  icon text,
  rarity text default 'common'
);

create table user_badges (
  user_id uuid references profiles(id) on delete cascade,
  badge_code text references badges(code),
  awarded_at timestamptz default now(),
  context jsonb,
  primary key (user_id, badge_code)
);

-- ---------- NOTIFICATIONS & CHAT ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  type text, title text, body text, payload jsonb,
  read bool default false,
  created_at timestamptz default now()
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  concours_id uuid references concours(id) on delete cascade,
  match_id uuid references matchs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

-- ---------- RLS (exemples) ----------
alter table profiles enable row level security;
create policy "profiles_self_rw" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table pronostics enable row level security;
create policy "pronos_owner_rw" on pronostics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pronos_visible_after_lock" on pronostics
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from matchs m
      where m.id = match_id and m.date <= now()
    )
  );

-- (ajouter policies pour concours, participants, comments, etc.)

-- ---------- VUE CLASSEMENT ----------
-- à implémenter via fonction compute_classement(concours_id uuid)
-- renvoyant table (user_id, points, nb_pronos_gagnes, nb_score_exact, ...)
-- puis vue v_classement_concours materialisée + refresh via trigger sur matchs
```

---

## 8. Roadmap d'implémentation

### 🥇 Sprint 0 — Setup (1 semaine)

Repo initialisé, CI/CD, Vite+React+TS+Tailwind+shadcn, projet Supabase créé, migrations de base, environnements dev/staging, seed Euro 2024.

### 🥈 Sprint 1 — Auth & structure (1 semaine)

Supabase Auth (mdp + Google + magic link), routes protégées, layout (sidebar/topbar/bottom-nav), theme dark/light, i18n FR/EN, profil utilisateur.

### 🥉 Sprint 2 — Concours & compétitions (1–2 semaines)

Liste/recherche/création de concours (wizard), inscription via lien, affichage de la compétition (groupes, matchs, calendrier), édition de barème avec preview.

### 🏅 Sprint 3 — Pronos (1–2 semaines)

Saisie rapide groupée par phase, validation Zod, auto-save, règles de verrouillage (`saisie_mode`), gestion anciens/nouveaux pronos, états visuels.

### 🏅 Sprint 4 — Scoring & classement (2 semaines) — **cœur**

Fonction PL/pgSQL `compute_classement`, triggers de recalcul, vue matérialisée, Realtime, table de classement virtualisée, classement global + par match + avant-date + sous-groupes.

### 🏅 Sprint 5 — Admin & import (1 semaine)

Saisie manuelle des résultats, import auto via API-Football, éditeur visuel des groupes, templates de compétition.

### 🏅 Sprint 6 — Social & gamification (1–2 semaines)

Badges, streaks, chat, commentaires, notifications in-app + emails, partage social.

### 🏅 Sprint 7 — Polish & lancement (1 semaine)

PWA, performance (lazy loading, virtualization, images optimisées), audits Lighthouse, tests E2E Playwright sur parcours critiques, docs, onboarding, feedback loop.

---

## 📎 Annexes

- **Sécurité** : passage impératif de SHA1 à Supabase Auth (bcrypt), RLS stricte, protection CSRF native, pas de secret en clair, rotation des tokens API externes.
- **Performance** : vue matérialisée pour le classement, refresh ciblé par trigger, pagination par curseur, virtualisation des grandes listes, cache TanStack Query.
- **Dette à ne pas reporter** : algorithme `_classement()` de 500 lignes → à reconstruire proprement en SQL avec tests unitaires (pgTAP) sur 10–15 scénarios (poule complète, 3èmes meilleurs, égalités, etc.).
- **Migration des données** : script one-shot `SQL Server → Postgres` (ETL) pour récupérer comptes, concours historiques, pronos, compétitions.

---

*Document généré pour la réécriture de PronosticsContest.*
