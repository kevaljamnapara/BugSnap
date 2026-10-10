import { useMemo } from 'react';

export function ReproductionStepsRecorder({ value, onChange, pageUrl }: { value: string; onChange: (value: string) => void; pageUrl?: string }) {
  const steps = useMemo(() => value.split('\n').map((step) => step.trim()).filter(Boolean), [value]);
  const save = (next: string[]) => onChange(next.map((step, index) => `${index + 1}. ${step.replace(/^\d+\.\s*/, '')}`).join('\n'));
  const addStep = () => save([...steps, 'Describe the next manual action']);
  const addBreadcrumb = () => {
    if (!pageUrl) return;
    save([...steps, `[Observed navigation] ${pageUrl}`]);
  };
  return <div className="form-group" data-testid="reproduction-recorder">
    <label className="form-label">Reproduction Steps</label>
    <p className="form-hint">Manual steps are editable. Observed navigation is opt-in; BugSnap never records keystrokes or form values.</p>
    <textarea id="report-steps" name="reproductionSteps" className="form-textarea" rows={4} value={value} onChange={(event) => onChange(event.target.value)} data-testid="input-steps" />
    <ol>
      {steps.map((step, index) => <li key={`${index}-${step}`}><span>{step}</span> <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(steps.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></li>)}
    </ol>
    <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>Add manual step</button>{' '}
    <button type="button" className="btn btn-secondary btn-sm" onClick={addBreadcrumb} disabled={!pageUrl}>Add observed navigation</button>
  </div>;
}
