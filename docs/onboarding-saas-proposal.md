# Proposition — Onboarding & lancement CdM 2026

> **Scope** : transformer PronosticsContest v2 (app MVP fonctionnelle Sprint 0 → 8) en produit vendable pour la Coupe du Monde 2026, avec un onboarding tendu et un viral loop en place.
>
> **Cadre validé** (élicitation + itération) :
>
> - Cible : amis / famille + collègues de bureau
> - Aha moment visé : **rejoindre un concours** (entrée sociale via code)
> - Aha secondaire : **créer un concours** (organisateur)
> - **Décision modèle éco (tranchée le 2026-04-24)** :
>   - **Phase 1 — Sprint 9 + CdM 2026 : 100 % gratuit, aucune barrière payante.**
>   - **Phase 2 — post-CdM (aout 2026+) : modèle économique informé par les données** (don, pass événement, white-label ou freemium — à décider après la compétition).
> - **Contrainte dure : pas pay-to-win** (résolue par design en Phase 1 puisque tout est gratuit).
> - Ambition : sprint d'1 mois, objectif lancement CdM 2026.
> - Nom : ouvert à un rebrand.

---

## 1. Audit rapide de l'existant

### Ce qui existe déjà (et qui aide)

| Brique                           | État  | Verdict onboarding                                                                                      |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| Landing `/`                      | eager | Existe mais "trop vague" (friction identifiée). À refondre.                                             |
| Auth (login / signup / magic)    | ✅    | Solide (Zod, guards, i18n FR/EN). Enrichir côté wizard post-signup.                                     |
| App shell (Sidebar/Topbar/Nav)   | ✅    | OK. Manque point d'entrée "checklist" et slot pour product tour.                                        |
| Concours (create/join/list)      | ✅    | RPC `join_concours_by_code` déjà en place → surface technique de l'aha moment prête.                    |
| Pronos (grid, auto-save, verrou) | ✅    | UX déjà très bonne. Besoin coach-mark "1er prono" + empty state clair.                                  |
| Classement Realtime              | ✅    | Énorme atout rétention. Sous-exploité côté onboarding (pas d'ancrage émotionnel à la fin du 1er match). |
| Badges (28, 4 tiers)             | ✅    | Moteur d'engagement déjà en place. À brancher sur la checklist d'onboarding.                            |
| Jokers (acquisition + conso)     | ✅    | Profondeur de jeu déjà énorme. **En Phase 1, 100 % gagnables en jeu**, rien à vendre.                   |
| Chat + notifs + PWA              | ✅    | Rétention déjà câblée. À brancher dans parcours d'activation ("ton pote a parié").                      |
| Admin                            | ✅    | Interne. Pas dans l'onboarding utilisateur.                                                             |

### Ce qui manque (et qui bloque le lancement)

1. **Landing produit-marché** : il faut vendre le produit en 5 secondes avec preuve sociale, screenshots, CTA clair. Aujourd'hui c'est générique.
2. **Parcours FTUE (First Time User Experience)** : après signup, l'utilisateur arrive dans un dashboard vide. Aucune guidance.
3. **Empty states pauvres** : la plupart des écrans sans données renvoient un texte muted. Pas d'illustration, pas d'action.
4. **Pas de checklist d'activation** : aucun fil rouge qui dit "voilà les 3 choses à faire pour profiter de l'app".
5. **Pas de viral loop** : le code d'invitation existe mais n'est pas mis en avant au bon moment.
6. **Moment émotionnel du 1er match fini** : sous-exploité (pas d'auto-scroll classement, pas de toast delta rang, pas de partage de résultat).
7. **Pas d'instrumentation analytics** : aucune donnée pour décider du modèle éco de la Phase 2.

---

## 2. Positionnement — 100 % gratuit Phase 1, monétisation Phase 2

### Principe directeur Phase 1

> **Tout est gratuit pour tout le monde jusqu'à la fin de la CdM 2026.**
>
> Créer un concours, le rejoindre, saisir des pronos, gagner des badges, utiliser les jokers, chatter, recevoir des notifs, installer la PWA — tout est ouvert. Pas de tier, pas de limite, pas d'upsell, pas de bandeau "passe au Premium".

### Pourquoi cette décision

1. **La cible tue le freemium** : amis/famille + collègues, c'est des cercles de 5-30 personnes. Si l'organisateur doit payer pour inviter ses 8 collègues, 95 % abandonnent ou basculent sur un concurrent gratuit. La friction paiement est mortelle sur ce segment.
2. **La CdM est une fenêtre ponctuelle** : 6 semaines d'usage intense, puis dormance jusqu'à la CAN / l'Euro / la prochaine CdM. Un abonnement récurrent sur un usage événementiel = mauvais modèle.
3. **Tu es seul et ton temps est limité** : toute la machinerie Stripe + gating + pricing + upgrade flow, c'est ~10 jours de Sprint. En Phase 1 on les réalloue à polir activation + viralité.
4. **Tu n'as pas de données** : lancer payant à l'aveugle = optimiser un mauvais funnel. Phase 1 = collecter la donnée pour décider intelligemment en Phase 2.
5. **Le "pas pay-to-win" est résolu par design** : si rien n'est payant, le débat n'existe pas.

### Phase 2 — options à évaluer après la CdM

À trancher sur la base des données récoltées pendant la CdM. Aucune décision prise pour l'instant, mais les 4 pistes sérieuses :

| Option                       | Principe                                                                            | Avantages                                         | Risques                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| **Don volontaire**           | Bouton Ko-fi / Tipeee, aucun gating                                                 | Zéro friction, aligné avec l'esprit du produit    | Revenu modeste et volatil                                  |
| **Pass événement**           | 2 à 5 € one-shot pour accès VIP d'un concours (cagnotte, stats avancées, branding)  | Aligné sur usage événementiel, mental money léger | Friction non-nulle, besoin de payment rails                |
| **White-label / B2B**        | Vente à médias, ligues amateurs, bars, marques pour instancier leur concours marqué | Marge élevée, peu d'users à supporter, récurrent  | Cycle de vente long, demande outillage admin spécifique    |
| **Freemium post-validation** | Si les données montrent une willingness-to-pay identifiable sur un segment précis   | Modèle éprouvé, scalable                          | Friction cible grand public, risque de casser la confiance |

La décision se prendra **après** la CdM avec les chiffres en main (WAU, rétention cohortes, K-factor, concentration d'usage, segments "power organisateurs" vs "joueurs occasionnels").

### Crochets techniques à poser dès Sprint 9 pour garder les options ouvertes

Pas de gating, mais on prépare le schéma pour ne pas refondre plus tard :

- Colonne `profiles.plan_code text not null default 'free'` avec CHECK `in ('free','host','pro','sponsor')`. Inerte en Phase 1, utilisable plus tard.
- Colonne `concours.is_sponsored boolean default false` + `concours.sponsor_brand text null`. Inerte en Phase 1, utilisable pour white-label/sponsoring.
- Colonne `concours.paid_features jsonb default '{}'::jsonb`. Zone libre pour flagger des features Premium activées par concours en Phase 2.
- Event bus analytics dès Sprint 9 (voir §7 W4) : chaque action clé logguée → on aura les données pour décider.

Coût aujourd'hui : ~10 minutes de migration. Économie plus tard : pas de refactor de schéma.

---

## 3. Architecture d'onboarding — le parcours complet

### Vue d'ensemble (7 étapes, objectif : 1er prono en < 3 minutes)

```
1. Landing        → "Je comprends ce que c'est et je veux essayer"
2. Signup Wizard  → Compte créé avec intent capturée
3. Welcome        → Célébration + choix de trajectoire
4. Entrée concours → Rejoindre (aha principal) OU créer (aha secondaire)
5. First prono    → Coach-mark sur la grille
6. Classement     → Moment émotionnel au 1er match fini
7. Invite loop    → "Invite 3 potes, débloque un joker starter"
```

### Détail par étape

#### Étape 1 — Landing refondue (`/`)

**Objectif** : convertir un visiteur en inscrit en 30 secondes.

**Structure** :

1. **Hero** : headline émotionnel ("Prédis la Coupe du Monde avec tes potes."), sub-headline bénéfice, **CTA double** (`J'ai un code d'invitation` en primary / `Créer un concours gratuit` en secondary), screenshot produit.
2. **Social proof strip** : "X concours créés, Y pronos saisis, Z utilisateurs" (chiffres Supabase agrégés via vue publique).
3. **Comment ça marche (3 étapes)** : Rejoindre / Pronostiquer / Grimper au classement — illustrations simples, pas de copie.
4. **Features** : scoring par cote, jokers, badges, chat, realtime, PWA offline. 6 cartes max.
5. **"100 % gratuit"** : bloc court et assumé. "Pas d'abonnement, pas de paywall, pas de pub intrusive pendant la CdM." Argument de différenciation fort vs concurrents.
6. **FAQ** : 5 questions max ("C'est vraiment gratuit ?", "Comment on crée un concours ?", "Ça marche pour le rugby ?", "C'est limité dans le temps ?", "Mes données sont protégées ?").
7. **Footer** : mentions, CGU, contact, Twitter/X.

**Métriques** : `landing_view`, `landing_cta_click` (par CTA), `landing_scroll_depth`.

#### Étape 2 — Signup wizard (`/auth/signup`)

**Objectif** : signup rapide + capture d'intent.

**Flow 3 étapes courtes** :

1. **Email + password** (OAuth social à ajouter post-CdM).
2. **Prénom + nom + sport préféré** (foot / rugby) — sport par défaut = foot, pré-rempli.
3. **Intent** : "Tu viens avec un code d'invitation ?" → si oui, input code + prévalidation RPC `join_concours_by_code` côté client. Si non, skip.

L'intent est **stockée en session** et utilisée à l'étape 4 pour personnaliser la suite.

**Métriques** : `signup_step_N_reached`, `signup_complete`, `signup_with_code` (conversion aha).

#### Étape 3 — Welcome (`/app/welcome`)

**Objectif** : célébrer + orienter. Page plein écran, pas de sidebar.

**Contenu** :

- Micro-animation confetti 2 secondes (framer-motion, pas de lib lourde).
- Headline : "Bienvenue {{prenom}} 🎉" (emoji par exception sur ce moment de fête).
- Sub : "Tu es à 2 clics de ton premier pronostic."
- 2 cartes en face-à-face :
  - **"J'ai un code d'invitation"** → ouvre `JoinByCodeDialog` pré-rempli si intent capturée à l'étape 2.
  - **"Je découvre seul"** → redirige vers `/app/discover` (concours publics) ou propose un CTA secondaire "Créer mon concours" (direct, sans friction).

**Composant nouveau** : `<WelcomeHero />`.

#### Étape 4 — Entrée dans un concours

**Branche principale "Rejoindre"** (aha moment n°1) : l'utilisateur entre un code, arrive sur la fiche du concours avec un bandeau "Tu viens de rejoindre {{nom}} 🎉", et un CTA énorme "Saisir mes pronostics →".

**Branche secondaire "Créer"** (aha moment n°2) : l'utilisateur arrive sur `/app/concours/new`, formulaire simple (nom, sport, compétition, visibilité). Pas de teaser Premium, pas de limite. À la création, bandeau célébration + CTA immédiat "Inviter tes amis" + code d'invitation visible.

**Composants nouveaux** : aucun spécifique au gating. On réutilise les composants concours existants + on enrichit la page de création d'un `<ReferralBanner />` de célébration.

#### Étape 5 — Premier pronostic (coach-mark sur la grille)

**Objectif** : activation = 1 prono saisi.

**Coach-marks séquentiels** (3 tooltips) :

1. Sur la 1re `MatchCard` : "Entre un score. Ton choix est auto-sauvegardé."
2. Sur le filtre statut : "Tu pourras filtrer tes pronos en attente ou verrouillés."
3. Sur le CTA classement : "Après le coup d'envoi, vibre devant le classement en direct."

Géré par un state `onboarding.steps_completed` persisté côté DB (table `user_onboarding_progress`), pas du localStorage — important pour reprise multi-device.

**Composant nouveau** : `<ProductTour />` (wrapper custom, ~100 lignes).

#### Étape 6 — Moment émotionnel au 1er match fini

**Levier** : Realtime + notification. Dès qu'un match lié à un prono de l'user passe `finished`, la notif `match_result` pousse une CTA "Voir ton score → classement". La page classement ouvre avec **auto-scroll vers la ligne de l'user + toast delta rang** ("+12 places ⬆️" en vert ou "-3 places ⬇️" en orange).

**Renforcements** :

- Top 3 → confetti + option partage social (image générée de la ligne classement).
- Badge débloqué → modal célébration avec illustration du badge.
- Score parfait → micro-animation sur le toast.

Déjà quasi tout en place, reste le toast delta, l'auto-scroll et la génération d'image partageable.

#### Étape 7 — Viral loop / invitation

**Objectif** : chaque utilisateur invite au moins 3 personnes.

**Déclencheurs** :

- Après 1er prono saisi : toast "Invite tes potes à rejoindre le concours". CTA partage natif (Web Share API sur PWA).
- Sur la fiche concours : bloc "Invite" toujours visible pour un membre, avec le code en gros, QR code, boutons partage (WhatsApp, SMS, email, copier le lien).
- Après création d'un concours : bandeau persistant "Ton concours est vide — invite tes amis !" jusqu'à 3 participants.

**Récompense d'invitation** (pas d'argent — c'est du jeu) : 1 joker starter offert tous les 3 invités qui rejoignent effectivement (tracké via `referrer_id` sur `concours_participants`). Notifié via `notifications.type='referral_milestone'` (nouveau type).

**Composants nouveaux** : `<ReferralBanner />`, `<ShareCard />` (QR + bouton share natif).

---

## 4. Nouveaux composants design system

### 4.1 Composants à créer (8 nouveaux — version simplifiée Phase 1)

| Composant                   | Rôle                                                        | Priorité |
| --------------------------- | ----------------------------------------------------------- | -------- |
| `<WelcomeHero />`           | Page `/welcome`, héros + choix de trajectoire               | P0       |
| `<OnboardingChecklist />`   | Widget sidebar : 5 tâches d'activation, progress %          | P0       |
| `<ProductTour />`           | Coach-marks contextualisés, séquentiels, skipable           | P0       |
| `<EmptyStateIllustrated />` | Remplace tous les empty states textuels, illustration + CTA | P0       |
| `<ReferralBanner />`        | Bandeau "Invite tes potes", visible après 1er prono         | P1       |
| `<ShareCard />`             | QR code + Web Share API, téléchargeable en image            | P1       |
| `<SocialProofStrip />`      | Chiffres agrégés pour landing + welcome                     | P1       |
| `<RankDeltaToast />`        | Toast "+12 places ⬆️" post-match, animé                     | P2       |

**Retiré par rapport à la v1 de la proposition** : `<FeatureGateCard />`, `<UpgradeModal />`, `<TrialBanner />`, `<PricingTable />`. Ils pourront être créés en Phase 2 si le modèle éco choisi le demande.

### 4.2 Design tokens à ajouter

**Couleurs** :

- `--color-brand-gradient-from` / `--color-brand-gradient-to` : dégradé pour les héros landing/welcome (garder le bleu primaire actuel, ajouter un dégradé pour les 2 écrans marketing).
- `--color-success-soft` / `--color-warning-soft` / `--color-danger-soft` : variantes 5 % pour bandeaux non intrusifs.
- ~~`--color-premium-gold`~~ : **reporté Phase 2** (inutile sans Premium).

**Typographie** :

- Ajouter un display `--font-display` pour les h1 de landing/welcome (Cal Sans ou fallback Inter 700 + tracking -0.02em).
- Le reste reste Inter / Tailwind defaults.

**Motion** :

- `--motion-ease-celebration` : `cubic-bezier(.16,1,.3,1)` pour les célébrations (confetti, bump, rank delta).
- Durations inchangées.

**Illustrations** :

- 1 set SVG spot (10 illustrations) pour les empty states. Style outline fin, 2 couleurs (primaire + accent), cohérent avec `lucide-react`. Départ : `unDraw` (libre) ou `Open Peeps` (libre).

### 4.3 Composants existants à enrichir

| Composant                | Enrichissement                                                   |
| ------------------------ | ---------------------------------------------------------------- |
| `Sidebar`                | Ajouter slot `<OnboardingChecklist />` top, collapsible          |
| `Topbar`                 | (inchangé — pas de badge Premium en Phase 1)                     |
| `MatchCard`              | Ajouter data-attr pour ancres `ProductTour`                      |
| `ConcoursDetailPage`     | Ajouter `<ReferralBanner />` + `<ShareCard />` si membre         |
| `EmptyState` (générique) | Refactor pour utiliser `<EmptyStateIllustrated />`               |
| `ClassementPage`         | Auto-scroll vers ligne user + `<RankDeltaToast />`               |
| `LandingPage`            | Refonte complète (hero + preuve sociale + FAQ + "100 % gratuit") |

---

## 5. Schéma DB — migrations Sprint 9

### 5.1 Migration `20260501120000_onboarding_progress.sql`

```sql
-- Table progression onboarding (persistée DB, pas localStorage)
create table user_onboarding_progress (
  user_id uuid primary key references profiles(id) on delete cascade,
  welcomed_at timestamptz,
  first_concours_joined_at timestamptz,
  first_prono_saved_at timestamptz,
  first_classement_viewed_at timestamptz,
  first_invite_sent_at timestamptz,
  tour_steps_completed jsonb not null default '[]'::jsonb,
  checklist_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS : self only
alter table user_onboarding_progress enable row level security;
create policy uop_select_self on user_onboarding_progress for select using (auth.uid() = user_id);
create policy uop_upsert_self on user_onboarding_progress for insert with check (auth.uid() = user_id);
create policy uop_update_self on user_onboarding_progress for update using (auth.uid() = user_id);

-- Trigger auto-row à la création du profil
create or replace function handle_onboarding_row_on_profile_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into user_onboarding_progress(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profiles_onboarding_init
  after insert on profiles
  for each row execute function handle_onboarding_row_on_profile_insert();
```

### 5.2 Migration `20260501130000_referrals.sql`

```sql
-- Tracking de qui a invité qui (pour attribution jokers)
alter table concours_participants add column referrer_id uuid references profiles(id) on delete set null;

create index concours_participants_referrer_idx on concours_participants(referrer_id)
  where referrer_id is not null;

-- Trigger : à chaque 3e invité qui rejoint effectivement, offrir 1 joker starter au referrer
create or replace function handle_referral_milestone()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
begin
  if new.referrer_id is null then return new; end if;
  select count(*) into v_count from concours_participants where referrer_id = new.referrer_id;
  if v_count % 3 = 0 then
    insert into user_jokers(user_id, concours_id, joker_code, acquired_from)
      values (new.referrer_id, new.concours_id, 'double', 'gift')
      on conflict do nothing;
    insert into notifications(user_id, type, payload)
      values (new.referrer_id, 'referral_milestone', jsonb_build_object('count', v_count));
  end if;
  return new;
end $$;
create trigger concours_participants_referral_milestone
  after insert on concours_participants
  for each row execute function handle_referral_milestone();

-- (Nouveau type de notif : mettre à jour le CHECK de notifications.type_check)
```

### 5.3 Migration `20260501140000_future_proof_hooks.sql`

```sql
-- Crochets inertes en Phase 1, activables en Phase 2
alter table profiles add column plan_code text not null default 'free'
  check (plan_code in ('free','host','pro','sponsor'));

alter table concours add column is_sponsored boolean not null default false;
alter table concours add column sponsor_brand text;
alter table concours add column paid_features jsonb not null default '{}'::jsonb;

-- Pas de policy additionnelle : ces colonnes ne sont lues par aucun helper en Phase 1.
```

### 5.4 Migration `20260501150000_landing_stats_view.sql`

```sql
-- Vue publique agrégée pour le social proof de la landing
create or replace view public.v_landing_stats as
select
  (select count(*) from concours) as nb_concours,
  (select count(*) from pronos) as nb_pronos,
  (select count(*) from profiles) as nb_users;

-- Accessible anon (landing avant signup)
grant select on public.v_landing_stats to anon, authenticated;
```

---

## 6. Rebrand — pistes de noms

Tu es ouvert au rebrand. Quelques pistes orientées produit grand public (à valider par dispo domaine + INPI) :

| Nom             | Ton                    | Pour                      | Risque               |
| --------------- | ---------------------- | ------------------------- | -------------------- |
| **Pronok**      | Court, prononçable, FR | Amis/famille, ton ludique | "pronok" existe déjà |
| **Matchup**     | Anglo, universel       | Ouvert international      | Très concurrentiel   |
| **Derby**       | Sport, FR/EN, noble    | Audience large            | Utilisé ailleurs     |
| **Pronoo**      | Playful, enfantin      | Grand public, humour      | Nichesque            |
| **Kickoff**     | Clair, événementiel    | Foot only, transposable   | Générique            |
| **Pronos Club** | Parle à la cible       | Concours entre potes      | Moins mémorable      |

**Recommandation** : si ce n'est pas déjà pris, garder **"PronosContest"** pour le lancement CdM (pas de risque, continuité produit), et lancer un sous-chantier naming dédié _après_ la CdM si les KPIs justifient un rebrand. Le nom n'est pas ton problème n°1 en Phase 1.

---

## 7. Roadmap Sprint 9 — 4 semaines (version 100 % gratuit)

### Semaine 1 — Landing + fondations visuelles

- **9.A.1** Tokens design étendus (`--color-brand-gradient-*`, motion celebration).
- **9.A.2** `<EmptyStateIllustrated />` + set initial de 5 illustrations (pronos vides, concours vides, classement vide, notifs vides, chat vide). Refactor des empty states existants.
- **9.A.3** Landing refondue : hero + social proof (vue `v_landing_stats`) + comment ça marche + features + bloc "100 % gratuit" + FAQ + footer.
- **9.A.4** `<SocialProofStrip />` branché sur la vue.
- **9.A.5** Tests Vitest + a11y check (contraste hero, keyboard nav).

### Semaine 2 — FTUE + checklist + product tour

- **9.B.1** Migration `user_onboarding_progress` + types TS régénérés.
- **9.B.2** Migration `future_proof_hooks` (colonnes `plan_code`, `is_sponsored`, etc.).
- **9.B.3** Signup wizard 3 étapes + capture d'intent (code invit stocké en session).
- **9.B.4** `<WelcomeHero />` page `/app/welcome` + confetti framer-motion.
- **9.B.5** `<OnboardingChecklist />` dans sidebar : 5 tâches (rejoindre, saisir 1 prono, voir classement, personnaliser profil, inviter 1 ami).
- **9.B.6** `<ProductTour />` séquence 3 coach-marks sur `/pronos`, persistance DB.
- **9.B.7** Tests Vitest + E2E du parcours signup → 1er prono.

### Semaine 3 — Viral loop + moment émotionnel (ancien créneau Stripe, réalloué)

- **9.C.1** Migration `referrals` (`referrer_id` sur `concours_participants` + trigger milestone + nouveau type notif `referral_milestone`).
- **9.C.2** `<ReferralBanner />` visible après 1er prono et sur création concours.
- **9.C.3** `<ShareCard />` avec QR code (lib `qrcode` ~5 Ko) + Web Share API + génération image partageable (canvas).
- **9.C.4** Auto-scroll `ClassementPage` vers ligne user + `<RankDeltaToast />` calculé via diff rang précédent / rang courant (stocké en session).
- **9.C.5** Partage de résultat post-match (image générée du podium/ma ligne) avec OG preview propre.
- **9.C.6** Tests Vitest sur les 3 composants + tests SQL sur le trigger `referral_milestone` (dédup, idempotence).
- **9.C.7** Update i18n FR/EN.

### Semaine 4 — Analytics + rebrand léger + polish + launch checklist

- **9.D.1** Instrumentation analytics (recommandation : **Plausible self-hosted ou Pirsch**, RGPD-friendly sans cookie banner). Events clés : `landing_view`, `landing_cta_click`, `signup_started`, `signup_complete`, `signup_with_code`, `welcome_viewed`, `concours_joined`, `first_prono_saved`, `first_classement_viewed`, `referral_sent`, `referral_milestone_reached`, `badge_earned`.
- **9.D.2** Vue matérialisée `v_landing_stats` avec refresh nocturne (cron Supabase).
- **9.D.3** Pages légales à jour : CGU, politique de confidentialité, mentions légales. Obligatoire pour lancer publiquement en France.
- **9.D.4** OG image + Twitter card dédiées lancement CdM (visuel fort).
- **9.D.5** SEO : `robots.txt` + `sitemap.xml` à jour + meta description par page (landing + pricing supprimée + /concours publics indexables).
- **9.D.6** Audit Lighthouse mobile sur landing + `/welcome` + fiche concours (cibles du `docs/perf-checklist.md`).
- **9.D.7** **Launch checklist** : tests E2E du parcours complet, vérif PWA offline, vérif notif push PWA, vérif emails transactionnels (confirmation, reset password), charge test sur 100 users simulés (k6).
- **9.D.8** Polish final : typos, cohérence i18n, micro-animations.

### Livrable final Sprint 9

- Landing vendable 100 % gratuite assumée.
- Parcours FTUE complet (signup → 1er prono en < 3 min).
- Viral loop actif (bandeaux + share + milestone jokers).
- Moment émotionnel post-match renforcé (auto-scroll + toast delta + partage).
- Analytics en place pour piloter la Phase 2.
- Crochets techniques posés pour brancher un modèle éco plus tard sans refactor.

### Budget temps réalloué par rapport à la v1 (freemium)

| Poste                                                                               | v1 freemium | v2 gratuit   |
| ----------------------------------------------------------------------------------- | ----------- | ------------ |
| Stripe + webhook + gating RLS                                                       | ~5 jours    | 0            |
| `<PricingTable />` + `<UpgradeModal />` + `<FeatureGateCard />` + `<TrialBanner />` | ~3 jours    | 0            |
| Edge Functions Stripe + tests                                                       | ~2 jours    | 0            |
| Viral loop + moment émotionnel                                                      | ~2 jours    | ~5 jours     |
| Analytics + pages légales + launch checklist                                        | ~1 jour     | ~4 jours     |
| **Total gagné pour polish**                                                         | —           | **~5 jours** |

---

## 8. Ce qu'on ne fait PAS en Sprint 9

- ❌ **Aucun paywall, aucun tier payant, aucune mention "Premium"** nulle part dans l'UI.
- ❌ **Pas de Stripe, pas de webhook, pas de gating RLS** (reporté Phase 2 si choisi).
- ❌ **Pas de pub in-app** (complexité CMP/RGPD, risque UX, à évaluer Phase 2 si choisi).
- ❌ **Pas de rebrand complet** (faisable en parallèle post-CdM si KPIs justifient).
- ❌ **Pas d'OAuth social** (Google/Apple) — à ajouter post-CdM après validation produit.
- ❌ **Pas d'app store iOS/Android natif** — la PWA Sprint 7 couvre 90 % du besoin.
- ❌ **Pas d'EN sur les 3 écrans marketing** (landing/welcome/FAQ) — FR only pour le lancement CdM, EN post-CdM.

---

## 9. Questions ouvertes (à trancher avant ou pendant Sprint 9)

1. **Rebrand** : on garde "PronosContest" pour le lancement ? (recommandation : oui, on re-tranche post-CdM).
2. **Hébergement analytics** : Plausible self-hosted (~5 €/mois Scaleway), Pirsch (~6 €/mois hosté), PostHog self-hosted (gratuit mais infra à étendre) ? (recommandation : Pirsch si budget OK, sinon Plausible self-hosted).
3. **Illustrations empty states** : libres (unDraw, Open Peeps) ou commissionnées (Delesign, ~300 €) ? (recommandation Phase 1 : libres, upgrader en Phase 2 si besoin).
4. **Milestone invitation** : 3 invités = 1 joker ? Ou 5 = 1 joker ? (recommandation : commencer à 3 pour forte traction virale, ajuster selon data).
5. **Hosting** : Vercel + Supabase free tier tiennent combien de users concurrents ? (vérifier sur les free tiers avant lancement, prévoir migration Pro si besoin).
6. **Pages légales** : tu as déjà des CGU ou on part from scratch ? (il faut absolument les avoir avant le 1er jour de lancement public).

---

## 10. KPIs cibles Sprint 9 → fin CdM 2026

Pour la prise de décision Phase 2, on vise ces ordres de grandeur (à comparer avec réalité + benchmarks concurrents) :

| Métrique                                 | Baseline | Cible post-Sprint 9 + CdM |
| ---------------------------------------- | -------- | ------------------------- |
| Landing → signup (conversion)            | ?        | ≥ 8 %                     |
| Signup → 1er prono (activation J+0)      | ?        | ≥ 60 %                    |
| 1er prono → 3e prono (rétention J+7)     | ?        | ≥ 40 %                    |
| Utilisateurs actifs hebdo avec 1+ invité | ?        | ≥ 30 %                    |
| K-factor (invitations → signups)         | ?        | ≥ 0.5 (idéal ≥ 1)         |
| MAU post-CdM (aout-sept 2026)            | 0        | à observer                |
| % organisateurs de concours              | ?        | ≥ 20 % des actifs         |

Les 3 dernières lignes conditionneront directement le choix de Phase 2 : si 20 % des users créent un concours, le white-label ou le pass événement ont du sens. Si le MAU s'effondre post-CdM, on est sur un usage purement événementiel et il faut pivoter sur un modèle one-shot.

---

## Annexe — diagramme du parcours

```
┌────────────┐     ┌──────────────┐     ┌──────────┐
│   Landing  │ ──▶ │ Signup wizard│ ──▶ │ Welcome  │
└────────────┘     └──────────────┘     └────┬─────┘
                                             │
                           ┌─────────────────┴─────────────────┐
                           ▼                                   ▼
                   ┌──────────────┐                   ┌─────────────────┐
                   │  Rejoindre   │                   │     Créer       │
                   │   (code)     │                   │  (gratuit !)    │
                   └──────┬───────┘                   └────────┬────────┘
                          │                                    │
                          └──────────────┬─────────────────────┘
                                         ▼
                                ┌────────────────┐
                                │  Fiche concours│
                                │ + ReferralBanner│
                                └────────┬───────┘
                                         ▼
                                ┌────────────────┐
                                │  Grille pronos │
                                │ (+ coach-marks)│
                                └────────┬───────┘
                                         ▼
                                ┌────────────────┐
                                │  1er prono ✅  │  ◀── activation
                                └────────┬───────┘
                                         ▼
                                ┌────────────────┐
                                │  1er match fini│
                                │  → classement  │  ◀── moment émotionnel
                                │   + toast delta│
                                │   + partage    │
                                └────────┬───────┘
                                         ▼
                                ┌────────────────┐
                                │  Invite loop   │  ◀── viralité
                                │ (3 amis = 1    │
                                │  joker starter)│
                                └────────────────┘
```

---

## Changelog

- **2026-04-24 v1** — Proposition initiale avec modèle freemium 3 tiers (Free / Host / Pro), gating Stripe, pricing table.
- **2026-04-24 v2 — TRANCHÉ** — Pivot 100 % gratuit Phase 1 + Phase 2 post-CdM. Suppression du gating, réallocation ~5 jours vers viral loop, moment émotionnel et analytics.

---

_Tiens ce fichier à jour quand les décisions tombent — il deviendra la spec du Sprint 9._
