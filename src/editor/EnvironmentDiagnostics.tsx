import { buildEnvironmentDiagnostics } from '../shared/environmentDiagnostics';
import { PageMetadata } from '../shared/types';

export function EnvironmentDiagnostics({ metadata }: { metadata: PageMetadata }) {
  const items = buildEnvironmentDiagnostics(metadata);
  return (
    <section className="editor-alert editor-alert-info diagnostics-panel" data-testid="environment-diagnostics">
      <div className="diagnostics-panel-header">
        <h2 style={{ margin: 0 }}>Environment diagnostics</h2>
        <span className="diagnostics-badge">Client context</span>
      </div>
      <dl className="diagnostics-grid">
        {items.map((item) => (
          <div key={item.label} className="diagnostics-item">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="diagnostics-footer-note">
        Unavailable fields are shown explicitly; this summary does not fingerprint the user.
      </p>
    </section>
  );
}
