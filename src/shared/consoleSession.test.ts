import { describe, expect, it } from 'vitest';
import { appendConsoleEvent, appendNetworkEvent, normalizeConsoleEvent, normalizeNetworkEvent, MAX_CONSOLE_EVENTS } from './consoleSession';

describe('console evidence', () => {
  it('sanitizes runtime evidence and groups duplicates', () => {
    const event = normalizeConsoleEvent('runtime-error', { message: 'token=abc', source: 'https://a.test/?secret=x' });
    expect(event.message).toContain('[redacted]');
    expect(event.source).toContain('[redacted]');
    const grouped = appendConsoleEvent([event], { ...event, id: 'next', timestamp: '2026-01-01T00:00:00.000Z' });
    expect(grouped).toHaveLength(1);
    expect(grouped[0].count).toBe(2);
  });

  it('caps retained evidence', () => {
    let events = [] as ReturnType<typeof normalizeConsoleEvent>[];
    for (let index = 0; index < MAX_CONSOLE_EVENTS + 1; index += 1) {
      events = appendConsoleEvent(events, normalizeConsoleEvent('runtime-error', { message: String(index) }));
    }
    expect(events).toHaveLength(MAX_CONSOLE_EVENTS);
  });

  it('records only sanitized observable network resource metadata', () => {
    const event = normalizeNetworkEvent({ name: 'https://api.test/items?token=abc', initiatorType: 'fetch', duration: 12 });
    expect(event.url).toContain('[redacted]');
    expect(event.outcome).toBe('observed-resource');
    expect(appendNetworkEvent([event], { ...event, id: 'next' })[0].count).toBe(2);
  });
});
