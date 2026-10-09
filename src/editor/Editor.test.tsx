import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Editor } from './Editor';

describe('Editor Component', () => {
  it('renders BugSnap report editor header', () => {
    render(<Editor />);
    expect(
      screen.getByRole('heading', { name: /BugSnap — Report Editor/i }),
    ).toBeInTheDocument();
  });

  it('renders Phase 1 Foundation badge', () => {
    render(<Editor />);
    expect(screen.getByText(/Phase 1 Foundation/i)).toBeInTheDocument();
  });
});
