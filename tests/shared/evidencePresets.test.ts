import { describe, expect, it } from 'vitest';
import { sectionsForPreset } from '../../src/shared/evidencePresets';
describe('evidence presets', () => it('selects sections without collecting new evidence', () => {
  expect(sectionsForPreset('UI Layout Issue')).toEqual(['environment', 'screenshot', 'reproduction']);
}));
