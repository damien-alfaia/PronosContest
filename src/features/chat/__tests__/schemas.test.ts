import { describe, expect, it } from 'vitest';

import {
  MESSAGE_BODY_MAX,
  MESSAGE_BODY_MIN,
  type MessageAuthor,
  compareMessageByDateAsc,
  formatAuthorName,
  messageRowSchema,
  messageWithAuthorSchema,
  normalizeMessageRow,
  normalizeMessageWithAuthor,
  pickAuthorInitials,
  sendMessageSchema,
} from '@/features/chat/schemas';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

// ==================================================================
//  Constantes
// ==================================================================

describe('constantes', () => {
  it('MESSAGE_BODY_MIN / MAX alignés avec le CHECK SQL 1..1000', () => {
    expect(MESSAGE_BODY_MIN).toBe(1);
    expect(MESSAGE_BODY_MAX).toBe(1000);
  });
});

// ==================================================================
//  sendMessageSchema
// ==================================================================

describe('sendMessageSchema', () => {
  it('accepte un message non vide', () => {
    const res = sendMessageSchema.safeParse({ body: 'Salut !' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.body).toBe('Salut !');
    }
  });

  it('trim les espaces en bordure', () => {
    const res = sendMessageSchema.safeParse({ body: '   hello   ' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.body).toBe('hello');
    }
  });

  it('rejette un message vide', () => {
    const res = sendMessageSchema.safeParse({ body: '' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('chat.errors.bodyRequired');
    }
  });

  it('rejette un message composé uniquement d espaces (trim → vide)', () => {
    const res = sendMessageSchema.safeParse({ body: '        ' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('chat.errors.bodyRequired');
    }
  });

  it('rejette un message > 1000 caractères', () => {
    const res = sendMessageSchema.safeParse({ body: 'x'.repeat(1001) });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('chat.errors.bodyTooLong');
    }
  });

  it('accepte un message = 1000 caractères après trim', () => {
    const res = sendMessageSchema.safeParse({
      body: `  ${'x'.repeat(1000)}  `,
    });
    expect(res.success).toBe(true);
  });
});

// ==================================================================
//  messageRowSchema + normalizeMessageRow
// ==================================================================

const validRow = {
  id: UUID_A,
  concours_id: UUID_B,
  user_id: UUID_C,
  body: 'hello',
  created_at: '2026-04-20T12:00:00Z',
};

describe('messageRowSchema', () => {
  it('accepte une ligne brute valide', () => {
    const res = messageRowSchema.safeParse(validRow);
    expect(res.success).toBe(true);
  });

  it('rejette un UUID id invalide', () => {
    const res = messageRowSchema.safeParse({ ...validRow, id: 'not-uuid' });
    expect(res.success).toBe(false);
  });

  it('rejette un body vide', () => {
    const res = messageRowSchema.safeParse({ ...validRow, body: '' });
    expect(res.success).toBe(false);
  });
});

describe('normalizeMessageRow', () => {
  it('retourne null si id manquant', () => {
    expect(
      normalizeMessageRow({ ...validRow, id: null }),
    ).toBeNull();
  });

  it('retourne null si user_id manquant', () => {
    expect(
      normalizeMessageRow({ ...validRow, user_id: null }),
    ).toBeNull();
  });

  it('retourne null si body null', () => {
    expect(
      normalizeMessageRow({ ...validRow, body: null }),
    ).toBeNull();
  });

  it('retourne null si created_at null', () => {
    expect(
      normalizeMessageRow({ ...validRow, created_at: null }),
    ).toBeNull();
  });

  it('retourne la ligne typée si tout est présent', () => {
    const res = normalizeMessageRow(validRow);
    expect(res).toMatchObject({
      id: UUID_A,
      body: 'hello',
    });
  });
});

// ==================================================================
//  messageWithAuthorSchema + normalizeMessageWithAuthor
// ==================================================================

const validAuthor: MessageAuthor = {
  id: UUID_C,
  prenom: 'Alice',
  nom: 'Martin',
  avatar_url: null,
};

describe('messageWithAuthorSchema', () => {
  it('accepte une ligne avec auteur joint', () => {
    const res = messageWithAuthorSchema.safeParse({
      ...validRow,
      author: validAuthor,
    });
    expect(res.success).toBe(true);
  });

  it('accepte author: null (profil supprimé en cascade)', () => {
    const res = messageWithAuthorSchema.safeParse({
      ...validRow,
      author: null,
    });
    expect(res.success).toBe(true);
  });
});

describe('normalizeMessageWithAuthor', () => {
  it('construit un message + author à partir des raw nullables', () => {
    const res = normalizeMessageWithAuthor({
      ...validRow,
      author: {
        id: UUID_C,
        prenom: 'Alice',
        nom: null,
        avatar_url: null,
      },
    });
    expect(res).not.toBeNull();
    expect(res?.author?.prenom).toBe('Alice');
    expect(res?.author?.nom).toBeNull();
  });

  it('retourne author null si raw.author.id manquant', () => {
    const res = normalizeMessageWithAuthor({
      ...validRow,
      author: {
        id: null,
        prenom: 'Anonyme',
        nom: null,
        avatar_url: null,
      },
    });
    expect(res?.author).toBeNull();
  });

  it('retourne author null si raw.author = null', () => {
    const res = normalizeMessageWithAuthor({ ...validRow, author: null });
    expect(res?.author).toBeNull();
  });

  it('retourne null si la ligne de base est invalide', () => {
    const res = normalizeMessageWithAuthor({
      ...validRow,
      id: null,
      author: validAuthor,
    });
    expect(res).toBeNull();
  });
});

// ==================================================================
//  Helpers UI
// ==================================================================

describe('formatAuthorName', () => {
  it('retourne "Prénom Nom" si les deux sont présents', () => {
    expect(
      formatAuthorName({ id: UUID_C, prenom: 'Alice', nom: 'Martin', avatar_url: null }),
    ).toBe('Alice Martin');
  });

  it('retourne juste le prénom si nom manquant', () => {
    expect(
      formatAuthorName({ id: UUID_C, prenom: 'Alice', nom: null, avatar_url: null }),
    ).toBe('Alice');
  });

  it('retourne "?" si auteur null', () => {
    expect(formatAuthorName(null)).toBe('?');
  });

  it('retourne "?" si prénom + nom vides', () => {
    expect(
      formatAuthorName({ id: UUID_C, prenom: '  ', nom: '', avatar_url: null }),
    ).toBe('?');
  });
});

describe('pickAuthorInitials', () => {
  it('AM pour Alice Martin', () => {
    expect(
      pickAuthorInitials({
        id: UUID_C,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      }),
    ).toBe('AM');
  });

  it('A pour Alice sans nom', () => {
    expect(
      pickAuthorInitials({
        id: UUID_C,
        prenom: 'Alice',
        nom: null,
        avatar_url: null,
      }),
    ).toBe('A');
  });

  it('? pour auteur null', () => {
    expect(pickAuthorInitials(null)).toBe('?');
  });

  it('? pour prénom/nom vides', () => {
    expect(
      pickAuthorInitials({
        id: UUID_C,
        prenom: '  ',
        nom: '',
        avatar_url: null,
      }),
    ).toBe('?');
  });
});

describe('compareMessageByDateAsc', () => {
  const a = {
    ...validRow,
    id: UUID_A,
    created_at: '2026-04-20T10:00:00Z',
    author: null,
  };
  const b = {
    ...validRow,
    id: UUID_B,
    created_at: '2026-04-20T12:00:00Z',
    author: null,
  };

  it('retourne un nombre négatif si a est plus ancien', () => {
    expect(compareMessageByDateAsc(a, b)).toBeLessThan(0);
  });

  it('retourne un nombre positif si a est plus récent', () => {
    expect(compareMessageByDateAsc(b, a)).toBeGreaterThan(0);
  });

  it('retourne 0 si même date', () => {
    expect(compareMessageByDateAsc(a, a)).toBe(0);
  });
});
