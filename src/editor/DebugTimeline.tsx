import { useMemo, useState } from 'react';
import { DebugSession } from '../shared/types';

type Filter = 'all' | 'runtime' | 'network';

export function DebugTimeline({ session }: { session: DebugSession }) {
  const [filter, setFilter] = useState<Filter>('all');
  const events = useMemo(() => {
    const consoleItems = session.consoleEvents.map((event) => ({
      id: event.id, category: 'runtime' as const, timestamp: event.timestamp,
      summary: event.message, count: event.count,
    }));
    const networkItems = (session.networkEvents || []).map((event) => ({
      id: event.id, category: 'network' as const, timestamp: event.timestamp,
      summary: `${event.initiatorType}: ${event.url || 'Unavailable URL'}`, count: event.count,
    }));
    return [...consoleItems, ...networkItems]
      .filter((event) => filter === 'all' || event.category === filter)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }, [filter, session]);

  return <section className="editor-alert editor-alert-info" data-testid="debug-timeline">
    <h2 style={{ marginTop: 0 }}>Debugging timeline</h2>
    <p>Events are chronological observations, not evidence of causation.</p>
    <div role="group" aria-label="Timeline filters">
      {(['all', 'runtime', 'network'] as Filter[]).map((value) => <button key={value} type="button" className="btn btn-secondary btn-sm" onClick={() => setFilter(value)} aria-pressed={filter === value}>{value}</button>)}
    </div>
    <ul>
      {events.map((event) => <li key={event.id}><strong>{event.category}</strong> — {event.timestamp}: {event.summary}{event.count > 1 ? ` (${event.count} occurrences)` : ''}</li>)}
      {events.length === 0 && <li>No events are available for this filter.</li>}
    </ul>
  </section>;
}
