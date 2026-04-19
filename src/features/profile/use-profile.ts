import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchCurrentProfile,
  type Profile,
  type ProfileUpdate,
  updateCurrentProfile,
} from '@/features/profile/api';

type PatchablePart = Omit<ProfileUpdate, 'id' | 'email' | 'role'>;

export const profileQueryKey = (userId: string | undefined) =>
  ['profile', userId ?? 'anon'] as const;

/**
 * Query : profil courant.
 * Désactivée tant que `userId` n'est pas connu.
 */
export const useProfileQuery = (userId: string | undefined) =>
  useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchCurrentProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

/**
 * Mutation : update du profil avec optimistic update.
 *
 * onMutate prend un snapshot, applique le patch localement,
 * et rollback en cas d'échec.
 */
export const useUpdateProfileMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const key = profileQueryKey(userId);

  return useMutation({
    mutationFn: async (patch: PatchablePart) => {
      if (!userId) throw new Error('No user id');
      return updateCurrentProfile(userId, patch);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile | null>(key);
      if (previous) {
        queryClient.setQueryData<Profile | null>(key, {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(key, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
};
