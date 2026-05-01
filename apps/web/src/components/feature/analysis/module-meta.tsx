import {
  BarChart3,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
  Megaphone,
  Stethoscope,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';

import type { ModuleId } from '@aisecretary/shared';

/**
 * Module identity is icon + label, never hue (UX spec § "No module
 * color-coding"). Density variants per vertical (medical / psychology
 * default to relaxed; others dense) live in the host density class — the
 * `AnalysisCard` consumes whichever density mode the parent has set.
 */
export interface ModuleMeta {
  label: string;
  icon: LucideIcon;
  /** Default density for this vertical when host hasn't forced one. */
  defaultDensity: 'dense' | 'relaxed';
  /** Per-vertical copy register hint — informs prose tone but not layout. */
  copyRegister: 'reflective' | 'snappy' | 'factual';
}

export const moduleMeta: Record<ModuleId, ModuleMeta> = {
  general: {
    label: 'General',
    icon: BarChart3,
    defaultDensity: 'dense',
    copyRegister: 'snappy',
  },
  sales: {
    label: 'Sales',
    icon: Target,
    defaultDensity: 'dense',
    copyRegister: 'snappy',
  },
  hr: {
    label: 'HR',
    icon: UserCheck,
    defaultDensity: 'dense',
    copyRegister: 'factual',
  },
  education: {
    label: 'Education',
    icon: GraduationCap,
    defaultDensity: 'dense',
    copyRegister: 'factual',
  },
  medical: {
    label: 'Medical',
    icon: Stethoscope,
    defaultDensity: 'relaxed',
    copyRegister: 'reflective',
  },
  support: {
    label: 'Support',
    icon: Megaphone,
    defaultDensity: 'dense',
    copyRegister: 'snappy',
  },
  pm: {
    label: 'PM',
    icon: Users,
    defaultDensity: 'dense',
    copyRegister: 'factual',
  },
  psychology: {
    label: 'Psychology',
    icon: HeartPulse,
    defaultDensity: 'relaxed',
    copyRegister: 'reflective',
  },
};
