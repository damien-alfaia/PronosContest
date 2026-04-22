import {
  Compass,
  Flame,
  Gift,
  HelpCircle,
  type LucideIcon,
  ShieldCheck,
  Swords,
  Zap,
} from 'lucide-react';

/**
 * Mapping des icônes lucide-react utilisées par les 7 jokers seedés
 * dans la migration `20260426120000_init_jokers.sql`.
 *
 *   - Flame        → double (×2 points)
 *   - Zap          → triple (×3 points)
 *   - ShieldCheck  → safety_net (filet minimum)
 *   - Compass      → boussole (score exact le plus fréquent)
 *   - Swords       → challenge / double_down (défis, même icône — les
 *                    deux jokers sont volontairement visuellement
 *                    cousins, le libellé + la catégorie les distinguent)
 *   - Gift         → gift (offrir un joker)
 *
 * Mapping statique (comme `badge-icon`) pour garantir le tree-shaking
 * et tenir la surface d'icônes explicite. Fallback `HelpCircle` pour
 * les cas non mappés (ne doit pas crasher la UI si le seed ajoute une
 * icône avant que ce fichier ne soit mis à jour).
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Compass,
  Flame,
  Gift,
  ShieldCheck,
  Swords,
  Zap,
};

export const resolveJokerIcon = (icon: string): LucideIcon =>
  ICON_MAP[icon] ?? HelpCircle;
