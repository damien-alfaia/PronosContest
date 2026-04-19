# 🤖 PronosticsContest v2 — Agents & Skills Claude

> Proposition d'agents et de skills pour que **Claude gère l'application de bout en bout** : contenu, opérations, support, développement, analyse. Objectif : toi tu définis les règles du jeu, Claude fait tourner la plateforme.

---

## 🎯 Philosophie

Deux briques complémentaires :

- **Skills** = capacités spécialisées déclenchées à la demande (par toi, par un utilisateur, par un webhook ou un cron). Un skill = un `SKILL.md` + éventuellement des scripts. Il suit une recette précise et reproductible.
- **Agents** = boucles autonomes de plus haut niveau, capables d'enchaîner plusieurs skills et outils pour atteindre un objectif. Un agent tourne sur un déclencheur (cron, webhook, commande), se donne un plan, exécute et rapporte.

Toute l'orchestration passe par **Claude Agent SDK** (ou Claude Code en local), avec :
- **MCP Supabase** pour lire/écrire la base (service role key côté serveur)
- **MCP GitHub** pour PRs/issues
- **WebFetch / WebSearch** pour la donnée sportive externe
- **Edge Functions Supabase** pour héberger les agents planifiés

---

## 🧩 Skills proposés (18)

### 1. `import-competition`
**Trigger** : "importer la Coupe du Monde 2026", "créer la compétition Euro 2024"
**Fait** : appelle une API sportive (API-Football, Football-Data.org), crée la compétition, ses phases, ses équipes (avec logos), ses matchs, ses phases finales. Génère un rapport de ce qui a été importé.
**Outils** : WebFetch, Supabase MCP.

### 2. `sync-match-scores`
**Trigger** : cron toutes les 5 min pendant un match, ou manuel "mets à jour les scores du match X"
**Fait** : récupère les scores live, met à jour `matchs.buts_a/b`, déclenche le recalcul du classement. Log les changements.
**Outils** : WebFetch, Supabase MCP.

### 3. `compute-classement`
**Trigger** : webhook Postgres (`after update on matchs`)
**Fait** : appelle `compute_classement(concours_id)` pour tous les concours affectés, met à jour les états des pronos, attribue badges, prépare les notifications.
**Outils** : Supabase MCP.

