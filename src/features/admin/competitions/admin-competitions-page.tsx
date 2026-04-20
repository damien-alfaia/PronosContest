import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Competition } from '@/features/admin/competitions/api';
import { CompetitionDialog } from '@/features/admin/competitions/components/competition-dialog';
import {
  type CompetitionStatus,
  type Sport,
} from '@/features/admin/competitions/schemas';
import {
  useAdminCompetitionsQuery,
  useDeleteCompetitionMutation,
} from '@/features/admin/competitions/use-admin-competitions';

/**
 * Page admin — référentiel des compétitions.
 *
 * Accès : protégé par `<RequireAdmin />` (cf. router).
 *
 * Fonctionnalités :
 *  - Liste de toutes les compétitions (tri date_debut desc puis nom).
 *  - Bouton "Nouvelle compétition" → dialog création.
 *  - Actions par ligne : éditer / supprimer.
 *  - Suppression confirmée par `window.confirm`.
 *  - Erreur 23503 FK RESTRICT (compétition référencée par des concours
 *    ou des matchs) mappée sur un toast dédié.
 */

const STATUS_VARIANT: Record<
  CompetitionStatus,
  'muted' | 'default' | 'outline'
> = {
  upcoming: 'muted',
  live: 'default',
  finished: 'outline',
};

const formatDate = (iso: string | null, locale: string): string => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  const loc = locale.split('-')[0] === 'en' ? 'en-GB' : 'fr-FR';
  return d.toLocaleDateString(loc, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const AdminCompetitionsPage = () => {
  const { t, i18n } = useTranslation();
  const query = useAdminCompetitionsQuery();
  const deleteMutation = useDeleteCompetitionMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (competition: Competition) => {
    setEditing(competition);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
  };

  const handleDelete = (competition: Competition) => {
    if (!window.confirm(t('admin.competitions.confirmDelete'))) return;

    deleteMutation.mutate(competition.id, {
      onSuccess: () => toast.success(t('admin.toast.competitionDeleted')),
      onError: (err) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('violates foreign key') || /23503/.test(msg)) {
          toast.error(t('admin.toast.competitionInUse'));
        } else {
          toast.error(t('admin.toast.competitionDeleteError'));
        }
      },
    });
  };

  if (query.isLoading) return <FullScreenSpinner />;

  const competitions = query.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      {/* ---------- En-tête ---------- */}
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('admin.competitions.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.competitions.subtitle')}
          </p>
        </div>

        <Button type="button" onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('admin.competitions.actions.create')}
        </Button>
      </header>

      {/* ---------- Table ---------- */}
      {competitions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {t('admin.competitions.empty.title')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.competitions.empty.description')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.competitions.columns.code')}</TableHead>
                <TableHead>{t('admin.competitions.columns.nom')}</TableHead>
                <TableHead>{t('admin.competitions.columns.sport')}</TableHead>
                <TableHead>{t('admin.competitions.columns.status')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('admin.competitions.columns.dateDebut')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('admin.competitions.columns.dateFin')}
                </TableHead>
                <TableHead className="text-right">
                  {t('admin.competitions.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitions.map((c) => {
                const status = c.status as CompetitionStatus;
                const sport = c.sport as Sport;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {c.code}
                    </TableCell>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t(`admin.competitions.sport.${sport}`)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]}>
                        {t(`admin.competitions.competitionStatus.${status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap font-mono text-xs md:table-cell">
                      {formatDate(c.date_debut, i18n.language)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap font-mono text-xs md:table-cell">
                      {formatDate(c.date_fin, i18n.language)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {t('common.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---------- Dialog ---------- */}
      <CompetitionDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        competition={editing}
      />
    </section>
  );
};
