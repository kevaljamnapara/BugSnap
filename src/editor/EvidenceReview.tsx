import { DebugSession } from '../shared/types';
import { reviewedSession } from '../shared/evidenceReview';

export function EvidenceReview({ session, onChange }: { session: DebugSession; onChange: (session: DebugSession) => void }) {
  const reviewed = reviewedSession(session);
  const excluded = new Set(session.excludedEvidenceIds || []);
  const events = [...session.consoleEvents, ...(session.networkEvents || [])];
  return <section className="editor-alert editor-alert-info" data-testid="evidence-review"><h2 style={{ marginTop: 0 }}>Evidence review and redaction</h2><p>Review evidence before sharing. Automated redaction is conservative, not perfect.</p><ul>{events.map((event) => <li key={event.id}><code>{'message' in event ? event.message : event.url}</code> <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange({ ...session, excludedEvidenceIds: excluded.has(event.id) ? [...excluded].filter((id) => id !== event.id) : [...excluded, event.id] })}>{excluded.has(event.id) ? 'Include' : 'Remove from export'}</button></li>)}</ul><p>{reviewed.consoleEvents.length + (reviewed.networkEvents?.length || 0)} reviewed evidence items will be included.</p></section>;
}
