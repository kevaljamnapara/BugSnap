import { useMemo, useState } from 'react';
import { DebugSession } from '../shared/types';

type Filter = 'all' | 'runtime' | 'network';

export function DebugTimeline({ session }: { session: DebugSession }) {
  const [filter, setFilter] = useState<Filter>('all');
  const events = useMemo(() => {
    const consoleItems = session.consoleEvents.map((event) => ({
      id: event.id,
      category: 'runtime' as const,
      timestamp: event.timestamp,
      summary: event.message,
      count: event.count,
    }));
    const networkItems = (session.networkEvents || []).map((event) => ({
      id: event.id,
      category: 'network' as const,
      timestamp: event.timestamp,
      summary: `${event.initiatorType}: ${event.url || 'Unavailable URL'}`,
      count: event.count,
    }));
    return [...consoleItems, ...networkItems]
      .filter((event) => filter === 'all' || event.category === filter)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }, [filter, session]);

  return (
    <section className="editor-alert editor-alert-info diagnostics-panel" data-testid="debug-timeline">
      <div className="diagnostics-panel-header">
        <h2 style={{ margin: 0 }}>Debugging timeline</h2>
        <div className="btn-segmented-group" role="group" aria-label="Timeline filters">
          {(['all', 'runtime', 'network'] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn-secondary btn-sm btn-segmented ${filter === value ? 'btn-segmented-active' : ''}`}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <p className="diagnostics-hint">Events are chronological observations, not evidence of causation.</p>
      <ul className="timeline-events-list">
        {events.map((event) => (
          <li key={event.id} className="timeline-event-row">
            <span className={`timeline-tag timeline-tag-${event.category}`}>
              {event.category}
            </span>
            <span className="timeline-time">{event.timestamp}</span>
            <span className="timeline-summary">{event.summary}</span>
            {event.count > 1 && (
              <span className="timeline-count-badge">({event.count} occurrences)</span>
            )}
          </li>
        ))}
        {events.length === 0 && (
          <li className="timeline-empty-row">No events are available for this filter.</li>
        )}
      </ul>
    </section>
  );
}
