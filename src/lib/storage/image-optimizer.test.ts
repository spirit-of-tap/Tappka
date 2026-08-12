import { describe, expect, it } from 'vitest';
import { fitWithinBox } from '@/lib/storage/image-optimizer';

describe('fitWithinBox', () => {
  it('leaves images smaller than the box alone rather than upscaling', () => {
    expect(fitWithinBox(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('scales a landscape photo by its longest edge', () => {
    expect(fitWithinBox(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo by its longest edge', () => {
    expect(fitWithinBox(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('preserves the aspect ratio of an extreme panorama', () => {
    const { width, height } = fitWithinBox(6000, 500, 1600);
    expect(width).toBe(1600);
    expect(height / width).toBeCloseTo(500 / 6000, 2);
  });

  it('never rounds a thin edge down to zero', () => {
    expect(fitWithinBox(10_000, 20, 1600).height).toBeGreaterThanOrEqual(1);
  });

  it('handles a degenerate zero-size image without dividing by zero', () => {
    expect(fitWithinBox(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});
