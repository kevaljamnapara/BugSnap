import { describe, it, expect } from 'vitest';
import { APP_NAME, SEVERITY_LEVELS, DEFAULT_SEVERITY } from './constants';

describe('Shared Constants', () => {
  it('has valid APP_NAME', () => {
    expect(APP_NAME).toBe('BugSnap');
  });

  it('contains all four required severity levels in exact order', () => {
    expect(SEVERITY_LEVELS).toEqual(['Low', 'Medium', 'High', 'Critical']);
  });

  it('defaults to Medium severity', () => {
    expect(DEFAULT_SEVERITY).toBe('Medium');
  });
});
