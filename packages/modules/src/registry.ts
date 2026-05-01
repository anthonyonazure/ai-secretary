/**
 * Module registry — central lookup for the AnalysisCard renderer +
 * worker scheduler.
 *
 * Story 3.1 ships only the `general` module. As Story 5.x lands the
 * vertical-specific configs (sales, hr, education, medical, support,
 * pm, psychology), each adds one entry here. Adding a vertical = one
 * config file + one registry line. No platform deploy.
 */

import type { ModuleId } from '@aisecretary/shared';
import { educationModule } from './education.js';
import { generalModule } from './general.js';
import { hrModule } from './hr.js';
import { medicalModule } from './medical.js';
import { pmModule } from './pm.js';
import { psychologyModule } from './psychology.js';
import { salesModule } from './sales.js';
import { supportModule } from './support.js';
import type { ModuleConfig } from './types.js';

/**
 * Stories 3.1 (general) + 5.1–5.7 (verticals) — full 8-module fleet.
 * The worker resolves a module via `getModuleConfig(id)` which throws on
 * miss; the AnalysisCard renderer skips unknown modules with a structured
 * -log warning so a missing config never breaks the page.
 */
export const moduleRegistry: Record<ModuleId, ModuleConfig> = {
  general: generalModule,
  sales: salesModule,
  hr: hrModule,
  education: educationModule,
  medical: medicalModule,
  support: supportModule,
  pm: pmModule,
  psychology: psychologyModule,
};

export const getModuleConfig = (id: ModuleId): ModuleConfig => {
  const cfg = moduleRegistry[id];
  if (!cfg) {
    throw new Error(`moduleRegistry: no config for module id '${id}'`);
  }
  return cfg;
};

export const hasModuleConfig = (id: ModuleId): boolean => moduleRegistry[id] !== undefined;
