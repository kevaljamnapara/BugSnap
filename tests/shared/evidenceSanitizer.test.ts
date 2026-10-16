import { describe, expect, it } from 'vitest';
import { sanitizeEvidenceText } from '../../src/shared/evidenceSanitizer';

describe('sanitizeEvidenceText', () => {
  it('redacts common credential forms and bounds payload size', () => {
    expect(sanitizeEvidenceText('GET /x?access_token=abc&x=1 Bearer secret-token')).toBe(
      'GET /x?access_token=[redacted]&x=1 Bearer [redacted]',
    );
    expect(sanitizeEvidenceText('api_key: abc123 password=hunter2')).toBe(
      'api_key=[redacted] password=[redacted]',
    );
    expect(sanitizeEvidenceText('x'.repeat(10), 4)).toBe('xxxx');
  });
});
