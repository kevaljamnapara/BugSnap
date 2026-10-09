const SENSITIVE_URL_KEYS = /([?&](?:access_?token|api_?key|auth(?:orization)?|password|secret|session|cookie)=)[^&#\s&]+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const KEY_VALUE_SECRET = /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*([^\s,;&]+)/gi;

/** Conservatively removes common credentials from evidence before it is persisted. */
export function sanitizeEvidenceText(value: unknown, maxLength = 2_000): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text
    .replace(SENSITIVE_URL_KEYS, '$1[redacted]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(KEY_VALUE_SECRET, '$1=[redacted]')
    .slice(0, maxLength);
}

export function sanitizeEvidenceUrl(value: unknown): string {
  return sanitizeEvidenceText(value, 1_500);
}
