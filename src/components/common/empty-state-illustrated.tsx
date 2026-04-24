import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * EmptyStateIllustrated — remplace les empty states textuels de l'app.
 *
 * Les illustrations sont des SVG inline minimalistes (style outline
 * cohérent avec lucide-react), en 2 couleurs :
 *   - stroke principal : `text-primary`  (indigo — contour)
 *   - accent           : `text-accent`   (amber — highlight)
 *
 * Accessibilité :
 *   - `role="status"` : annoncé par les lecteurs d'écran à l'apparition
 *   - illustration `aria-hidden="true"` : décor uniquement
 *   - `aria-label` optionnel sur le conteneur pour renforcer le contexte
 *
 * Usage :
 *   <EmptyStateIllustrated
 *     illustration="pronos"
 *     title={t('pronos.empty.title')}
 *     description={t('pronos.empty.description')}
 *     action={<Button>{t('pronos.empty.cta')}</Button>}
 *   />
 */

export type EmptyStateIllustration =
  | 'pronos'
  | 'concours'
  | 'classement'
  | 'notifications'
  | 'chat';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateIllustratedProps {
  illustration: EmptyStateIllustration;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
}

const ILLUSTRATION_SIZE: Record<EmptyStateSize, string> = {
  sm: 'h-20 w-20',
  md: 'h-32 w-32',
  lg: 'h-40 w-40',
};

const TITLE_SIZE: Record<EmptyStateSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-lg font-semibold',
};

const DESCRIPTION_SIZE: Record<EmptyStateSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function EmptyStateIllustrated({
  illustration,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateIllustratedProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn('text-primary', ILLUSTRATION_SIZE[size])}
      >
        {renderIllustration(illustration)}
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className={cn(TITLE_SIZE[size], 'text-foreground')}>{title}</p>
        {description ? (
          <p
            className={cn(
              DESCRIPTION_SIZE[size],
              'max-w-md text-muted-foreground',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function renderIllustration(kind: EmptyStateIllustration) {
  switch (kind) {
    case 'pronos':
      return <PronosIllustration />;
    case 'concours':
      return <ConcoursIllustration />;
    case 'classement':
      return <ClassementIllustration />;
    case 'notifications':
      return <NotificationsIllustration />;
    case 'chat':
      return <ChatIllustration />;
  }
}

/* -------------------------------------------------------------------
 * Illustrations SVG inline
 *
 * Chaque SVG :
 *   - viewBox 120x120
 *   - stroke-width 1.5
 *   - stroke="currentColor" (hérité de `text-primary`)
 *   - éléments accent via `className="text-accent"` (override local)
 *   - fill none par défaut (outline style)
 * ------------------------------------------------------------------- */

function PronosIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {/* Clipboard body */}
      <rect x="28" y="28" width="64" height="80" rx="6" />
      {/* Clipboard clip top */}
      <rect x="46" y="20" width="28" height="14" rx="3" />
      {/* Form lines (pronos) */}
      <line x1="38" y1="52" x2="82" y2="52" />
      <line x1="38" y1="66" x2="70" y2="66" />
      <line x1="38" y1="80" x2="82" y2="80" />
      <line x1="38" y1="94" x2="58" y2="94" />
      {/* Checkmark accent (1 prono validé) */}
      <path
        className="text-accent"
        d="M74 64 L80 70 L92 58"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Small ball bottom-right */}
      <circle
        className="text-accent"
        cx="96"
        cy="100"
        r="6"
        stroke="currentColor"
      />
    </svg>
  );
}

function ConcoursIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {/* Trophy cup */}
      <path d="M42 36 L42 56 Q42 72 60 72 Q78 72 78 56 L78 36 Z" />
      {/* Left handle */}
      <path d="M42 40 Q30 40 30 50 Q30 58 42 58" />
      {/* Right handle */}
      <path d="M78 40 Q90 40 90 50 Q90 58 78 58" />
      {/* Trophy stem */}
      <line x1="60" y1="72" x2="60" y2="86" />
      {/* Trophy base */}
      <rect x="44" y="86" width="32" height="8" rx="2" />
      <rect x="40" y="94" width="40" height="6" rx="1.5" />
      {/* Star accent on trophy */}
      <path
        className="text-accent"
        d="M60 44 L62.5 50 L69 50.5 L64 54.5 L65.5 61 L60 57.5 L54.5 61 L56 54.5 L51 50.5 L57.5 50 Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Sparkles around */}
      <path
        className="text-accent"
        d="M26 26 L26 32 M23 29 L29 29"
        stroke="currentColor"
      />
      <path
        className="text-accent"
        d="M94 26 L94 32 M91 29 L97 29"
        stroke="currentColor"
      />
    </svg>
  );
}

function ClassementIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {/* Podium — 3 bars */}
      {/* 2nd place (left) */}
      <rect x="16" y="66" width="28" height="34" rx="2" />
      <text
        x="30"
        y="88"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        2
      </text>
      {/* 1st place (center, tallest) */}
      <rect x="46" y="48" width="28" height="52" rx="2" />
      {/* 1st place crown (accent) */}
      <path
        className="text-accent"
        d="M50 40 L56 32 L60 38 L64 32 L70 40 L70 44 L50 44 Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="60"
        y="78"
        fontSize="16"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        1
      </text>
      {/* 3rd place (right) */}
      <rect x="76" y="78" width="28" height="22" rx="2" />
      <text
        x="90"
        y="94"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        3
      </text>
      {/* Ground line */}
      <line x1="10" y1="100" x2="110" y2="100" strokeWidth="2" />
    </svg>
  );
}

function NotificationsIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {/* Bell body */}
      <path d="M40 76 Q40 48 60 42 Q80 48 80 76 Z" />
      {/* Bell top cap */}
      <path d="M56 42 Q56 36 60 36 Q64 36 64 42" />
      {/* Bell bottom rim */}
      <line x1="34" y1="76" x2="86" y2="76" strokeWidth="2" />
      {/* Bell clapper */}
      <path d="M54 82 Q54 88 60 88 Q66 88 66 82" />
      {/* Dashed circle around (signals "nothing new") */}
      <circle
        className="text-accent"
        cx="60"
        cy="60"
        r="44"
        stroke="currentColor"
        strokeDasharray="4 6"
        strokeWidth="1"
      />
      {/* Zz's (accent — rien à signaler, la cloche dort) */}
      <path
        className="text-accent"
        d="M90 28 L100 28 L90 40 L100 40"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        className="text-accent"
        d="M100 16 L106 16 L100 24 L106 24"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChatIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {/* Bubble 1 (left, larger) */}
      <path d="M16 42 Q16 32 26 32 L66 32 Q76 32 76 42 L76 64 Q76 74 66 74 L36 74 L24 86 L26 74 Q16 74 16 64 Z" />
      {/* Bubble 2 (right, smaller, accent) */}
      <path
        className="text-accent"
        d="M44 58 Q44 50 52 50 L96 50 Q104 50 104 58 L104 78 Q104 86 96 86 L86 86 L94 96 L80 86 L52 86 Q44 86 44 78 Z"
        stroke="currentColor"
      />
      {/* Dots inside bubble 1 (waiting indicator) */}
      <circle cx="36" cy="53" r="2" fill="currentColor" stroke="none" />
      <circle cx="46" cy="53" r="2" fill="currentColor" stroke="none" />
      <circle cx="56" cy="53" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
