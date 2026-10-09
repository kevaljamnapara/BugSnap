import { buildEnvironmentDiagnostics } from '../shared/environmentDiagnostics';
import { PageMetadata } from '../shared/types';

export function EnvironmentDiagnostics({ metadata }: { metadata: PageMetadata }) {
  return <section className="editor-alert editor-alert-info" data-testid="environment-diagnostics"><h2 style={{ marginTop: 0 }}>Environment diagnostics</h2><dl>{buildEnvironmentDiagnostics(metadata).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl><p>Unavailable fields are shown explicitly; this summary does not fingerprint the user.</p></section>;
}
