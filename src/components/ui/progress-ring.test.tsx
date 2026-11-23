import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressRing, progressPercent } from './progress-ring';

describe('progressPercent', () => {
  it('clamps to 0-100 and survives a zero target', () => {
    expect(progressPercent(5, 10)).toBe(50);
    expect(progressPercent(15, 10)).toBe(100);
    expect(progressPercent(-1, 10)).toBe(0);
    expect(progressPercent(3, 0)).toBe(0);
  });
});

describe('ProgressRing', () => {
  it('draws the arc up to the percentage and renders centre content', () => {
    const { container } = render(
      <ProgressRing percent={50} strokeClassName="stroke-chart-5" role="img" aria-label="Půl">
        <text>50</text>
      </ProgressRing>,
    );
    expect(screen.getByRole('img', { name: 'Půl' })).toBeInTheDocument();
    const arc = container.querySelector('circle.stroke-chart-5');
    const [dash] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ');
    expect(Number(dash)).toBeCloseTo(Math.PI * 40, 5);
    expect(screen.getByText('50')).toBeInTheDocument();
  });
});
