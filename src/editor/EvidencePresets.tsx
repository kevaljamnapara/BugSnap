import { useState } from 'react';
import { EvidencePreset, sectionsForPreset } from '../shared/evidencePresets';

const options: EvidencePreset[] = ['Frontend Error', 'API Failure', 'UI Layout Issue', 'Performance Issue'];

export function EvidencePresets() {
  const [preset, setPreset] = useState<EvidencePreset>('Frontend Error');
  return (
    <section className="editor-alert editor-alert-info diagnostics-panel" data-testid="evidence-presets">
      <div className="diagnostics-panel-header">
        <h2 style={{ margin: 0 }}>Evidence preset</h2>
        <span className="diagnostics-badge">Sharing filter</span>
      </div>
      <div className="preset-selector-row">
        <select
          className="form-select preset-select"
          aria-label="Evidence preset"
          value={preset}
          onChange={(event) => setPreset(event.target.value as EvidencePreset)}
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <p className="diagnostics-footer-note">
        Selected sections: <strong>{sectionsForPreset(preset).join(', ')}</strong>. Presets filter sharing choices only; they do not collect additional evidence.
      </p>
    </section>
  );
}
