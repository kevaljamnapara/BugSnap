import { describe, expect, it } from 'vitest';
import { sanitizeEvidenceText, sanitizeAndTruncateText, sanitizeEvidenceUrl } from '../../src/shared/evidenceSanitizer';

describe('sanitizeEvidenceText', () => {
  it('redacts common credential forms and applies explicit truncation marker', () => {
    expect(sanitizeEvidenceText('GET /x?access_token=abc&x=1 Bearer secret-token')).toBe(
      'GET /x?access_token=[redacted]&x=1 Bearer [redacted]',
    );
    expect(sanitizeEvidenceText('api_key: abc123 password=hunter2')).toBe(
      'api_key=[redacted] password=[redacted]',
    );
    // Explicit truncation replaces silent truncation
    expect(sanitizeEvidenceText('x'.repeat(10), 4)).toBe('xxxx [truncated 6 chars]');
  });

  it('redacts JSON-style secret keys', () => {
    const json = '{"token":"secret-token-123","apiKey":"xyz987","username":"john"}';
    const sanitized = sanitizeEvidenceText(json);
    expect(sanitized).toContain('"token":"[redacted]"');
    expect(sanitized).toContain('"apiKey":"[redacted]"');
    expect(sanitized).toContain('"username":"john"');
  });

  it('redacts Cookie and Set-Cookie headers', () => {
    const header = 'Cookie: session_id=abc123xyz; secure; HttpOnly';
    expect(sanitizeEvidenceText(header)).toContain('cookie: [redacted]');
  });

  it('redacts JWT-shaped strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Request failed with authorization token: ${jwt}`;
    const sanitized = sanitizeEvidenceText(text);
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).toContain('[redacted-jwt]');
  });

  it('sanitizeAndTruncateText returns text and boolean flag', () => {
    const shortText = 'Short message';
    const resShort = sanitizeAndTruncateText(shortText, 50);
    expect(resShort.text).toBe(shortText);
    expect(resShort.truncated).toBe(false);

    const longText = 'A'.repeat(100);
    const resLong = sanitizeAndTruncateText(longText, 60);
    expect(resLong.text).toBe(`${'A'.repeat(60)} [truncated 40 chars]`);
    expect(resLong.truncated).toBe(true);
  });

  it('sanitizeEvidenceUrl redacts sensitive query parameters', () => {
    const url = 'https://api.example.com/data?token=abc12345&filter=active';
    expect(sanitizeEvidenceUrl(url)).toBe('https://api.example.com/data?token=[redacted]&filter=active');
  });
});
