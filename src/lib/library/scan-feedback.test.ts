import { afterEach, describe, expect, it, vi } from 'vitest';

import { playScanFeedback, primeScanAudio } from './scan-feedback';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scan feedback', () => {
  it('stays silent but does not break scanning when Web Audio is unavailable', () => {
    expect(() => {
      primeScanAudio();
      playScanFeedback('paired');
      playScanFeedback('unpaired');
    }).not.toThrow();
  });

  it('uses a distinct vibration for paired and unpaired labels', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { vibrate });

    playScanFeedback('paired');
    playScanFeedback('unpaired');

    expect(vibrate).toHaveBeenNthCalledWith(1, 60);
    expect(vibrate).toHaveBeenNthCalledWith(2, [40, 60, 40]);
  });

  it('does not break scanning when vibration is unavailable', () => {
    vi.stubGlobal('navigator', {});

    expect(() => playScanFeedback('paired')).not.toThrow();
  });
});
