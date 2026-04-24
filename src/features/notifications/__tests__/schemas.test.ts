import { describe, expect, it } from 'vitest';

import {
  CHALLENGE_JOKER_CODES,
  CHAT_MENTION_MATCH_TYPES,
  NOTIFICATION_TYPE_VALUES,
  type Notification,
  badgeEarnedPayloadSchema,
  challengeReceivedPayloadSchema,
  chatMentionPayloadSchema,
  compareNotificationByRecent,
  concoursNewMemberPayloadSchema,
  giftReceivedPayloadSchema,
  isUnread,
  matchResultPayloadSchema,
  normalizeNotification,
  notificationSchema,
} from '@/features/notifications/schemas';

// ------------------------------------------------------------------
//  CONSTANTES
// ------------------------------------------------------------------

describe('NOTIFICATION_TYPE_VALUES', () => {
  it('expose les 7 types supportés (Sprint 6.C + 8.C.4 + 9.C.5)', () => {
    expect(NOTIFICATION_TYPE_VALUES).toEqual([
      'match_result',
      'badge_earned',
      'concours_new_member',
      'chat_mention',
      'challenge_received',
      'gift_received',
      'referral_milestone',
    ]);
  });
});

describe('CHAT_MENTION_MATCH_TYPES', () => {
  it('expose full_name + first_name (2-pass matching)', () => {
    expect(CHAT_MENTION_MATCH_TYPES).toEqual(['full_name', 'first_name']);
  });
});

describe('CHALLENGE_JOKER_CODES', () => {
  it('expose challenge + double_down (catégorie challenge)', () => {
    expect(CHALLENGE_JOKER_CODES).toEqual(['challenge', 'double_down']);
  });
});

// ------------------------------------------------------------------
//  PAYLOAD SCHEMAS
// ------------------------------------------------------------------

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

describe('matchResultPayloadSchema', () => {
  it('accepte un payload valide avec scores nullables', () => {
    const ok = matchResultPayloadSchema.safeParse({
      match_id: UUID_A,
      competition_id: UUID_B,
      score_a: 2,
      score_b: 1,
      equipe_a_id: UUID_C,
      equipe_b_id: UUID_A,
      vainqueur_tab: null,
    });
    expect(ok.success).toBe(true);
  });

  it('accepte scores null (admin force finished sans résultat)', () => {
    const ok = matchResultPayloadSchema.safeParse({
      match_id: UUID_A,
      competition_id: UUID_B,
      score_a: null,
      score_b: null,
      equipe_a_id: null,
      equipe_b_id: null,
      vainqueur_tab: null,
    });
    expect(ok.success).toBe(true);
  });

  it('rejette un match_id non-UUID', () => {
    const ko = matchResultPayloadSchema.safeParse({
      match_id: 'not-a-uuid',
      competition_id: UUID_B,
      score_a: 1,
      score_b: 0,
      equipe_a_id: null,
      equipe_b_id: null,
      vainqueur_tab: null,
    });
    expect(ko.success).toBe(false);
  });

  it('rejette vainqueur_tab inconnu', () => {
    const ko = matchResultPayloadSchema.safeParse({
      match_id: UUID_A,
      competition_id: UUID_B,
      score_a: 1,
      score_b: 1,
      equipe_a_id: null,
      equipe_b_id: null,
      vainqueur_tab: 'c',
    });
    expect(ko.success).toBe(false);
  });

  it('rejette un score non entier', () => {
    const ko = matchResultPayloadSchema.safeParse({
      match_id: UUID_A,
      competition_id: UUID_B,
      score_a: 1.5,
      score_b: 0,
      equipe_a_id: null,
      equipe_b_id: null,
      vainqueur_tab: null,
    });
    expect(ko.success).toBe(false);
  });
});

describe('badgeEarnedPayloadSchema', () => {
  it('accepte payload avec metadata vide', () => {
    const ok = badgeEarnedPayloadSchema.safeParse({
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    });
    expect(ok.success).toBe(true);
  });

  it('accepte metadata avec compteurs libres', () => {
    const ok = badgeEarnedPayloadSchema.safeParse({
      badge_code: 'centurion',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: { count: 50 },
    });
    expect(ok.success).toBe(true);
  });

  it('rejette badge_code vide', () => {
    const ko = badgeEarnedPayloadSchema.safeParse({
      badge_code: '',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    });
    expect(ko.success).toBe(false);
  });
});

