import {
  AlarmClock,
  Beer,
  CalendarRange,
  CheckSquare,
  CircleDot,
  ClipboardList,
  Crosshair,
  Crown,
  Eye,
  Flag,
  Flame,
  Footprints,
  Gem,
  HelpCircle,
  LayoutGrid,
  type LucideIcon,
  Medal,
  Moon,
  Share2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sunrise,
  Swords,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';

/**
 * Mapping des icônes lucide-react utilisées par les 28 badges seedés
 * dans la migration `20260423120000_init_badges.sql`.
 *
 * On garde un mapping statique pour :
 *   - éviter un dynamic import (tree-shaking friendly),
 *   - contrôler explicitement la surface des icônes utilisées.
 *
 * Si une nouvelle icône est seedée, il faudra l'ajouter ici — sinon
 * le fallback `HelpCircle` sera utilisé.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  AlarmClock,
  Beer,
  CalendarRange,
  CheckSquare,
  CircleDot,
  ClipboardList,
  Crosshair,
  Crown,
  Eye,
  Flag,
  Flame,
  Footprints,
  Gem,
  LayoutGrid,
  Medal,
  Moon,
  Share2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sunrise,
  Swords,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
};

/**
 * Retourne le composant lucide-react associé au nom seedé.
 * Fallback `HelpCircle` si le nom ne matche aucune icône connue
 * (devrait être signalé via test, pas crasher la UI).
 */
export const resolveBadgeIcon = (icon: string): LucideIcon =>
  ICON_MAP[icon] ?? HelpCircle;
