# ADR-0001 — Choix de stack : React + Supabase

- **Statut** : accepté
- **Date** : 2026-04-19
- **Contexte projet** : PronosticsContest v2 (réécriture de l'app .NET MVC 5)

## Contexte

L'application existante est une ASP.NET MVC 5 / EF6 / SQL Server déployée en monolithe. Points bloquants :

- Auth maison **SHA1** (inacceptable en 2026).
- Algorithme de classement de ~500 lignes en C# (`Concours._classement()`), difficile à tester et à faire évoluer.
- Scoring recalculé à chaque page → latence, pas de temps réel.
- Stack .NET 4.5.2 / MVC 5 en fin de vie, chaîne de déploiement lourde (IIS).
- UI Razor non responsive, pas de PWA possible.
- Secrets en clair dans `Web.config`.

Objectifs de la réécriture : modernisation auth, temps réel, mobile-first, possibilité d'agents Claude opérationnels (import matchs, scoring live, notifications).

## Décision

Stack adoptée :

- **Frontend** : React 18 + TypeScript strict, bundler Vite.
- **UI** : Tailwind CSS + shadcn/ui (copy-paste, pas de lib UI additionnelle) + lucide-react + framer-motion.
- **State** : Zustand (global léger) + TanStack Query (server state et cache).
- **Forms** : React Hook Form + Zod.
- **Backend** : Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).
- **Routing** : React Router v6.
- **i18n** : react-i18next (FR par défaut, EN en complément).
- **Tests** : Vitest + RTL (unit/integration), Playwright (E2E, Sprint 7).
- **Déploiement** : Vercel (front) + Supabase managé (back) + GitHub Actions (CI).

## Alternatives écartées

| Alternative | Pourquoi non |
| --- | --- |
| **Next.js** (App Router) | Overkill : pas besoin de SSR pour cette app ni de React Server Components. Vite est plus rapide à démarrer, plus simple à tester, et suffit pour une SPA authentifiée. Reconsidérable si on ajoute plus tard des pages SEO publiques. |
| **.NET 8 Blazor / ASP.NET Core** | Garde un monolithe lourd à déployer, n'apporte rien pour le temps réel (il faudrait quand même SignalR) et l'écosystème UI moderne (shadcn, Tailwind) est principalement React-centrique. |
| **Firebase** (vs Supabase) | Pas de SQL : or la logique de classement *doit* rester en SQL (500 lignes de C# → PL/pgSQL testable avec pgTAP). Supabase = Postgres + Auth + Storage + Realtime + Edge Functions, exactement ce qu'il faut. |
| **Remix** | Bon produit mais moins d'écosystème shadcn/ui natif côté data-fetching client, et Vite + React Router v6 couvre les besoins. |
| **Auth maison + Postgres managé** | Réinventer Supabase Auth (bcrypt, magic link, OAuth) = dette inutile. Supabase Auth intègre déjà RLS Postgres sur `auth.uid()`. |

## Conséquences

**Positives**
- **Auth secure out-of-the-box** (bcrypt + OAuth + magic link, plus de SHA1).
- **Temps réel natif** via Supabase Realtime sur une vue matérialisée → pas de polling.
- **RLS Postgres** comme ceinture de sécurité, policies déclaratives et testables.
- **Edge Functions** pour héberger les agents Claude (skills `sync-match-scores`, `award-badges`, etc.).
- **Types TS générés** depuis le schéma DB (`supabase gen types`), plus de drift front/back.
- **Déploiement en minutes** (Vercel preview sur chaque PR).

**Négatives / à surveiller**
- Dépendance à Supabase (vendor lock-in sur Auth et Realtime ; Postgres reste portable).
- Coût Supabase au-delà du tier gratuit (à monitorer quand on dépasse 500 MAU).
- Pas de SSR → SEO public limité. Acceptable car l'app est principalement authentifiée ; une landing Next.js/Astro séparée pourra être ajoutée.
- Courbe d'apprentissage RLS si l'équipe n'a jamais écrit de policies Postgres.

## Références

- Spec complète : `docs/PROMPT_REGENERATION_REACT_SUPABASE.md`
- Plan d'agents : `docs/AGENTS_ET_SKILLS_CLAUDE.md`
- Supabase docs : https://supabase.com/docs
- shadcn/ui : https://ui.shadcn.com