describe('concoursNewMemberPayloadSchema', () => {
  it('accepte payload complet', () => {
    const ok = concoursNewMemberPayloadSchema.safeParse({
      concours_id: UUID_A,
      concours_nom: 'Pronos entre potes',
      new_user_id: UUID_B,
    });
    expect(ok.success).toBe(true);
  });

  it('rejette concours_nom vide', () => {
    const ko = concoursNewMemberPayloadSchema.safeParse({
      concours_id: UUID_A,
      concours_nom: '',
      new_user_id: UUID_B,
    });
    expect(ko.success).toBe(false);
  });
});

describe('challengeReceivedPayloadSchema', () => {
  it('accepte un payload challenge avec stakes=5', () => {
    const ok = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
      sender_id: UUID_C,
      joker_code: 'challenge',
      stakes: 5,
    });
    expect(ok.success).toBe(true);
  });

  it('accepte un payload double_down avec stakes=10', () => {
    const ok = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
      sender_id: UUID_C,
      joker_code: 'double_down',
      stakes: 10,
    });
    expect(ok.success).toBe(true);
  });

  it('accepte stakes null (payload malformé côté SQL, défense en profondeur)', () => {
    const ok = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
      sender_id: UUID_C,
      joker_code: 'challenge',
      stakes: null,
    });
    expect(ok.success).toBe(true);
  });

  it('rejette un match_id non-UUID', () => {
    const ko = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: 'not-a-uuid',
      sender_id: UUID_C,
      joker_code: 'challenge',
      stakes: 5,
    });
    expect(ko.success).toBe(false);
  });

  it('rejette stakes négatif', () => {
    const ko = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
      sender_id: UUID_C,
      joker_code: 'challenge',
      stakes: -1,
    });
    expect(ko.success).toBe(false);
  });

  it('rejette joker_code vide', () => {
    const ko = challengeReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
      sender_id: UUID_C,
      joker_code: '',
      stakes: 5,
    });
    expect(ko.success).toBe(false);
  });
});

describe('giftReceivedPayloadSchema', () => {
  it('accepte un payload valide', () => {
    const ok = giftReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      sender_id: UUID_B,
      gifted_joker_code: 'triple',
    });
    expect(ok.success).toBe(true);
  });

  it('rejette concours_id non-UUID', () => {
    const ko = giftReceivedPayloadSchema.safeParse({
      concours_id: 'x',
      sender_id: UUID_B,
      gifted_joker_code: 'triple',
    });
    expect(ko.success).toBe(false);
  });

  it('rejette gifted_joker_code vide', () => {
    const ko = giftReceivedPayloadSchema.safeParse({
      concours_id: UUID_A,
      sender_id: UUID_B,
      gifted_joker_code: '',
    });
    expect(ko.success).toBe(false);
  });
});

describe('chatMentionPayloadSchema', () => {
  it('accepte match_type = full_name', () => {
    const ok = chatMentionPayloadSchema.safeParse({
      concours_id: UUID_A,
      message_id: UUID_B,
      mentioned_by: UUID_C,
      token: 'Alice Martin',
      match_type: 'full_name',
      body_preview: 'Salut @Alice Martin !',
    });
    expect(ok.success).toBe(true);
  });

  it('accepte match_type = first_name', () => {
    const ok = chatMentionPayloadSchema.safeParse({
      concours_id: UUID_A,
      message_id: UUID_B,
      mentioned_by: UUID_C,
      token: 'Alice',
      match_type: 'first_name',
      body_preview: 'Salut @Alice !',
    });
    expect(ok.success).toBe(true);
  });

  it('rejette match_type inconnu', () => {
    const ko = chatMentionPayloadSchema.safeParse({
      concours_id: UUID_A,
      message_id: UUID_B,
      mentioned_by: UUID_C,
      token: 'Alice',
      match_type: 'email',
      body_preview: 'hey',
    });
    expect(ko.success).toBe(false);
  });
});

// ------------------------------------------------------------------
//  DISCRIMINATED UNION notificationSchema
// ------------------------------------------------------------------

const baseFields = {
  id: UUID_A,
  user_id: UUID_B,
  title: null,
  body: null,
  read_at: null,
  created_at: '2026-04-20T12:00:00Z',
};

