/**
 * Sanity tests for the module registry. These do NOT exercise the LLM
 * gateway — they only verify the config contract holds: every shipped
 * config can be resolved, and its output schema accepts the canonical
 * shape that AnalysisCard expects.
 */

import { moduleOutputSchema } from '@aisecretary/shared';
import { describe, expect, it } from 'vitest';
import {
  actionItemsModule,
  actionItemsOutputSchema,
  generalModule,
  getModuleConfig,
  hasModuleConfig,
  moduleRegistry,
} from './index.js';

describe('moduleRegistry', () => {
  it('contains the general module (Story 3.1)', () => {
    expect(hasModuleConfig('general')).toBe(true);
    const cfg = getModuleConfig('general');
    expect(cfg.id).toBe('general');
    expect(cfg.label).toBe('General');
    expect(cfg.lowConfidenceThreshold).toBeGreaterThan(0);
    expect(cfg.lowConfidenceThreshold).toBeLessThanOrEqual(1);
    expect(cfg.maxOutputTokens).toBeGreaterThan(0);
    expect(cfg.temperature).toBeGreaterThanOrEqual(0);
  });

  it('contains all 8 verticals after Stories 5.1–5.7', () => {
    const expected: ReadonlyArray<string> = [
      'general',
      'sales',
      'hr',
      'education',
      'medical',
      'support',
      'pm',
      'psychology',
    ];
    for (const id of expected) {
      expect(hasModuleConfig(id as Parameters<typeof hasModuleConfig>[0])).toBe(true);
    }
  });

  it('every shipped vertical exposes the canonical fields', () => {
    for (const cfg of Object.values(moduleRegistry)) {
      expect(cfg.id.length).toBeGreaterThan(0);
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.systemPrompt.length).toBeGreaterThan(200);
      // Citation deep-link contract referenced in every prompt.
      expect(cfg.systemPrompt).toMatch(/turnId/);
      expect(cfg.systemPrompt).toMatch(/meetingId/);
      expect(cfg.lowConfidenceThreshold).toBeGreaterThan(0);
      expect(cfg.lowConfidenceThreshold).toBeLessThanOrEqual(1);
      expect(cfg.maxOutputTokens).toBeGreaterThan(0);
      expect(cfg.temperature).toBeGreaterThanOrEqual(0);
      expect(cfg.temperature).toBeLessThanOrEqual(1);
    }
  });

  it('clinical verticals (medical / psychology) have higher low-confidence thresholds', () => {
    expect(getModuleConfig('medical').lowConfidenceThreshold).toBeGreaterThanOrEqual(0.8);
    expect(getModuleConfig('psychology').lowConfidenceThreshold).toBeGreaterThanOrEqual(0.8);
  });
});

describe('generalModule', () => {
  it('outputSchema accepts a valid `general` ModuleOutput', () => {
    const sample = {
      module: 'general' as const,
      title: 'Q3 planning',
      summary: 'The team aligned on the Q3 OKRs and owners.',
      bullets: [
        {
          claim: 'Bob committed to ship the new pricing page by July 15.',
          citations: [
            {
              meetingId: '00000000-0000-4000-8000-000000000001',
              turnId: 'abcdef0123456789',
              spanStartMs: 12_000,
              spanEndMs: 18_000,
            },
          ],
        },
      ],
    };
    const parsed = generalModule.outputSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
    // The shared union schema ALSO accepts the sample.
    const sharedParsed = moduleOutputSchema.safeParse(sample);
    expect(sharedParsed.success).toBe(true);
  });

  it('outputSchema rejects bad citation refs', () => {
    const bad = {
      module: 'general' as const,
      title: 't',
      summary: 's',
      bullets: [{ claim: 'c', citations: [{ meetingId: 'not-a-uuid', turnId: 'x' }] }],
    };
    const parsed = generalModule.outputSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it('systemPrompt mentions the citation deep-link contract', () => {
    expect(generalModule.systemPrompt).toMatch(/turnId/);
    expect(generalModule.systemPrompt).toMatch(/meetingId/);
  });
});

describe('actionItemsModule', () => {
  it('outputSchema accepts a populated action-items list', () => {
    const sample = {
      items: [
        {
          text: 'Send the SOC 2 questionnaire to Acme.',
          ownerName: 'Bob',
          dueDate: '2026-05-10',
          citations: [
            {
              meetingId: '00000000-0000-4000-8000-000000000001',
              turnId: 'abcdef0123456789',
              spanStartMs: 30_000,
              spanEndMs: 35_000,
            },
          ],
        },
      ],
    };
    expect(actionItemsOutputSchema.safeParse(sample).success).toBe(true);
  });

  it('outputSchema accepts an empty list (zero commitments)', () => {
    expect(actionItemsOutputSchema.safeParse({ items: [] }).success).toBe(true);
    // Default-empty also works.
    expect(actionItemsOutputSchema.safeParse({}).success).toBe(true);
  });

  it('module config exposes prompt + schema + tight token budget', () => {
    expect(actionItemsModule.id).toBe('action-items');
    expect(actionItemsModule.maxOutputTokens).toBeLessThanOrEqual(1500);
    expect(actionItemsModule.systemPrompt).toMatch(/explicit/);
  });
});
