import { useState } from 'react';
import { EvidencePreset, sectionsForPreset } from '../shared/evidencePresets';
const options: EvidencePreset[] = ['Frontend Error', 'API Failure', 'UI Layout Issue', 'Performance Issue'];
export function EvidencePresets() {
  const [preset, setPreset] = useState<EvidencePreset>('Frontend Error');
  return <section className="editor-alert editor-alert-info" data-testid="evidence-presets"><h2 style={{ marginTop: 0 }}>Evidence preset</h2><select aria-label="Evidence preset" value={preset} onChange={(event) => setPreset(event.target.value as EvidencePreset)}>{options.map((option) => <option key={option}>{option}</option>)}</select><p>Selected sections: {sectionsForPreset(preset).join(', ')}. Presets filter sharing choices only; they do not collect additional evidence.</p></section>;
}
