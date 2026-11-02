interface Tone {
  frequency: number;
  durationMs: number;
}

const PAIRED_TONE: Tone = { frequency: 880, durationMs: 120 };
const UNPAIRED_TONES: readonly Tone[] = [
  { frequency: 330, durationMs: 110 },
  { frequency: 220, durationMs: 160 },
];
const TONE_GAP_MS = 70;
const TONE_PEAK_GAIN = 0.08;
const TONE_ATTACK_S = 0.01;
const START_OFFSET_S = 0.01;
const VIBRATION_PAIRED_MS = 60;
const VIBRATION_UNPAIRED_PATTERN = [40, 60, 40];

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;

  audioContext ??= new window.AudioContext();
  return audioContext;
}

function playTone(context: AudioContext, tone: Tone, startAt: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const endAt = startAt + tone.durationMs / 1000;

  oscillator.type = 'sine';
  oscillator.frequency.value = tone.frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(TONE_PEAK_GAIN, startAt + TONE_ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function vibrate(outcome: 'paired' | 'unpaired'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  navigator.vibrate(outcome === 'paired' ? VIBRATION_PAIRED_MS : VIBRATION_UNPAIRED_PATTERN);
}

/**
 * Call from a user gesture (opening the scanner) so mobile browsers allow the
 * audio context to start. Without it, Safari refuses to play the scan tones.
 */
export function primeScanAudio(): void {
  try {
    const context = getAudioContext();
    if (context?.state === 'suspended') void context.resume();
  } catch {
    // Sound is best-effort; scanning must keep working without it.
  }
}

export function playScanFeedback(outcome: 'paired' | 'unpaired'): void {
  try {
    const context = getAudioContext();
    if (context) {
      if (context.state === 'suspended') void context.resume();

      let startAt = context.currentTime + START_OFFSET_S;
      const tones = outcome === 'paired' ? [PAIRED_TONE] : UNPAIRED_TONES;
      for (const tone of tones) {
        playTone(context, tone, startAt);
        startAt += (tone.durationMs + TONE_GAP_MS) / 1000;
      }
    }
  } catch {
    // Sound is best-effort; scanning must keep working without it.
  }

  vibrate(outcome);
}
