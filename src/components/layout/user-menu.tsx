import { LogOut, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { NAV_ITEMS } from '@/components/layout/nav-items';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsAdmin } from '@/features/admin/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';

const pickInitials = (first?: string | null, last?: string | null, email?: string | null) => {
  const f = (first ?? '').trim()[0];
  const l = (last ?? '').trim()[0];
  if (f || l) return `${f ?? ''}${l ?? ''}`.toUpperCase();
  const fromEmail = (email ?? '').trim()[0];
  return (fromEmail ?? '?').toUpperCase();
};

/**
 * Avatar + menu utilisateur.
 *
 * Contient :
 *   - Profil + déconnexion (toujours).
 *   - Section "Admin" (conditionnelle sur `useIsAdmin`) avec les
 *     liens vers les 3 pages back-office. Depuis qu'on a retiré la
 *     Sidebar, c'est le seul point d'entrée admin — discret, invisible
 *     pour les non-concernés.
 *
 * Les initiales sont calculées à partir des metadata du user Supabase
 * (`prenom`/`nom`) ou, en dernier recours, de la première lettre de l'e-mail.
 */
export const UserMenu = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  if (!user) return null;

  const prenom = (user.user_metadata?.prenom as string | undefined) ?? null;
  const nom = (user.user_metadata?.nom as string | undefined) ?? null;
  const initials = pickInitials(prenom, nom, user.email);

  const displayName =
    [prenom, nom].filter(Boolean).join(' ').trim() ||
    user.email?.split('@')[0] ||
    '';

  const adminItems = NAV_ITEMS.filter((i) => i.adminOnly);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t('nav.userMenu')}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {user.email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" aria-hidden />
            {t('nav.profile')}
          </Link>
        </DropdownMenuItem>

        {isAdmin && adminItems.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.adminSection')}
            </DropdownMenuLabel>
            {adminItems.map(({ labelKey, to, icon: Icon }) => (
              <DropdownMenuItem key={to} asChild>
                <Link to={to} className="cursor-pointer">
                  <Icon className="mr-2 h-4 w-4" aria-hidden />
                  {t(labelKey)}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