### 4. `award-badges`
**Trigger** : après chaque calcul de classement
**Fait** : scanne les profils, applique les règles de badges (5 scores exacts d'affilée, % > 80 sur une poule, outsider gagnant contre une cote > 5…), insère dans `user_badges`, crée notifications.
**Outils** : Supabase MCP.

### 5. `send-match-reminders`
**Trigger** : cron horaire
**Fait** : trouve tous les utilisateurs avec pronos manquants pour un match dans les 24 h, envoie email/push, crée notification in-app.
**Outils** : Supabase MCP, Resend/Postmark MCP.

### 6. `weekly-recap`
**Trigger** : cron chaque lundi matin
**Fait** : pour chaque utilisateur actif, génère un récap perso de la semaine (matchs joués, points gagnés, évolution du classement, meilleur prono, badge gagné) et envoie par email avec une image de carte partageable.
**Outils** : Supabase MCP, image generation, email MCP.

### 7. `moderate-comments`
**Trigger** : webhook after insert on `comments`
**Fait** : classe le message (insulte, spam, hors-sujet, OK), masque/supprime si besoin, notifie l'auteur et éventuellement l'admin.
**Outils** : Supabase MCP + classifieur (Claude lui-même).

### 8. `suggest-coefficients`
**Trigger** : l'utilisateur crée un nouveau concours
**Fait** : propose 3 presets de barème ("Classique", "Tout ou rien", "Cotes max") et explique l'effet attendu sur la volatilité du classement à partir de simulations.
**Outils** : Supabase MCP (lecture historique), calcul local.

### 9. `explain-scoring`
**Trigger** : "explique-moi pourquoi j'ai X points sur ce match"
**Fait** : reconstruit le calcul ligne à ligne (coef × cote, bonus score exact, etc.) et l'affiche en langage naturel.
**Outils** : Supabase MCP.

### 10. `generate-share-card`
**Trigger** : "partage mon classement", fin de concours
**Fait** : génère une image (OG image ou PNG 1080×1080) avec le classement, les stats clés, un QR code d'invitation. Upload dans Supabase Storage, renvoie l'URL.
**Outils** : Supabase Storage, `@vercel/og` ou `satori`.

### 11. `import-pronos-from-screenshot`
**Trigger** : utilisateur envoie une capture de ses pronos d'un autre site
**Fait** : OCR/vision, extrait les matchs + scores, propose une saisie groupée avec validation manuelle.
**Outils** : vision Claude, Supabase MCP.

### 12. `autofill-missing-pronos`
**Trigger** : 1 h avant la clôture d'un match si l'utilisateur a activé l'option
**Fait** : remplit les pronos manquants avec le favori selon la cote (ou les stats), notifie l'utilisateur pour qu'il puisse encore modifier.
**Outils** : Supabase MCP.

### 13. `stats-insights`
**Trigger** : onglet "Mes stats" ou demande en langage naturel
**Fait** : analyse l'historique de l'utilisateur et génère 3 insights actionnables ("tu sous-estimes les équipes outsider", "tu pronostiques mieux le samedi que le mercredi", "tu as un taux de 85 % en phase de poules").
**Outils** : Supabase MCP.

### 14. `onboarding-guide`
**Trigger** : première connexion
**Fait** : tour guidé interactif, pose des questions (sport préféré, style de joueur), propose de rejoindre un concours public ou d'en créer un.
**Outils** : in-app dialog + Supabase MCP.

### 15. `community-digest`
**Trigger** : cron hebdo dans chaque concours > 10 membres
**Fait** : post automatique dans le chat/feed : meilleurs pronos de la semaine, plus gros comeback, meilleur outsider, qui progresse le plus.
**Outils** : Supabase MCP.

### 16. `customer-support`
**Trigger** : chat de support / email entrant
**Fait** : répond aux questions courantes (règles de scoring, rejoindre un concours, reset mdp, bug report). Escalade à l'admin si incertain.
**Outils** : Supabase MCP (lecture compte user), email MCP.

### 17. `gdpr-export-delete`
**Trigger** : "exporte mes données", "supprime mon compte"
**Fait** : export JSON/CSV complet ou anonymisation + suppression conforme RGPD, log l'opération.
**Outils** : Supabase MCP, Storage.

### 18. `health-check`
**Trigger** : cron 5 min
**Fait** : pingue l'app, vérifie latence Postgres, taille des queues, freshness des matchs live. Alerte Slack/email en cas d'anomalie.
**Outils** : WebFetch, Supabase MCP, Slack MCP.

---

## 👥 Agents proposés (7)

### 🧑‍💼 A1. `Ops Agent` — opérations quotidiennes
**Rôle** : keeper de l'app. Tourne en continu.
**Déclenchement** : cron + webhooks
**Orchestration** :
- `sync-match-scores` (live match)
- `compute-classement` (post-score)
- `award-badges`
- `send-match-reminders` (J-1 / H-1)
- `health-check` (continu)
**Livre** : journal quotidien dans Slack/email ("47 scores mis à jour, 3 concours recalculés, 128 notifs envoyées, 0 incident").

### 🏟️ A2. `Competition Manager` — catalogue de compétitions
**Rôle** : garder le catalogue à jour (nouvelles saisons, nouveaux tournois).
**Déclenchement** : cron hebdo + sur demande admin
**Orchestration** :
- Surveille les annonces de compétitions (UEFA, FIFA, World Rugby…)
- `import-competition` quand une nouvelle est détectée
- Corrige les métadonnées (logos, drapeaux) manquantes
- Ajoute à la page d'accueil "Nouveaux concours disponibles"
**Livre** : PR GitHub ou entrée dans la table `competitions`.

### 🎙️ A3. `Commentator Agent` — community management
**Rôle** : animer les concours.
**Déclenchement** : cron (avant/après chaque match) + événements forts (changement de tête de classement)
**Orchestration** :
- Rédige des messages d'avant-match ("Le choc du jour : FRA-ALL, 72 % d'entre vous pronostiquent une victoire française…")
- Publie un post après-match avec les réactions des pronos
- Déclenche `community-digest` chaque semaine
- `moderate-comments` en continu
**Livre** : posts dans les feeds/chats des concours.

### 🧠 A4. `Coach Agent` — assistant utilisateur personnel
**Rôle** : accompagner chaque utilisateur comme un coach.
**Déclenchement** : ouverture de l'app, notification de match, nouvelle semaine
**Orchestration** :
- `stats-insights` toutes les semaines
- `autofill-missing-pronos` avec confirmation utilisateur
- Suggère de rejoindre un concours adapté à son niveau
- `explain-scoring` sur demande
**Livre** : messages dans `notifications` + widgets dans le dashboard.

### 🛠️ A5. `Dev Agent` — maintenance du code
**Rôle** : prendre en charge la dette et les petites évolutions.
**Déclenchement** : issues GitHub, rapports de bugs, PR reviews
**Orchestration** :
- Lit l'issue, analyse le code, propose une PR avec tests
- `code-review` automatique sur chaque PR
- Met à jour les dépendances (Renovate-style) + vérifie les tests
- Rédige les release notes
- Ouvre une ADR (skill `engineering:architecture`) pour chaque choix de stack
**Livre** : PRs GitHub, commentaires de review.

### 📊 A6. `Analytics Agent` — business intelligence
**Rôle** : te fournir les bons chiffres sans effort.
**Déclenchement** : cron quotidien + sur demande
**Orchestration** :
- Calcule DAU/WAU/MAU, rétention J7/J30, concours actifs, pronos saisis
- Détecte anomalies (chute d'engagement, pic d'erreurs)
- Génère un rapport Markdown ou un dashboard Supabase
- Propose des expériences produit (A/B) à lancer
**Livre** : rapport hebdo, alertes, backlog d'idées.

### 🛡️ A7. `Compliance & Safety Agent`
**Rôle** : respect RGPD, modération, sécurité.
**Déclenchement** : événements utilisateur + audits planifiés
**Orchestration** :
- `gdpr-export-delete` sur requête
- Audits RLS périodiques (tente des requêtes anonymes → alerte si accès indu)
- Revue des comptes suspects (inscriptions de masse, usage anormal)
- Rotation des secrets et clés API
**Livre** : rapport de conformité mensuel, alertes sécurité.

---

## 🏗️ Orchestration & déploiement

### Où font-ils tourner ?

| Composant | Hébergement recommandé |
|---|---|
| Agents cron (`Ops`, `Analytics`, `Competition Manager`) | **Supabase Edge Functions** + `pg_cron` |
| Skills à la demande | **Edge Functions** ou serveur Node (Fly.io, Railway) |
| Agent SDK pour les workflows longs | **Anthropic Claude Agent SDK** sur un worker Fly.io / Render |
| Dev Agent | **GitHub Actions** + Claude Code |

### Stack minimale

```
[ React app ]
    │
    ├──▶ Supabase Postgres + Auth + Storage + Realtime
    │         ▲
    │         │ (MCP Supabase)
    │         │
    ├──▶ Edge Functions  ──┐
    │                      │
    └──▶ Worker Fly.io ────┴──▶  Claude Agent SDK
                                      │
                                      ├── MCP Supabase
                                      ├── MCP GitHub
                                      ├── MCP Email (Resend)
                                      ├── MCP Slack
                                      └── WebFetch / WebSearch
```

### Sécurité

- **Service role key Supabase** uniquement côté serveur, jamais exposée au front.
- **Tool allow-list** par agent : le `Coach Agent` ne doit pas pouvoir écrire dans `concours.coef_*`, seul `Competition Manager` et l'admin humain peuvent.
- **Dry-run mode** : chaque agent tourne d'abord en `--dry-run` et log ce qu'il ferait, validation humaine avant passage en prod.
- **Budget / rate limits** : quota de tokens par agent et par jour, kill switch en cas de dérive.
- **Audit trail** : chaque action d'agent écrit dans une table `agent_actions` (qui, quand, quoi, diff).

---

## 📦 Livrable recommandé

Un dossier `/agents` dans le repo :

```
agents/
  shared/
    mcp-config.json       # serveurs MCP (supabase, github, email)
    tools.ts              # outils TS typés
    prompts/              # prompts système par agent
    audit.ts              # écriture dans agent_actions
  skills/
    import-competition/
      SKILL.md
      script.ts
    sync-match-scores/
      SKILL.md
      script.ts
    compute-classement/
    ...
  ops-agent/
    index.ts              # boucle principale
    schedule.json         # cron
  coach-agent/
  dev-agent/
  commentator-agent/
  analytics-agent/
  competition-manager/
  compliance-agent/
  README.md               # comment lancer, quelles env vars
```

Chaque skill a un `SKILL.md` avec :
```
name: import-competition
trigger: ...
inputs: { competitionName, season, sport }
tools: [WebFetch, supabase.insert, supabase.query]
steps:
  1. ...
  2. ...
outputs: { competitionId, importedTeams, importedMatches }
```

---

## 🚀 Par où commencer

1. **MVP des agents** : `Ops Agent` + skills `sync-match-scores`, `compute-classement`, `send-match-reminders`. Sans ça, pas de valeur temps réel.
2. **Agent contenu** : `Commentator Agent` dès que tu as 2–3 concours actifs, c'est ce qui retient les utilisateurs.
3. **Dev Agent** : active-le très tôt, il te gagne du temps sur les micro-tâches.
4. **Coach Agent + skills stats** : booste la rétention au-delà du premier concours.
5. **Analytics + Compliance** : dès que tu passes le cap des 100 utilisateurs.

Ordre de grandeur : avec 2 agents prioritaires (Ops + Dev) et 6 skills (import, sync, classement, reminders, badges, stats-insights), tu as déjà une app **qui tourne seule 90 % du temps**.

---

*Document compagnon de `PROMPT_REGENERATION_REACT_SUPABASE.md`.*
