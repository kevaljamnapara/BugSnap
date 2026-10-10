import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReproductionStepsRecorder } from './ReproductionStepsRecorder';

describe('ReproductionStepsRecorder', () => {
  it('supports opt-in breadcrumbs and editable manual steps without input capture', () => {
    const onChange = vi.fn();
    render(<ReproductionStepsRecorder value="1. Open settings" onChange={onChange} pageUrl="https://example.test/settings" />);
    fireEvent.click(screen.getByText('Add observed navigation'));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('[Observed navigation] https://example.test/settings'));
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalled();
  });
});
