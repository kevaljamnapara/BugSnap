import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrandMark } from '../../src/shared/BrandMark';

describe('BrandMark Component', () => {
  it('renders an img with explicit width/height and empty alt as decorative element', () => {
    render(
      <div className="title-wrapper">
        <BrandMark size={24} />
        <span>BugSnap</span>
      </div>,
    );

    const img = screen.getByTestId('brand-mark-img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('width', '24');
    expect(img).toHaveAttribute('height', '24');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('draggable', 'false');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('supports explicit standalone alt text when provided', () => {
    render(<BrandMark size={32} alt="BugSnap" />);
    const img = screen.getByRole('img', { name: 'BugSnap' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });
});
