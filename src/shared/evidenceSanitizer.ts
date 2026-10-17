import { MAX_MESSAGE_LENGTH, MAX_URL_LENGTH } from './constants';

const SENSITIVE_URL_KEYS = /([?&](?:access_?token|api_?key|auth(?:orization)?|token|password|secret|session|cookie)=)[^&#\s&]+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const KEY_VALUE_SECRET = /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*(?!\[redacted)([^\s,;&]+)/gi;
const JSON_SECRET = /"(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|session_?id|cookie)"\s*:\s*"[^"]+"/gi;
const COOKIE_HEADER = /\b(?:set-cookie|cookie)\s*:\s*([^\r\n;]+)/gi;
const JWT_TOKEN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/g;

export interface SanitizedTextResult {
  text: string;
  truncated: boolean;
}

/**
 * Conservatively removes credentials from evidence text before persistence.
 * Redacts secrets first, then applies explicit truncation marker if payload exceeds maxLength.
 */
export function sanitizeEvidenceText(value: unknown, maxLength: number = MAX_MESSAGE_LENGTH): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const sanitized = text
    .replace(SENSITIVE_URL_KEYS, '$1[redacted]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(JWT_TOKEN, '[redacted-jwt]')
    .replace(JSON_SECRET, '"$1":"[redacted]"')
    .replace(COOKIE_HEADER, 'cookie: [redacted]')
    .replace(KEY_VALUE_SECRET, '$1=[redacted]');

  if (sanitized.length > maxLength && Number.isFinite(maxLength)) {
    const excess = sanitized.length - maxLength;
    return `${sanitized.slice(0, maxLength)} [truncated ${excess} chars]`;
  }

  return sanitized;
}

export function sanitizeAndTruncateText(value: unknown, maxLength: number): SanitizedTextResult {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const sanitized = text
    .replace(SENSITIVE_URL_KEYS, '$1[redacted]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(JWT_TOKEN, '[redacted-jwt]')
    .replace(JSON_SECRET, '"$1":"[redacted]"')
    .replace(COOKIE_HEADER, 'cookie: [redacted]')
    .replace(KEY_VALUE_SECRET, '$1=[redacted]');

  if (sanitized.length > maxLength && Number.isFinite(maxLength)) {
    const excess = sanitized.length - maxLength;
    return {
      text: `${sanitized.slice(0, maxLength)} [truncated ${excess} chars]`,
      truncated: true,
    };
  }

  return {
    text: sanitized,
    truncated: false,
  };
}

export function sanitizeEvidenceUrl(value: unknown, maxLength: number = MAX_URL_LENGTH): string {
  return sanitizeEvidenceText(value, maxLength);
}