describe('notificationSchema (union discriminée sur `type`)', () => {
  it('accepte une notif match_result', () => {
    const ok = notificationSchema.safeParse({
      ...baseFields,
      type: 'match_result',
      payload: {
        match_id: UUID_A,
        competition_id: UUID_B,
        score_a: 2,
        score_b: 1,
        equipe_a_id: null,
        equipe_b_id: null,
        vainqueur_tab: null,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('accepte une notif badge_earned', () => {
    const ok = notificationSchema.safeParse({
      ...baseFields,
      type: 'badge_earned',
      payload: {
        badge_code: 'rookie',
        earned_at: '2026-04-20T12:00:00Z',
        metadata: {},
      },
    });
    expect(ok.success).toBe(true);
  });

  it('rejette un payload mal typé pour le type donné', () => {
    const ko = notificationSchema.safeParse({
      ...baseFields,
      type: 'badge_earned',
      payload: {
        match_id: UUID_A, // payload match_result sur un type badge_earned
        competition_id: UUID_B,
        score_a: null,
        score_b: null,
        equipe_a_id: null,
        equipe_b_id: null,
        vainqueur_tab: null,
      },
    });
    expect(ko.success).toBe(false);
  });

  it('rejette un type inconnu', () => {
    const ko = notificationSchema.safeParse({
      ...baseFields,
      type: 'unknown_type',
      payload: {},
    });
    expect(ko.success).toBe(false);
  });

  it('accepte une notif challenge_received', () => {
    const ok = notificationSchema.safeParse({
      ...baseFields,
      type: 'challenge_received',
      payload: {
        concours_id: UUID_A,
        match_id: UUID_B,
        sender_id: UUID_C,
        joker_code: 'double_down',
        stakes: 10,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('accepte une notif gift_received', () => {
    const ok = notificationSchema.safeParse({
      ...baseFields,
      type: 'gift_received',
      payload: {
        concours_id: UUID_A,
        sender_id: UUID_B,
        gifted_joker_code: 'triple',
      },
    });
    expect(ok.success).toBe(true);
  });

  it('rejette un gift_received avec match_id (payload du mauvais type)', () => {
    const ko = notificationSchema.safeParse({
      ...baseFields,
      type: 'gift_received',
      payload: {
        concours_id: UUID_A,
        match_id: UUID_B,
        sender_id: UUID_C,
        joker_code: 'challenge',
        stakes: 5,
      },
    });
    expect(ko.success).toBe(false);
  });

  it('accepte title/body non-null (cas broadcast futur)', () => {
    const ok = notificationSchema.safeParse({
      ...baseFields,
      title: 'Info maintenance',
      body: 'Le service sera coupé à 23 h.',
      type: 'badge_earned',
      payload: {
        badge_code: 'rookie',
        earned_at: '2026-04-20T12:00:00Z',
        metadata: {},
      },
    });
    expect(ok.success).toBe(true);
  });
});

// ------------------------------------------------------------------
//  NORMALIZER
// ------------------------------------------------------------------

describe('normalizeNotification', () => {
  const validRaw = {
    id: UUID_A,
    user_id: UUID_B,
    type: 'badge_earned',
    title: null,
    body: null,
    payload: {
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    },
    read_at: null,
    created_at: '2026-04-20T12:00:00Z',
  };

  it('retourne un Notification valide sur un input correct', () => {
    const out = normalizeNotification(validRaw);
    expect(out).not.toBeNull();
    expect(out?.type).toBe('badge_earned');
  });

  it('retourne null si id manquant', () => {
    const out = normalizeNotification({ ...validRaw, id: null });
    expect(out).toBeNull();
  });

  it('retourne null si user_id manquant', () => {
    const out = normalizeNotification({ ...validRaw, user_id: null });
    expect(out).toBeNull();
  });

  it('retourne null si type null', () => {
    const out = normalizeNotification({ ...validRaw, type: null });
    expect(out).toBeNull();
  });

  it('retourne null si created_at manquant', () => {
    const out = normalizeNotification({ ...validRaw, created_at: null });
    expect(out).toBeNull();
  });

  it('retourne null si type inconnu', () => {
    const out = normalizeNotification({ ...validRaw, type: 'weird_type' });
    expect(out).toBeNull();
  });

  it('retourne null si payload ne respecte pas le schéma du type', () => {
    const out = normalizeNotification({
      ...validRaw,
      type: 'match_result',
      // payload est badge_earned, pas match_result → rejet
    });
    expect(out).toBeNull();
  });

  it('coerce payload null en objet vide puis rejette (badge_code manquant)', () => {
    const out = normalizeNotification({ ...validRaw, payload: null });
    expect(out).toBeNull();
  });

  it('coerce payload tableau en objet vide puis rejette', () => {
    const out = normalizeNotification({
      ...validRaw,
      payload: [1, 2, 3] as unknown,
    });
    expect(out).toBeNull();
  });

  it('accepte un match_result complet', () => {
    const out = normalizeNotification({
      id: UUID_A,
      user_id: UUID_B,
      type: 'match_result',
      title: null,
      body: null,
      payload: {
        match_id: UUID_A,
        competition_id: UUID_B,
        score_a: 2,
        score_b: 1,
        equipe_a_id: null,
        equipe_b_id: null,
        vainqueur_tab: null,
      },
      read_at: null,
      created_at: '2026-04-20T12:00:00Z',
    });
    expect(out?.type).toBe('match_result');
  });

  it('accepte une challenge_received et préserve stakes', () => {
    const out = normalizeNotification({
      id: UUID_A,
      user_id: UUID_B,
      type: 'challenge_received',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_A,
        match_id: UUID_B,
        sender_id: UUID_C,
        joker_code: 'challenge',
        stakes: 5,
      },
      read_at: null,
      created_at: '2026-04-29T12:00:00Z',
    });
    expect(out?.type).toBe('challenge_received');
    if (out?.type === 'challenge_received') {
      expect(out.payload.stakes).toBe(5);
      expect(out.payload.joker_code).toBe('challenge');
    }
  });

  it('accepte une gift_received et préserve gifted_joker_code', () => {
    const out = normalizeNotification({
      id: UUID_A,
      user_id: UUID_B,
      type: 'gift_received',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_A,
        sender_id: UUID_C,
        gifted_joker_code: 'triple',
      },
      read_at: null,
      created_at: '2026-04-29T12:00:00Z',
    });
    expect(out?.type).toBe('gift_received');
    if (out?.type === 'gift_received') {
      expect(out.payload.gifted_joker_code).toBe('triple');
    }
  });

  it('retourne null pour une challenge_received sans stakes', () => {
    // La clé `stakes` est requise par le schéma (nullable, mais présente).
    const out = normalizeNotification({
      id: UUID_A,
      user_id: UUID_B,
      type: 'challenge_received',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_A,
        match_id: UUID_B,
        sender_id: UUID_C,
        joker_code: 'challenge',
      },
      read_at: null,
      created_at: '2026-04-29T12:00:00Z',
    });
    expect(out).toBeNull();
  });

  it('accepte un chat_mention avec match_type first_name', () => {
    const out = normalizeNotification({
      id: UUID_A,
      user_id: UUID_B,
      type: 'chat_mention',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_A,
        message_id: UUID_B,
        mentioned_by: UUID_C,
        token: 'Alice',
        match_type: 'first_name',
        body_preview: 'Salut !',
      },
      read_at: null,
      created_at: '2026-04-20T12:00:00Z',
    });
    expect(out?.type).toBe('chat_mention');
    if (out?.type === 'chat_mention') {
      expect(out.payload.match_type).toBe('first_name');
    }
  });
});

// ------------------------------------------------------------------
//  HELPERS UI
// ------------------------------------------------------------------

const makeNotif = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: UUID_A,
    user_id: UUID_B,
    type: 'badge_earned',
    title: null,
    body: null,
    payload: {
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    },
    read_at: null,
    created_at: '2026-04-20T12:00:00Z',
    ...overrides,
  }) as Notification;

describe('compareNotificationByRecent', () => {
  it('classe la plus récente en premier', () => {
    const a = makeNotif({ id: UUID_A, created_at: '2026-04-20T10:00:00Z' });
    const b = makeNotif({ id: UUID_B, created_at: '2026-04-20T12:00:00Z' });
    const sorted = [a, b].sort(compareNotificationByRecent);
    expect(sorted[0]?.id).toBe(UUID_B);
  });

  it('tie-break par id quand created_at égal (ordre stable)', () => {
    const a = makeNotif({ id: UUID_A, created_at: '2026-04-20T12:00:00Z' });
    const b = makeNotif({ id: UUID_B, created_at: '2026-04-20T12:00:00Z' });
    const sorted = [a, b].sort(compareNotificationByRecent);
    // localeCompare b vs a : UUID_B > UUID_A → b en premier.
    expect(sorted[0]?.id).toBe(UUID_B);
  });
});

describe('isUnread', () => {
  it('retourne true quand read_at est null', () => {
    expect(isUnread(makeNotif({ read_at: null }))).toBe(true);
  });

  it('retourne false quand read_at est rempli', () => {
    expect(
      isUnread(makeNotif({ read_at: '2026-04-20T13:00:00Z' })),
    ).toBe(false);
  });
});
