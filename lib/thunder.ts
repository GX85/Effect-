// Layered stereo thunder: a softened pressure crack, rolling low-frequency turbulence and distant reflections.
export function createThunderBuffer(ctx: AudioContext) {
  const duration = 8,
    buffer = ctx.createBuffer(
      2,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    );
  const pulses = [
    { time: 0.0, level: 0.8, decay: 0.34 },
    { time: 0.37, level: 0.48, decay: 0.85 },
    { time: 1.05, level: 0.4, decay: 1.3 },
    { time: 2.35, level: 0.28, decay: 1.7 },
    { time: 3.9, level: 0.16, decay: 1.5 },
  ];
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let brown = 0,
      low = 0,
      slow = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.021 * white) / 1.021;
      low += 0.015 * (white - low);
      slow += 0.004 * (white - slow);
      let env = 0;
      for (const p of pulses) {
        const d = t - p.time - ch * 0.018;
        if (d > 0)
          env += p.level * (1 - Math.exp(-d * 16)) * Math.exp(-d / p.decay);
      }
      const rolling = (brown * 3.7 + low * 1.2 + slow * 2) * env;
      const crack = white * 0.12 * Math.exp(-t * 10) * Math.min(t * 80, 1);
      const tail = Math.min(1, (duration - t) / 0.5);
      data[i] = Math.tanh((rolling + crack) * 1.7) * tail;
    }
  }
  return buffer;
}
