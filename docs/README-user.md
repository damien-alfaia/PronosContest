# README — Guide utilisateur PronosticsContest

> Ce document explique comment utiliser **PronosticsContest** en tant que
> joueur. Il couvre l'inscription, la création et rejoindre un concours,
> la saisie des pronostics, le suivi du classement, les fonctions sociales
> (chat, badges, notifs) et le mode hors ligne.

---

## Sommaire

1. [Créer un compte](#1-créer-un-compte)
2. [Les concours](#2-les-concours)
3. [Saisir tes pronostics](#3-saisir-tes-pronostics)
4. [Classement en temps réel](#4-classement-en-temps-réel)
5. [Chat d'un concours](#5-chat-dun-concours)
6. [Badges & gamification](#6-badges--gamification)
7. [Notifications](#7-notifications)
8. [Mode hors ligne & installation](#8-mode-hors-ligne--installation)
9. [Ton profil](#9-ton-profil)
10. [FAQ](#10-faq)

---

## 1. Créer un compte

1. Va sur la page d'accueil → clic **"S'inscrire"** (ou `/auth/signup`).
2. Saisis un email + un mot de passe (8 caractères min., 1 majuscule,
   1 chiffre, 1 caractère spécial).
3. Tu reçois un email de confirmation — clique le lien pour activer ton
   compte.
4. Tu peux aussi te connecter par **lien magique** (mot de passe oublié →
   magic link dans la boîte mail).

> Ton profil (prénom, nom, avatar) se remplit depuis la page
> **Profil** → [`/app/profile`](#9-ton-profil) après la 1re connexion.

---

## 2. Les concours

Un **concours** regroupe plusieurs joueurs autour d'une même compétition
sportive (ex. FIFA World Cup 2026). Chacun y saisit ses pronos, le scoring
tourne automatiquement et un classement se met à jour en temps réel.

### 2.1 Rejoindre un concours existant

Deux chemins :

- **Public** — sur `/app/concours`, section "Découvrir les concours" :
  clic sur un concours ouvert → "Rejoindre".
- **Par code d'invitation** — un admin de concours t'a partagé un code
  à 8 caractères (ex. `ABCD1234`). Sur `/app/concours`, bouton
  **"Rejoindre par code"** → colle le code.

### 2.2 Créer ton propre concours

Sur `/app/concours`, bouton **"Nouveau concours"** (`/app/concours/nouveau`).

| Champ         | Règle                                                             |
| ------------- | ----------------------------------------------------------------- |
| Nom           | 2 à 80 caractères                                                 |
| Description   | Optionnelle, 500 max                                              |
| Compétition   | À choisir dans la liste (ex. FIFA WC 2026)                        |
| Visibilité    | `private` (sur invitation) / `public` (visible dans "Découvrir") / `link` (accessible uniquement via le code d'invitation) |
| Date de début | Défaut : aujourd'hui                                              |

Un **code d'invitation** est généré automatiquement : tu peux le copier
(icône 📋) et le partager à tes amis. Tu es automatiquement ajouté comme
**admin du concours** (à ne pas confondre avec l'admin applicatif global —
voir [README-admin](./README-admin.md)).

### 2.3 La fiche concours

Sur `/app/concours/:id`, tu retrouves :

- nom + description + compétition,
- **code d'invitation** (visible pour les membres),
- les **CTAs** selon ton rôle :
  - membre → "Saisir mes pronostics", "Voir le classement", "Ouvrir le chat",
  - non-membre d'un concours public → "Rejoindre",
  - admin du concours → "Modifier" / "Fermer".

---

## 3. Saisir tes pronostics

Rends-toi sur `/app/concours/:id/pronos` via le CTA **"Saisir mes
pronostics"** depuis la fiche concours.

### 3.1 L'interface

- Les matchs sont groupés par **phase** (groupes → 8es → 4ts → 1/2 →
  petite finale → finale), puis par **journée** dans chaque phase.
- Chaque carte match affiche :
  - les deux équipes + drapeaux + groupe,
  - la **date + heure + stade**,
  - un **compte à rebours** jusqu'au coup d'envoi,
  - les **cotes** bookmaker (si disponibles) — indicatif, ton scoring
    sera pondéré par la cote du résultat que tu as choisi.

### 3.2 Saisie d'un prono

1. Clique sur la carte du match.
2. Saisis les scores (0..99 chacun).
3. **Phase KO uniquement** : si tu tapes une égalité, un sélecteur
   "Vainqueur aux tirs au but" apparaît — coche l'équipe A ou B.
4. **Auto-save** : ton prono se sauvegarde tout seul après 600 ms
   d'inactivité. Une petite coche verte ✓ confirme la sauvegarde.
5. **Verrouillage** : dès le coup d'envoi, le prono est figé. Plus
   aucune modification possible, même toi ne peux plus le voir avant
   kick-off chez les autres (RLS côté Supabase).

### 3.3 Filtres

- **Tous** / **À pronostiquer** / **Verrouillés**
- **Par groupe** (A → L pour FIFA WC 2026)

> Astuce : le filtre "Verrouillés" se rafraîchit toutes les minutes
> pour que tu vois correctement les matchs qui basculent en cours
> de session.

---

## 4. Classement en temps réel

Sur `/app/concours/:id/classement`, accessible via **"Voir le classement"**.

### 4.1 Lecture du classement

| Colonne      | Signification                                  |
| ------------ | ---------------------------------------------- |
| Rang         | Dense rank (les égalités partagent le rang)    |
| Joueur       | Avatar + prénom + nom                          |
| Points       | Total pondéré par les cotes                    |
| Exacts       | Nombre de scores exacts                        |
| Gagnés       | Nombre de bons résultats (hors score exact)    |
| Joués        | Nombre de matchs terminés dont tu avais un prono (colonne masquée sur mobile) |

Les **3 premiers** ont un badge teinté (🥇 or / 🥈 argent / 🥉 bronze).
Ta propre ligne est surlignée et taguée **"Toi"**.

### 4.2 Comment les points sont calculés

- **Base** :
  - bon résultat mais pas le score exact → **1 point**
  - score exact → **3 points**
- **Bonus KO** : en phase à élimination directe, +1 point additif si
  tu as deviné l'équipe qualifiée (avant TAB).
- **Cote** : le total `(base + bonus)` est ensuite multiplié par la
  cote du résultat que tu as choisi (arrondi au plus proche). Plus
  le résultat était improbable, plus ça rapporte.

Le recalcul est instantané : dès qu'un admin saisit le score d'un
match, les points sont recomputés côté base + diffusés en Realtime à
tous les joueurs du concours. Pas besoin de rafraîchir.

---

## 5. Chat d'un concours

Sur `/app/concours/:id/chat`, accessible via **"Ouvrir le chat"**.

### 5.1 Fonctionnalités

- Messages visibles uniquement par les membres du concours.
- Envoi par **Ctrl+Enter** ou **Cmd+Enter** (Enter seul = saut de ligne).
- **Mentions** : tape `@Prénom` (ou `@Prénom Nom` si plusieurs
  personnes partagent le même prénom) pour notifier quelqu'un. La
  personne mentionnée reçoit une notif in-app (🛎️).
- **Charger plus ancien** : bouton en haut pour remonter dans
  l'historique (pagination par 50).
- **Aujourd'hui / Hier** : séparateurs de date automatiques.

### 5.2 Limites

- Chaque message : 1 à 1000 caractères.
- **Pas d'édition ni de suppression** au MVP (les messages sont
  immuables, voilà voilà 😅). Une prochaine itération pourra permettre
  à l'auteur de supprimer son propre message — pas à l'admin.
- Pas de pièces jointes pour le moment.

---

## 6. Badges & gamification

Sur `/app/profile`, section **"Mes badges"**.

### 6.1 Comment en gagner ?

28 badges sont disponibles au MVP, organisés en 10 catégories
(cycle de vie, volume, compétence, régularité, complétude, classement,
social, fun, temporel, légendaire). Exemples :

- 🟢 **Rookie** — 1er pronostic saisi
- 🎯 **Pronostic parfait** — 1 score exact
- 🏆 **Premier de la classe** — #1 au classement d'un concours
- 👑 **Champion du monde** — gagner un concours sur la FIFA WC
- 🌅 **Early bird** — prono saisi plus de 24 h avant kick-off
- 🌙 **Night owl** — prono saisi entre 0 h et 6 h
- 👥 **Host** — créer 3 concours ou plus

Les badges **non gagnés** apparaissent en grisé avec leur description —
c'est un **objectif** à atteindre. Les badges gagnés sont triés par
rareté (légendaire en premier).

### 6.2 Les tiers

| Tier        | Couleur | Exemples                                  |
| ----------- | ------- | ----------------------------------------- |
| Bronze      | Ambre   | Rookie, Early bird                        |
| Silver      | Gris    | Expert (50 pronos), Podium                |
| Gold        | Or      | Premier de la classe, Pronostic parfait   |
| Legendary   | Violet  | Champion du monde, Flame                  |

L'attribution est **automatique** (triggers SQL côté Supabase). Pas
d'action manuelle à faire.

---

## 7. Notifications

Clic sur la **cloche 🛎️** dans la Topbar (en haut à droite).

### 7.1 Les 4 types

| Type                   | Quand ?                                                     | Clic → va vers                        |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------- |
| 🏆 Résultat de match  | Un match terminé pour lequel tu avais un prono             | Liste des concours                    |
| 🏅 Badge gagné         | Nouveau badge débloqué                                      | Ton profil                            |
| 👥 Nouveau membre     | Quelqu'un rejoint un concours dont tu es admin              | La fiche du concours                  |
| @ Mention dans le chat | Quelqu'un t'a cité dans le chat d'un concours              | Le chat concerné                      |

### 7.2 Lecture

- Le compteur rouge indique les non-lues (jusqu'à **99+**).
- Clic sur une notif → marquée lue + redirection.
- **"Tout marquer comme lu"** en haut du panneau.
- Les notifs restent en historique même lues (20 par page, "Charger plus").

---

## 8. Mode hors ligne & installation

### 8.1 Installer l'app (PWA)

Une bannière **"Installer PronosticsContest"** apparaît quand ton
navigateur détecte que l'app est installable. Clique **"Installer"**
pour ajouter l'icône à ton écran d'accueil (mobile) ou à tes apps
(desktop).

- Sur iOS Safari : pas de popup auto → menu partage → **"Sur l'écran
  d'accueil"**.
- Si tu dismiss, la bannière ne repassera pas avant 30 jours.
- Après installation, l'app s'ouvre en **mode standalone** (sans URL
  bar).

### 8.2 Hors ligne

- Les pages déjà visitées restent accessibles offline (précache
  service worker).
- Une **bannière jaune** "Vous êtes hors ligne" apparaît en haut dès
  que tu perds la connexion.
- **Ce qui marche offline** : consulter tes concours déjà chargés,
  relire le classement (dernière version cachée), relire les pronos
  déjà saisis.
- **Ce qui ne marche pas offline** : saisir un nouveau prono,
  rejoindre un concours, envoyer un message chat, recevoir des notifs
  temps réel. Les écritures sont bloquées tant que le réseau n'est
  pas revenu.

### 8.3 Mise à jour de l'app

Quand une nouvelle version est déployée, un toast
**"Nouvelle version disponible"** apparaît. Clique **"Recharger"** pour
l'appliquer. Si tu es en plein formulaire, clique **"Plus tard"** — la
màj sera repoposée au prochain boot.

> On ne force **jamais** un reload en plein workflow pour ne pas te
> faire perdre ta saisie.

---

## 9. Ton profil

Sur `/app/profile`.

### 9.1 Informations modifiables

- **Prénom** / **Nom** (2..80 caractères)
- **Avatar** (URL publique, 2 Mo max recommandé)
- **Langue** — FR (par défaut) / EN
- **Thème** — Clair / Sombre / Système (bascule dans la Topbar)

### 9.2 Changer de mot de passe

Via **"Mot de passe oublié"** sur la page de login → email avec un
lien `/auth/reset-password`. C'est volontaire : pas de changement de
mot de passe "inline" pour éviter qu'un appareil compromis te le
change sans friction.

---

## 10. FAQ

### Je ne vois pas un concours public dans "Découvrir"
- Vérifie que la compétition n'est pas passée en `finished` (les
  concours finis sont masqués par défaut).
- La recherche est **par nom** — le texte que tu tapes doit matcher.

### Je veux sortir d'un concours
- Fiche concours → menu actions → **"Quitter le concours"**. Tes
  pronostics passés sont conservés en base, mais tu n'apparaîtras
  plus dans le classement live.

### Mon prono n'a pas été sauvegardé
- Regarde si la coche verte est apparue après 600 ms.
- Si tu vois un badge rouge "Erreur" → ta connexion a probablement
  coupé. Corrige et réessaie, l'auto-save retentera au prochain
  changement de champ.

### Puis-je voir les pronos des autres avant le match ?
- Non, jamais. Les pronos sont **cachés pour tous** jusqu'au coup
  d'envoi du match (RLS stricte côté Supabase). Au kick-off la
  visibilité s'ouvre à tous les membres du concours.

### Pourquoi mon classement ne bouge pas alors qu'un match est fini ?
- Les points sont calculés côté base dès que l'admin saisit le score.
  Si rien ne bouge, c'est que **le score n'a pas encore été validé**
  côté admin. Patience — ou pique ton pote admin dans le chat 😄.

### Qui est admin de l'application ?
- L'admin applicatif global (pas à confondre avec l'admin d'un
  concours) gère le référentiel des compétitions et des équipes, et
  saisit les résultats des matchs. Voir [README-admin](./README-admin.md).

---

*Dernière mise à jour : Sprint 7 — 2026-04-21.*
