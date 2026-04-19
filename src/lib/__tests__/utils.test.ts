import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn (class merger)', () => {
  it('combine plusieurs classes', () => {
    expect(cn('p-2', 'm-4')).toBe('p-2 m-4');
  });

  it('résout les conflits Tailwind (la dernière gagne)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('ignore les valeurs falsy', () => {
    expect(cn('p-2', false, null, undefined, '')).toBe('p-2');
  });

  it('supporte les objets clsx', () => {
    expect(cn('p-2', { 'm-4': true, 'm-8': false })).toBe('p-2 m-4');
  });
});
