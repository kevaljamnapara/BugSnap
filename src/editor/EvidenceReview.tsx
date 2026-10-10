import { DebugSession } from '../shared/types';
import { reviewedSession } from '../shared/evidenceReview';

export function EvidenceReview({
  session,
  onChange,
}: {
  session: DebugSession;
  onChange: (session: DebugSession) => void;
}) {
  const reviewed = reviewedSession(session);
  const excluded = new Set(session.excludedEvidenceIds || []);
  const events = [...session.consoleEvents, ...(session.networkEvents || [])];

  return (
    <section className="editor-alert editor-alert-info diagnostics-panel" data-testid="evidence-review">
      <div className="diagnostics-panel-header">
        <h2 style={{ margin: 0 }}>Evidence review and redaction</h2>
        <span className="diagnostics-badge">Privacy redaction</span>
      </div>
      <p className="diagnostics-hint">
        Review evidence before sharing. Automated redaction is conservative, not perfect.
      </p>
      <ul className="evidence-review-list">
        {events.map((event) => {
          const isExcluded = excluded.has(event.id);
          const text = 'message' in event ? event.message : event.url;
          return (
            <li key={event.id} className="evidence-review-row">
              <code className="evidence-code-snippet">{text}</code>
              <button
                type="button"
                className={`btn btn-sm ${isExcluded ? 'btn-secondary' : 'btn-ghost-danger'}`}
                onClick={() =>
                  onChange({
                    ...session,
                    excludedEvidenceIds: isExcluded
                      ? [...excluded].filter((id) => id !== event.id)
                      : [...excluded, event.id],
                  })
                }
              >
                {isExcluded ? 'Include' : 'Remove from export'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="diagnostics-footer-note">
        <strong>{reviewed.consoleEvents.length + (reviewed.networkEvents?.length || 0)}</strong> reviewed evidence items will be included.
      </p>
    </section>
  );
}
