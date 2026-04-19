# ADR-0002 — Gestion d'état : Zustand (client) + TanStack Query (server)

- **Statut** : accepté
- **Date** : 2026-04-19
- **Contexte projet** : PronosticsContest v2 — Sprint 1 (auth + layout + profil)

## Contexte

Avec l'arrivée de l'auth, du profil utilisateur et du layout applicatif (Sidebar / Topbar / BottomNav), trois familles d'état apparaissent :

1. **État "serveur"** : profil utilisateur, liste de concours, classement temps réel, pronostics. Source de vérité = Supabase. Caractéristiques : asynchrone, cacheable, revalidation.
2. **État "client global"** : thème (light/dark/system), session auth (reflet de `supabase.auth`), préférences UI (sidebar ouverte, etc.). Partagé entre des composants non voisins, peut nécessiter persistance locale.
3. **État "local"** : valeurs de formulaire, ouvert/fermé d'un modal, hover. Doit rester dans les composants.

Redux Toolkit et Recoil ont été écartés en Sprint 0 (verbosité et overhead). La question ouverte restait : **une seule** lib d'état ou la séparation client / server ?

## Décision

Séparation stricte en deux briques :

- **Server state → TanStack Query (React Query)**, toujours. Profil, concours, classement, pronostics : tout passe par `useQuery` / `useMutation`. Clés de query typées (par exemple `['profile', userId]`). Optimistic updates quand le risque d'échec est faible. Cache partagé entre composants via le `QueryClient` racine.
- **Client global → Zustand**, uniquement quand plusieurs composants doivent partager un état UI/session. Persistance via `persist` seulement si pertinent (thème oui, session non — Supabase s'en occupe). Stores nommés : `theme-store`, `auth-store`. Aucun store n'héberge de données serveur.
- **Local → `useState` / `useReducer`** en priorité. On ne promeut un état vers Zustand que s'il y a besoin réel de partage.

Règle d'or non négociable : **jamais de données récupérées d'une API dans un store Zustand**. Si deux composants doivent consommer la même ligne de BDD, ils font tous les deux `useQuery` avec la même clé.

## Alternatives écartées

| Alternative | Pourquoi non |
| --- | --- |
| **Tout en Zustand** (y compris les fetchs) | Il faudrait réimplémenter à la main cache invalidation, retries, refetch on window focus, loading/error states, dedup concurrent requests, optimistic updates. C'est exactement ce que TanStack Query offre gratis. |
| **Tout en Redux Toolkit + RTK Query** | RTK Query fait le job serveur mais RTK est plus verbeux (slices, reducers, actions) pour un état client très léger. Zustand tient en 3 lignes pour un store avec persist. |
| **Jotai / Recoil** | Modèle atomique intéressant mais adoption plus faible et moins mature que Zustand en 2026. On choisit la solution "ennuyeuse" qui marche. |
| **Context API React** | OK pour des valeurs stables (ex. router), catastrophique pour un état qui change souvent (re-render de tous les consumers). Et pas de devtools. |
| **SWR** (vs TanStack Query) | Très proche, un peu plus léger, mais TanStack Query a de meilleurs outils d'optimistic update (avec rollback), mutations typées, et le devtool intégré à notre stack de test. |

## Conséquences

**Positives**
- Frontière claire pour les PRs : "cette donnée vient du back → `useQuery`", sinon "état UI → `useState`/Zustand".
- Server state gratuit : dedup, cache, refetch, retries, loading/error traités par la lib.
- Zustand reste minimal : si un jour un store grossit trop, c'est un code smell.
- Testabilité : les stores Zustand peuvent se reset (`useAuthStore.setState(...)` dans `beforeEach`), les queries se mockent via un `QueryClientProvider` de test.

**Négatives / à surveiller**
- Deux APIs mentales à maîtriser pour l'équipe (mais chacune est simple).
- Risque d'oubli : un dev fatigué pourrait stocker une réponse API dans Zustand. À détecter en code review.
- `persist` de Zustand sur `localStorage` est synchrone → ne pas y mettre de gros objets.

## Conventions d'usage

- **Query keys** : tableaux hiérarchisés, toujours typés. Exemple : `['profile', userId] as const`, `['concours', concoursId, 'classement']`. Un helper `profileQueryKey(userId)` par feature limite les erreurs de frappe.
- **Mutations** : `onMutate` pour optimistic, `onError` pour rollback (`ctx.previous`), `onSettled` pour invalider. Jamais de `setQueryData` sans snapshot préalable.
- **Provider** : un seul `QueryClient` racine (voir `app/providers/query-provider.tsx`), options par défaut `staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 1`.
- **Zustand** : `create<T>()(persist(..., { name: 'pronos-<clé>', version: N }))`. Bumper `version` et écrire un `migrate` si le shape change.
- **Tests** : pour `useAuth` / guards, on `setState` directement sur le store pour simuler les scénarios ; pour les queries, on mock `@/lib/supabase`.

## Références

- ADR-0001 — Choix de stack : `docs/adr/0001-stack-react-supabase.md`
- TanStack Query docs : https://tanstack.com/query
- Zustand docs : https://zustand.docs.pmnd.rs
- Exemple d'application : `src/features/profile/use-profile.ts` (query + mutation optimiste)
