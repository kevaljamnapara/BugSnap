import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DebugTimeline } from '../../src/editor/DebugTimeline';

describe('DebugTimeline', () => {
  it('orders evidence and filters categories without claiming causation', () => {
    render(<DebugTimeline session={{ tabId: 1, status: 'stopped', startedAt: '2026-01-01T00:00:00Z', consoleEvents: [{ id: 'c', kind: 'runtime-error', message: 'boom', timestamp: '2026-01-02T00:00:00Z', count: 2 }], networkEvents: [{ id: 'n', url: 'https://test', initiatorType: 'fetch', duration: 1, timestamp: '2026-01-01T00:00:00Z', outcome: 'observed-resource', count: 1 }] }} />);
    expect(screen.getByText(/not evidence of causation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'runtime' }));
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.queryByText(/https:\/\/test/)).not.toBeInTheDocument();
  });
});
