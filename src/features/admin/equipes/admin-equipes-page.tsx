import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Equipe } from '@/features/admin/equipes/api';
import { EquipeDialog } from '@/features/admin/equipes/components/equipe-dialog';
import {
  useAdminEquipesQuery,
  useDeleteEquipeMutation,
} from '@/features/admin/equipes/use-admin-equipes';
import { useCompetitionsQuery } from '@/features/concours/use-concours';

/**
 * Page admin — référentiel des équipes.
 *
 * Accès : protégé par `<RequireAdmin />` (cf. router).
 *
 * Fonctionnalités :
 *  - Sélecteur de compétition (auto-sélection de la 1re si non définie).
 *  - Table des équipes (groupe, code, nom, FIFA id, drapeau) triée
 *    groupe asc puis nom asc côté API.
 *  - Création / édition via dialog.
 *  - Suppression confirmée par `window.confirm` (FK RESTRICT : bloqué
 *    si l'équipe est référencée par un match).
 */

export const AdminEquipesPage = () => {
  const { t } = useTranslation();
  const competitionsQuery = useCompetitionsQuery();
  const competitions = competitionsQuery.data ?? [];

  const [selectedCompetitionId, setSelectedCompetitionId] = useState<
    string | undefined
  >(undefined);

  const effectiveCompetitionId =
    selectedCompetitionId ?? competitions[0]?.id;

  const equipesQuery = useAdminEquipesQuery(effectiveCompetitionId);
  const deleteMutation = useDeleteEquipeMutation(effectiveCompetitionId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipe | null>(null);

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (equipe: Equipe) => {
    setEditing(equipe);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
  };

  const handleDelete = (equipe: Equipe) => {
    if (!window.confirm(t('admin.equipes.confirmDelete'))) return;

    deleteMutation.mutate(equipe.id, {
      onSuccess: () => toast.success(t('admin.toast.equipeDeleted')),
      onError: (err) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('violates foreign key') || /23503/.test(msg)) {
          toast.error(t('admin.toast.equipeInUse'));
        } else {
          toast.error(t('admin.toast.equipeDeleteError'));
        }
      },
    });
  };

  if (competitionsQuery.isLoading) return <FullScreenSpinner />;

  if (competitions.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t('admin.equipes.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.equipes.emptyCompetitions')}
        </p>
      </section>
    );
  }

  const equipes = equipesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      {/* ---------- En-tête ---------- */}
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('admin.equipes.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.equipes.subtitle')}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenCreate}
          disabled={!effectiveCompetitionId}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('admin.equipes.actions.create')}
        </Button>
      </header>

      {/* ---------- Sélection de la compétition ---------- */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="admin-equipes-competition-select">
          {t('admin.equipes.competitionLabel')}
        </Label>
        <select
          id="admin-equipes-competition-select"
          value={effectiveCompetitionId ?? ''}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
          className="flex h-10 w-full max-w-sm items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>

      <Separator />

      {/* ---------- Table ---------- */}
      {equipesQuery.isLoading ? (
        <div className="flex items-center justify-center p-12">
          <FullScreenSpinner />
        </div>
      ) : equipes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {t('admin.equipes.empty.title')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.equipes.empty.description')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.equipes.columns.groupe')}</TableHead>
                <TableHead>{t('admin.equipes.columns.code')}</TableHead>
                <TableHead>{t('admin.equipes.columns.nom')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('admin.equipes.columns.fifaId')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('admin.equipes.columns.drapeau')}
                </TableHead>
                <TableHead className="text-right">
                  {t('admin.equipes.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {e.groupe ? (
                      <Badge variant="muted" className="font-mono">
                        {e.groupe}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.code}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {e.fifa_id ?? '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {e.drapeau_url ? (
                      <img
                        src={e.drapeau_url}
                        alt={t('admin.equipes.flagAlt', { nom: e.nom })}
                        className="h-5 w-auto rounded-sm border border-border"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(e)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {t('common.edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(e)}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---------- Dialog ---------- */}
      {effectiveCompetitionId ? (
        <EquipeDialog
          open={dialogOpen}
          onOpenChange={handleDialogChange}
          equipe={editing}
          competitionId={effectiveCompetitionId}
        />
      ) : null}
    </section>
  );
};
