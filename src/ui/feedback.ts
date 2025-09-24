export const haptic = (kind: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    if (!('vibrate' in navigator)) return;
    const p = kind === 'heavy' ? [12, 20, 12] : kind === 'medium' ? [10] : [6];
    (navigator as any).vibrate?.(p);
  } catch {
    // ignore haptic errors
  }
};

// Best-effort beep, guarded to avoid autoplay issues; fine to no-op
export const beep = async (freq = 880, durMs = 60) => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, durMs + 40);
  } catch {
    // ignore beep errors
  }
};
