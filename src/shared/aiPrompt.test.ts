import { describe, expect, it } from 'vitest';
import { generateAiDebugPrompt } from './aiPrompt';

describe('generateAiDebugPrompt', () => it('uses local reviewed evidence and asks for bounded analysis', () => {
  const prompt = generateAiDebugPrompt({ id: '1', status: 'draft', title: 'Broken', severity: 'High', reproductionSteps: 'Open', expectedBehavior: '', actualBehavior: 'Fails', additionalNotes: '', metadata: { url: 'https://test', title: '', capturedAt: '' }, createdAt: '', updatedAt: '', debugSession: { tabId: 1, status: 'stopped', startedAt: '', excludedEvidenceIds: ['hide'], consoleEvents: [{ id: 'hide', kind: 'runtime-error', message: 'secret', timestamp: '', count: 1 }] } });
  expect(prompt).toContain('Distinguish facts from hypotheses');
  expect(prompt).not.toContain('secret');
}));
