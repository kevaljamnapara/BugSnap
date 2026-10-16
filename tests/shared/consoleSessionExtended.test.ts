import { describe, it, expect } from 'vitest';
import {
  appendConsoleEvent,
  appendNetworkEvent,
  appendConsoleEventToSession,
  appendNetworkEventToSession,
  normalizeConsoleEvent,
  normalizeNetworkEvent,
  isFailedNetworkEvent,
} from '../../src/shared/consoleSession';
import { DebugSession, NetworkEvidenceEvent } from '../../src/shared/types';
import { MAX_CONSOLE_EVENTS, MAX_OTHER_NETWORK_EVENTS } from '../../src/shared/constants';

describe('consoleSession — Extended Capping, Deduplication, and Accounting', () => {
  it('errors are never evicted by successful network calls', () => {
    let session: DebugSession = {
      tabId: 1,
      status: 'active',
      startedAt: '2026-10-17T00:00:00.000Z',
      consoleEvents: [],
      networkEvents: [],
    };

    // Add 1 critical failed network call
    const failedCall = normalizeNetworkEvent({
      url: 'https://api.example.com/checkout',
      method: 'POST',
      status: 500,
      statusText: 'Internal Server Error',
      responseBodySnippet: '{"error":"card_declined"}',
    });
    session = appendNetworkEventToSession(session, failedCall);

    expect(session.networkEvents).toHaveLength(1);
    expect(isFailedNetworkEvent(session.networkEvents![0])).toBe(true);

    // Flood with 400 successful image loads (exceeds MAX_OTHER_NETWORK_EVENTS = 300)
    for (let i = 0; i < 400; i++) {
      const successCall = normalizeNetworkEvent({
        url: `https://cdn.example.com/images/${i}.png`,
        method: 'GET',
        status: 200,
        initiatorType: 'img',
      });
      session = appendNetworkEventToSession(session, successCall);
    }

    // The failed call MUST STILL BE PRESENT!
    const foundFailed = session.networkEvents!.find((e: NetworkEvidenceEvent) => e.url === 'https://api.example.com/checkout');
    expect(foundFailed).toBeDefined();
    expect(foundFailed?.status).toBe(500);

    // Successful calls should be capped at MAX_OTHER_NETWORK_EVENTS (300)
    const successCalls = session.networkEvents!.filter((e: NetworkEvidenceEvent) => !isFailedNetworkEvent(e));
    expect(successCalls).toHaveLength(MAX_OTHER_NETWORK_EVENTS);

    // Exactly 100 successful calls were dropped
    expect(session.droppedOtherNetworkCount).toBe(100);
    expect(session.droppedFailedNetworkCount || 0).toBe(0);
  });

  it('keeps newest events and updates dropped counters accurately for console ring buffer', () => {
    let session: DebugSession = {
      tabId: 1,
      status: 'active',
      startedAt: '2026-10-17T00:00:00.000Z',
      consoleEvents: [],
    };

    for (let i = 0; i < MAX_CONSOLE_EVENTS + 50; i++) {
      const event = normalizeConsoleEvent('runtime-error', {
        message: `Error unique ${i}`,
        timestamp: `2026-10-17T00:00:${String(i).padStart(4, '0')}.000Z`,
      });
      session = appendConsoleEventToSession(session, event);
    }

    expect(session.consoleEvents).toHaveLength(MAX_CONSOLE_EVENTS);
    expect(session.droppedConsoleCount).toBe(50);
    // Oldest 50 were evicted; newest (last added) is present
    expect(session.consoleEvents[MAX_CONSOLE_EVENTS - 1].message).toBe(`Error unique ${MAX_CONSOLE_EVENTS + 49}`);
    expect(session.consoleEvents[0].message).toBe('Error unique 50');
  });

  it('dedupe separates distinct outcomes (200 vs 500 on same URL)', () => {
    const url = 'https://api.example.com/resource';
    const okCall = normalizeNetworkEvent({
      url,
      method: 'GET',
      status: 200,
      timestamp: '2026-10-17T00:00:01.000Z',
    });
    const errCall = normalizeNetworkEvent({
      url,
      method: 'GET',
      status: 500,
      statusText: 'Server Error',
      timestamp: '2026-10-17T00:00:02.000Z',
    });

    const events = appendNetworkEvent([okCall], errCall);
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe(200);
    expect(events[1].status).toBe(500);

    // Appending a duplicate 500 updates count and lastSeen on the 500 entry
    const errCall2 = normalizeNetworkEvent({
      url,
      method: 'GET',
      status: 500,
      statusText: 'Server Error',
      timestamp: '2026-10-17T00:00:05.000Z',
    });
    const updated = appendNetworkEvent(events, errCall2);
    expect(updated).toHaveLength(2);
    expect(updated[1].count).toBe(2);
    expect(updated[1].lastSeen).toBe('2026-10-17T00:00:05.000Z');
  });

  it('dedupe separates console errors with different stack traces or line numbers', () => {
    const err1 = normalizeConsoleEvent('runtime-error', {
      message: 'Cannot read property of undefined',
      stack: 'TypeError: at fileA.js:10:5',
      source: 'fileA.js',
      line: 10,
      column: 5,
    });

    const err2 = normalizeConsoleEvent('runtime-error', {
      message: 'Cannot read property of undefined',
      stack: 'TypeError: at fileB.js:99:1',
      source: 'fileB.js',
      line: 99,
      column: 1,
    });

    const events = appendConsoleEvent([err1], err2);
    expect(events).toHaveLength(2);
  });

  it('response body snippet is stored ONLY for failed calls (status >= 400 or network error)', () => {
    const successCall = normalizeNetworkEvent({
      url: 'https://api.example.com/ok',
      status: 200,
      responseBodySnippet: '{"secret":"data"}', // Should be discarded
    });
    expect(successCall.responseBodySnippet).toBeUndefined();

    const failureCall = normalizeNetworkEvent({
      url: 'https://api.example.com/fail',
      status: 404,
      responseBodySnippet: '{"error":"Not Found"}',
    });
    expect(failureCall.responseBodySnippet).toBe('{"error":"Not Found"}');
  });

  it('sets truncated flag and explicit marker when fields exceed maximums', () => {
    const hugeMsg = 'E'.repeat(4500);
    const event = normalizeConsoleEvent('runtime-error', { message: hugeMsg });
    expect(event.truncated).toBe(true);
    expect(event.message).toContain('[truncated 500 chars]');
  });
});
