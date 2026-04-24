import { describe, expect, it } from 'vitest';

import {
  checklistProgress,
  computeMilestones,
  normalizeOnboardingProgressRow,
  TOUR_STEP_IDS,
  type OnboardingMilestones,
} from '@/features/onboarding/schemas';

const fullMilestones: OnboardingMilestones = {
  welcomed: true,
  firstConcoursJoined: true,
  firstPronoSaved: true,
  firstClassementViewed: true,
  firstInviteSent: true,
  profileCompleted: true,
  checklistDismissed: false,
  tourStepsCompleted: [],
};

describe('onboarding/schemas', () => {
  // ------------------------------------------------------------------
  //  TOUR_STEP_IDS
  // ------------------------------------------------------------------
  describe('TOUR_STEP_IDS', () => {
    it('contient exactement 3 étapes dans l\'ordre attendu', () => {
      expect(TOUR_STEP_IDS).toEqual([
        'pronos.first_match_card',
        'pronos.filters',
        'pronos.classement_cta',
      ]);
    });
  });

  // ------------------------------------------------------------------
  //  normalizeOnboardingProgressRow
  // ------------------------------------------------------------------
  describe('normalizeOnboardingProgressRow', () => {
    const baseRow = {
      user_id: '11111111-1111-1111-1111-111111111111',
      welcomed_at: null,
      first_concours_joined_at: null,
      first_prono_saved_at: null,
      first_classement_viewed_at: null,
      first_invite_sent_at: null,
      tour_steps_completed: [],
      checklist_dismissed_at: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };

    it('parse une ligne valide (tous nullables à null)', () => {
      expect(normalizeOnboardingProgressRow(baseRow)).not.toBeNull();
    });

    it('retourne null si user_id manquant', () => {
      expect(
        normalizeOnboardingProgressRow({ ...baseRow, user_id: undefined }),
      ).toBeNull();
    });

    it('retourne null si input = null', () => {
      expect(normalizeOnboardingProgressRow(null)).toBeNull();
    });

    it('retourne null si input = undefined', () => {
      expect(normalizeOnboardingProgressRow(undefined)).toBeNull();
    });

    it('coalesce tour_steps_completed non-array en []', () => {
      const out = normalizeOnboardingProgressRow({
        ...baseRow,
        tour_steps_completed: 'not-an-array',
      });
      expect(out).not.toBeNull();
      expect(out?.tour_steps_completed).toEqual([]);
    });

    it('accepte un tour_steps_completed avec plusieurs IDs', () => {
      const out = normalizeOnboardingProgressRow({
        ...baseRow,
        tour_steps_completed: ['pronos.first_match_card', 'pronos.filters'],
      });
      expect(out?.tour_steps_completed).toEqual([
        'pronos.first_match_card',
        'pronos.filters',
      ]);
    });

    it('accepte les timestamps ISO et les renvoie intacts', () => {
      const ts = '2026-05-02T12:34:56Z';
      const out = normalizeOnboardingProgressRow({
        ...baseRow,
        welcomed_at: ts,
      });
      expect(out?.welcomed_at).toBe(ts);
    });
  });

  // ------------------------------------------------------------------
  //  computeMilestones
  // ------------------------------------------------------------------
  describe('computeMilestones', () => {
    it('retourne tout à false si row = null', () => {
      const m = computeMilestones(null, null);
      expect(m.welcomed).toBe(false);
      expect(m.firstConcoursJoined).toBe(false);
      expect(m.firstPronoSaved).toBe(false);
      expect(m.firstClassementViewed).toBe(false);
      expect(m.firstInviteSent).toBe(false);
      expect(m.profileCompleted).toBe(false);
      expect(m.checklistDismissed).toBe(false);
      expect(m.tourStepsCompleted).toEqual([]);
    });

    it('profileCompleted = true si prenom + nom non vides', () => {
      const m = computeMilestones(null, { prenom: 'Léa', nom: 'Martin' });
      expect(m.profileCompleted).toBe(true);
    });

    it('profileCompleted = false si prenom vide ou trimmé vide', () => {
      expect(
        computeMilestones(null, { prenom: '   ', nom: 'Martin' }).profileCompleted,
      ).toBe(false);
      expect(
        computeMilestones(null, { prenom: 'Léa', nom: '' }).profileCompleted,
      ).toBe(false);
    });

    it('profileCompleted = false si profile null', () => {
      expect(computeMilestones(null, null).profileCompleted).toBe(false);
    });

    it('mappe chaque first_xxx_at ≠ null → true', () => {
      const ts = '2026-05-01T00:00:00Z';
      const m = computeMilestones(
        {
          user_id: 'u',
          welcomed_at: ts,
          first_concours_joined_at: ts,
          first_prono_saved_at: null,
          first_classement_viewed_at: ts,
          first_invite_sent_at: null,
          tour_steps_completed: ['pronos.filters'],
          checklist_dismissed_at: ts,
          created_at: ts,
          updated_at: ts,
        },
        { prenom: 'Léa', nom: 'Martin' },
      );
      expect(m.welcomed).toBe(true);
      expect(m.firstConcoursJoined).toBe(true);
      expect(m.firstPronoSaved).toBe(false);
      expect(m.firstClassementViewed).toBe(true);
      expect(m.firstInviteSent).toBe(false);
      expect(m.checklistDismissed).toBe(true);
      expect(m.tourStepsCompleted).toEqual(['pronos.filters']);
    });
  });

  // ------------------------------------------------------------------
  //  checklistProgress
  // ------------------------------------------------------------------
  describe('checklistProgress', () => {
    it('compte les 5 tâches (pas welcomed ni tour)', () => {
      const { done, total } = checklistProgress(fullMilestones);
      expect(done).toBe(5);
      expect(total).toBe(5);
    });

    it('retourne 0/5 si rien de fait', () => {
      const { done, total } = checklistProgress({
        ...fullMilestones,
        firstConcoursJoined: false,
        firstPronoSaved: false,
        firstClassementViewed: false,
        firstInviteSent: false,
        profileCompleted: false,
      });
      expect(done).toBe(0);
      expect(total).toBe(5);
    });

    it('compte correctement un état mixte (3/5)', () => {
      const { done } = checklistProgress({
        ...fullMilestones,
        firstConcoursJoined: true,
        firstPronoSaved: true,
        firstClassementViewed: false,
        profileCompleted: true,
        firstInviteSent: false,
      });
      expect(done).toBe(3);
    });
  });
});
