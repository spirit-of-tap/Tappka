import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BioEditor } from './bio-editor';

describe('BioEditor', () => {
  it('renders placeholder "Napište něco o sobě" for empty bio', async () => {
    const onChange = vi.fn();
    const { container } = render(<BioEditor initialContent={null} onChange={onChange} />);
    // Tiptap mounts async (immediatelyRender: false) — wait for the editable.
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    // Placeholder extension renders via data-placeholder + CSS :before,
    // so assert the attribute rather than visible text (jsdom has no layout).
    const placeholder = container.querySelector('[data-placeholder]');
    expect(placeholder?.getAttribute('data-placeholder')).toMatch(/Napište něco o sobě/i);
  });

  it('has bold and list buttons but no image button', async () => {
    render(<BioEditor initialContent={null} />);
    expect(await screen.findByTitle(/Tučné/i)).toBeInTheDocument();
    expect(await screen.findByTitle(/Odrážkový seznam/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Vložit obrázek/i)).toBeNull();
  });
});
